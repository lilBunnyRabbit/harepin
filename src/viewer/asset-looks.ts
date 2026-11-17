import * as THREE from "three";
import { build_spec, parse_build, type Build } from "../car/build";
import { ride_height } from "../car/car";
import type { CarSpec } from "../car/cars";
import { flares, sculpt } from "../car/body-shell";
import { DETAILS } from "../car/car-details";
import { detail_look } from "../car/detail-looks";
import type { Design } from "../car/designs";
import { merge, parts, tint } from "../car/geometry";
import { body_y, build_view, dispose_car_view, fitted_design, rest_wheels } from "../car/models";
import { paint_lab } from "../car/paint";
import { aero_of, aero_parts, rear_wing } from "../car/part-looks";
import { kit_sample, type Piece } from "../render/prop-kit";
import { mesh_tones } from "../render/scene";
import { prop_sample, tree_sample } from "../render/samples";
import { car_paints, color, tones } from "../theme/palette";
import { parked_car_geometry, parked_cars, soup_geometry, town_materials } from "../world/buildings";
import { lamp_kit, lamps } from "../world/road-lights";
import { item_geometry, item_material, JumpsView } from "../world/jumps";
import { COMPACT } from "../worldgen/chunk-grid";
import { ITEMS } from "../worldgen/jumps";
import { town_builders, town_meshes, type MeshTones } from "../worldgen/chunks";
import { KINDS, plain_map, snow_of } from "../worldgen/kinds/kinds";
import type { Recipe } from "../worldgen/recipe";
import { PropKind, WorldKind, type Building, type ItemKind, type Lot, type WorldData } from "../worldgen/types";
import { WORLDS } from "../worlds/worlds";
import type { AssetKind } from "./assets";
import type { ViewState } from "./view-state";
import {
  all_worlds,
  building_picks,
  ground_picks,
  is_prop_kind,
  land_worlds,
  prop_kinds,
  ramp_picks,
  stood_building,
  stood_lot,
  stood_ramp,
  tree_kinds,
  tree_of,
  TREE_NAMES,
  world_data,
  type ItemPick,
} from "./world-items";

export interface AssetLook {
  worlds: () => readonly WorldKind[];
  items: (world: WorldKind, seed: number) => ItemPick[];
  build: (view: ViewState) => THREE.Object3D | null;
}

const ONE_TREE = [[0, 0, 1]] as const;
const matte = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const none = () => [];

const snowy = (world: WorldKind, seed: number) => snow_of(plain_map(world, seed)) !== null;
const tones_of = (world: WorldKind, seed: number): MeshTones => mesh_tones(snowy(world, seed), WORLDS[world].upland, WORLDS[world].deck);

interface Fitted {
  build: Build;
  spec: CarSpec;
  d: Design;
  paint: THREE.Color;
  trim: THREE.Color;
}

// As `car_view` fits the design to a build: the kit's shell over the stock one when the aero part fits skirts.
function fitted(view: ViewState): Fitted | null {
  const build = parse_build(view.code);
  if (!build) return null;
  const spec = build_spec(build);
  const paint = color(paint_lab(build.paint));
  const trim = color(tones.trim);
  return { build, spec, d: fitted_design(spec, build.parts, paint, trim).d, paint, trim };
}

// Where the car's root and body hold it, so a pin and a camera on the part land on the same spot of the fitted car.
function on_body(spec: CarSpec, geometries: THREE.BufferGeometry[], d: Design): THREE.Object3D {
  const root = new THREE.Group();
  root.position.y = ride_height(spec);
  if (!geometries.length) return root;
  const body = new THREE.Group();
  body.position.y = body_y(spec);
  const mesh = new THREE.Mesh(sculpt(merge(geometries), d), matte());
  mesh.castShadow = true;
  body.add(mesh);
  root.add(body);
  return root;
}

function part(geometries: (f: Fitted) => THREE.BufferGeometry[]): AssetLook["build"] {
  return (view) => {
    const f = fitted(view);
    return f && on_body(f.spec, geometries(f), f.d);
  };
}

function arch_lips(f: Fitted): THREE.BufferGeometry[] {
  const { lips, walls } = flares(f.d, f.spec);
  return [...lips.map((g) => tint(g, f.d.arches.tone === "paint" ? f.paint : f.trim)), ...walls.map((g) => tint(g, color(tones.glass)))];
}

function wheels(view: ViewState): THREE.Object3D | null {
  const build = parse_build(view.code);
  if (!build) return null;
  const spec = build_spec(build);
  const car = build_view(build, spec);
  rest_wheels(car, spec);
  const root = new THREE.Group();
  root.position.y = ride_height(spec);
  const left = car.wheels.filter((_, i) => spec.wheel.mounts[i][0] > 0);
  root.add(...left);
  dispose_car_view(car);
  return root;
}

function town_piece(data: WorldData, parts: { buildings: Building[]; lots: Lot[] }, tones: MeshTones): THREE.Object3D {
  const town = town_builders(data, { ...parts, props: [], parking: [] }, tones, () => 0, () => 0).get(0);
  const { buildings, glass, parking } = town_meshes(town);
  const materials = town_materials(data.kind);
  const group = new THREE.Group();
  if (buildings) {
    const geometry = soup_geometry(buildings);
    if (buildings.fill) geometry.setAttribute("fill", new THREE.BufferAttribute(buildings.fill, 1, true));
    group.add(new THREE.Mesh(geometry, materials.building));
  }
  if (glass) group.add(new THREE.Mesh(soup_geometry(glass), materials.glass));
  if (parking) group.add(new THREE.Mesh(soup_geometry(parking), materials.parking));
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) node.receiveShadow = true;
  });
  return group;
}

