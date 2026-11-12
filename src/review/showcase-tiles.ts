import * as THREE from "three";
import { DECALS, DEFAULT_BUILD, MAX_PAINT, REWARD_PAINTS, build_spec, type Build } from "../car/build";
import { CARS, is_car, type CarId } from "../car/cars";
import { build_view, rest_wheels } from "../car/models";
import { gate_kit, gate_view } from "../car/trackside";
import { TIERS } from "../career/career";
import { MarkerView } from "../career/marker-view";
import { kit_sample } from "../render/prop-kit";
import { mesh_tones, tree_kit, tree_meshes } from "../render/scene";
import { charred_kit, type TreeLook } from "../render/snags";
import { brand, car_paints, color, mix, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { LandmarksView } from "../world/landmarks";
import { soup_geometry } from "../world/buildings";
import { TreeKind } from "../worldgen/biomes";
import { KINDS, plain_map, snow_of } from "../worldgen/kinds/kinds";
import { landmark_mesh } from "../worldgen/landmark-mesh";
import { Builder } from "../worldgen/mesh";
import type { Landmark, Recipe } from "../worldgen/recipe";
import { soup } from "../worldgen/chunks";
import { N, PropKind, type Prop, type Tree } from "../worldgen/types";
import type { Sheet } from "./catalog";

export interface Tile {
  label: string;
  object: THREE.Object3D;
  ground: Lab;
  /** Degrees, camera bearing from the object's nose; `pitch` is its elevation. */
  yaw: number;
  pitch: number;
}

export interface SheetLayout {
  tiles: Tile[];
  /** Columns on every screen: a row reads as one object turned. Null fits as many as the width takes. */
  columns: number | null;
  /** One camera distance for the whole sheet, so sizes compare; else each tile fills its frame. */
  same_scale: boolean;
}

const TURNTABLE: readonly [string, number, number][] = [
  ["3/4 front", 35, 12],
  ["side", 90, 5],
  ["3/4 rear", 150, 14],
  ["top", 25, 60],
];
const FRONT_34 = { yaw: 35, pitch: 14 };
const SHOWROOM = "coupe";
const METALS = ["Bronze", "Silver", "Gold"];
const LANDMARK_PROPS: Record<Landmark, PropKind> = { mast: PropKind.MAST, lighthouse: PropKind.LIGHTHOUSE, turbines: PropKind.TURBINE, arch: PropKind.ARCH };
const ARCH_HALF = 10;
const TREE_SPOTS: readonly [number, number, number][] = [
  [0, 0, 1.1],
  [4.5, 3, 0.85],
  [-4, 2.5, 0.95],
];
const FLAT = new Float32Array((N + 1) * (N + 1));
const prop_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const CAR_IDS = Object.keys(CARS).filter(is_car);

function car(build: Partial<Build>): THREE.Object3D {
  const full = { ...DEFAULT_BUILD, ...build };
  const spec = build_spec(full);
  const view = build_view(full, spec);
  // A fresh view's wheels sit at the car's origin until the sim places them; rest them on their mounts.
  rest_wheels(view, spec);
  const box = new THREE.Box3().setFromObject(view.root);
  view.root.position.y = -box.min.y;
  const holder = new THREE.Group();
  holder.add(view.root);
  return holder;
}

const paint_name = (paint: number) => (paint > MAX_PAINT ? `${METALS[paint - MAX_PAINT - 1]} metallic` : `paint ${paint}`);

function turntable(ids: readonly CarId[]): SheetLayout {
  const tiles = ids.flatMap((id) => TURNTABLE.map(([angle, yaw, pitch]) => ({ label: `${id} · ${angle}`, object: car({ car: id }), ground: tones.asphalt, yaw, pitch })));
  return { tiles, columns: TURNTABLE.length, same_scale: true };
}

// The bus is three cars long, so on one scale with it every other car is a thumbnail.
const BIG = new Set<CarId>(["bus"]);
const cars = () => turntable(CAR_IDS);
const lineup = () => turntable(CAR_IDS.filter((id) => !BIG.has(id)));

function paints(): SheetLayout {
  const indices = [...car_paints.keys(), ...Array.from({ length: REWARD_PAINTS }, (_, i) => MAX_PAINT + 1 + i)];
  return { tiles: indices.map((paint) => ({ label: paint_name(paint), object: car({ car: SHOWROOM, paint }), ground: tones.asphalt, ...FRONT_34 })), columns: null, same_scale: false };
}

function decals(): SheetLayout {
  const tiles = CAR_IDS.flatMap((id) => DECALS.map((decal, index) => ({ label: `${id} · ${decal}`, object: car({ car: id, decal: index }), ground: tones.asphalt, yaw: 40, pitch: 30 })));
  return { tiles, columns: DECALS.length / 2, same_scale: false };
}

function trees(kind: TreeKind, snowy: boolean, look: TreeLook): THREE.Object3D {
  const group = new THREE.Group();
  const here: Tree[] = TREE_SPOTS.map(([x, z, scale]) => ({ x, y: 0, z, scale, kind }));
  group.add(...tree_meshes(look === "charred" ? charred_kit() : tree_kit(snowy), here, null));
  return group;
}

function prop(kind: PropKind, snowy: boolean): THREE.Object3D {
  const placed: Prop = { x: 0, y: 0, z: 0, angle: 0, kind, scale: kind === PropKind.ARCH ? ARCH_HALF : 1 };
  const builder = new Builder();
  landmark_mesh(builder, placed, FLAT, mesh_tones(snowy).landmark);
  const group = new THREE.Group();
  const shell = soup([builder]);
  if (shell) {
    const mesh = new THREE.Mesh(soup_geometry(shell), prop_material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.add(new LandmarksView([placed]).root);
  return group;
}

function tree_kinds(recipe: Recipe): TreeKind[] {
  const rules = Object.values(recipe.biomes.rules).filter((rule) => rule.fill > 0);
  const kinds: TreeKind[] = [];
  if (rules.some((rule) => rule.pine > 0)) kinds.push(TreeKind.PINE);
  if (rules.some((rule) => rule.pine + rule.scrub < 1)) kinds.push(TreeKind.BROADLEAF);
  if (rules.some((rule) => rule.scrub > 0)) kinds.push(TreeKind.SCRUB);
  return kinds;
}

const TREE_NAMES: Record<TreeKind, string> = { [TreeKind.PINE]: "pine", [TreeKind.BROADLEAF]: "broadleaf", [TreeKind.SCRUB]: "scrub" };

function biomes(): SheetLayout {
  const tiles: Tile[] = [];
  for (const def of Object.values(KINDS)) {
    const recipe = def.recipe;
    if (!recipe) continue;
    const snowy = snow_of(plain_map(def.kind, 1)) !== null;
    const growing = tree_kinds(recipe);
    const ground = snowy ? tones.snow : growing.length ? tones.grass : tones.sand;
    const kit = WORLDS[def.kind].kit;
    for (const kind of growing) tiles.push({ label: `${def.kind} · ${TREE_NAMES[kind]}`, object: trees(kind, snowy, kit.trees), ground, ...FRONT_34 });
    const props = new Set([...recipe.landmarks.map((landmark) => LANDMARK_PROPS[landmark]), ...recipe.scatter.map((rule) => rule.kind)]);
    for (const kind of props) tiles.push({ label: `${def.kind} · ${kind.replace("_", " ")}`, object: prop(kind, snowy), ground, ...FRONT_34 });
  }
    for (const piece of kit.pieces) tiles.push({ label: `${def.kind} · ${piece.replace("_", " ")}`, object: new THREE.Group().add(...kit_sample(piece, snowy)), ground, ...FRONT_34 });
  return { tiles, columns: null, same_scale: false };
}

function flag(tier: number, open: boolean): THREE.Object3D {
  const event = TIERS[tier].events[0];
  const view = new MarkerView([{ event, x: 0, z: 0, heading: 0, tier }], () => 0);
  view.show(() => open);
  return view.root;
}

function gate(start: boolean, lit: boolean): THREE.Object3D {
  const { group, material } = gate_view(gate_kit(), start);
  if (lit) {
    // As main.ts lights the next gate, at its pulse's middle.
    material.color.copy(color(brand.accent));
    material.emissive.copy(color(brand.accent)).multiplyScalar(0.55);
  }
  return group;
}

function track(): SheetLayout {
  const road = mix(tones.asphalt, tones.grass, 0.15);
  const tiles: Tile[] = TIERS.map((tier, i) => ({ label: `flag · ${tier.name}`, object: flag(i, true), ground: road, ...FRONT_34 }));
  tiles.push({ label: "flag · locked", object: flag(0, false), ground: road, ...FRONT_34 });
  tiles.push({ label: "gate", object: gate(false, false), ground: road, yaw: 20, pitch: 10 });
  tiles.push({ label: "gate · next", object: gate(false, true), ground: road, yaw: 20, pitch: 10 });
  tiles.push({ label: "gate · start", object: gate(true, false), ground: road, yaw: 20, pitch: 10 });
  return { tiles, columns: null, same_scale: false };
}

export const SHEET_LAYOUTS: Record<Sheet, () => SheetLayout> = { cars, lineup, paints, decals, biomes, track };