function world_of(view: ViewState) {
  const asset = view.asset;
  return asset && "world" in asset ? asset : null;
}

function loose_item(kind: ItemKind): THREE.Object3D {
  const mesh = new THREE.Mesh(item_geometry(kind), item_material(kind));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// What a street or a track is dressed with, each from the geometry the game instances.
const STREET: Record<string, () => THREE.Object3D> = {
  ...Object.fromEntries((Object.keys(ITEMS) as ItemKind[]).map((kind) => [kind, () => loose_item(kind)])),
  parked_car: () => parked_cars([{ x: 0, y: 0, z: 0, heading: 0, paint: color(car_paints[0]) }], parked_car_geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
  street_light: () => new THREE.Group().add(...lamps(lamp_kit(), PropKind.STREET_LIGHT, [{ x: 0, y: 0, z: 0, angle: 0 }])),
  road_lamp: () => new THREE.Group().add(...lamps(lamp_kit(), PropKind.ROAD_LAMP, [{ x: 0, y: 0, z: 0, angle: 0 }])),
};

const PARTS: Omit<AssetLook, "build"> = { worlds: none, items: none };

export const ASSET_LOOKS: Record<AssetKind, AssetLook> = {
  car: { ...PARTS, build: () => null },
  wheel: { ...PARTS, build: wheels },
  wing: { ...PARTS, build: part((f) => rear_wing(f.d, aero_of(f.build.parts), f.paint, f.trim)) },
  aero: { ...PARTS, build: part((f) => aero_parts(f.d, f.spec, aero_of(f.build.parts), f.paint, f.trim, detail_look(DETAILS[f.spec.body.style], f.build.parts, f.paint, f.trim).swaps)) },
  arches: { ...PARTS, build: part(arch_lips) },
  mirror: { ...PARTS, build: part((f) => [...parts(f.d.mirror?.paint ?? []).map((g) => tint(g, f.paint)), ...parts(f.d.mirror?.trim ?? []).map((g) => tint(g, f.trim))]) },
  building: {
    worlds: land_worlds,
    items: (world, seed) => building_picks(world_data(world, seed)),
    build: (view) => {
      const a = world_of(view);
      const data = a && world_data(a.world, a.seed);
      const b = data && stood_building(data, a.item);
      return a && data && b ? town_piece(data, { buildings: [b], lots: [] }, tones_of(a.world, a.seed)) : null;
    },
  },
  ground: {
    worlds: () => land_worlds().filter((world) => KINDS[world].recipe?.towns.style === "high_street"),
    items: (world, seed) => ground_picks(world_data(world, seed)),
    build: (view) => {
      const a = world_of(view);
      const data = a && world_data(a.world, a.seed);
      const lot = data && stood_lot(data, a.item);
      return a && data && lot ? town_piece(data, { buildings: [], lots: [lot] }, tones_of(a.world, a.seed)) : null;
    },
  },
  ramp: {
    worlds: all_worlds,
    items: (world, seed) => ramp_picks(world_data(world, seed)),
    build: (view) => {
      const a = world_of(view);
      const ramp = a && stood_ramp(world_data(a.world, a.seed), a.item);
      return ramp ? new JumpsView({ ramps: [ramp], items: [], challenges: [] }, () => 0, COMPACT).root : null;
    },
  },
  tree: {
    worlds: () => land_worlds().filter((world) => recipe_kinds(world, tree_kinds).length),
    items: (world) => recipe_kinds(world, tree_kinds).map((kind) => ({ id: TREE_NAMES[kind], label: TREE_NAMES[kind] })),
    build: (view) => {
      const a = world_of(view);
      const kind = a && tree_of(a.item);
      return a && kind !== null ? tree_sample(kind, snowy(a.world, 1), WORLDS[a.world].kit.trees, ONE_TREE) : null;
    },
  },
  prop: {
    worlds: () => land_worlds().filter((world) => recipe_kinds(world, prop_kinds).length),
    items: (world) => recipe_kinds(world, prop_kinds).map((kind) => ({ id: kind, label: kind.replace("_", " ") })),
    build: (view) => {
      const a = world_of(view);
      return a && is_prop_kind(a.item) ? prop_sample(a.item, snowy(a.world, 1)) : null;
    },
  },
  piece: {
    worlds: () => all_worlds().filter((world) => WORLDS[world].kit.pieces.length),
    items: (world) => WORLDS[world].kit.pieces.map((piece) => ({ id: piece, label: piece.replace("_", " ") })),
    build: (view) => {
      const a = world_of(view);
      const piece = a && WORLDS[a.world].kit.pieces.find((p): p is Piece => p === a.item);
      return a && piece ? new THREE.Group().add(...kit_sample(piece, snowy(a.world, 1))) : null;
    },
  },
  item: {
    worlds: () => [WorldKind.MAINLAND],
    items: () => Object.keys(STREET).map((id) => ({ id, label: id.replace("_", " ") })),
    build: (view) => {
      const a = world_of(view);
      return a && Object.hasOwn(STREET, a.item) ? STREET[a.item]() : null;
    },
  },
};

function recipe_kinds<T>(world: WorldKind, of: (recipe: Recipe) => T[]): T[] {
  const recipe = KINDS[world].recipe;
  return recipe ? of(recipe) : [];
}
