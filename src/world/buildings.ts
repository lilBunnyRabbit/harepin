import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { car_paints, color, dark, glow, tones } from "../theme/palette";
import { cast_instanced } from "../render/shadow-depth";
import type { World } from "./world";
import { chunk_of, type Extent } from "../worldgen/chunk-grid";
import type { ChunkBuffers, Soup } from "../worldgen/chunks";
import { Builder, type Rgb, type Sphere } from "../worldgen/mesh";
import { KINDS } from "../worldgen/kinds/kinds";
import { hash } from "../worldgen/noise";
import { LIFT } from "../worldgen/lifts";
import { PropKind, type Prop, type WorldKind } from "../worldgen/types";

const PAD_LIFT = LIFT.pad;
// Lit from inside: a dusk street reads by its shop windows, a day street by glass that stays bright in shade.
const GLASS_GLOW = dark ? 0.55 : 0.3;

function geometry(builder: Builder): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(builder.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(builder.colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function soup_geometry({ positions, colors, sphere }: Pick<Soup, "positions" | "sphere"> & { colors?: Float32Array }): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.boundingSphere = sphere_of(sphere);
  return geometry;
}

function sphere_of([x, y, z, r]: Sphere): THREE.Sphere {
  return new THREE.Sphere(new THREE.Vector3(x, y, z), r);
}

export interface ParkedCar {
  x: number;
  y: number;
  z: number;
  heading: number;
  paint: THREE.Color;
}

interface ParkedSpot {
  x: number;
  z: number;
  heading: number;
  paint: THREE.Color;
}

function parked_spots(world: World): ParkedSpot[] {
  return world.parking
    .flatMap((lot) => lot.obstacles.filter((o) => o.kind === "car").map((o) => ({ lot, o })))
    .map(({ lot, o }, i) => {
      const frame = world.lots[lot.lot];
      const x = frame.x + frame.fz * o.x + frame.fx * o.z;
      const z = frame.z - frame.fx * o.x + frame.fz * o.z;
      return { x, z, heading: frame.angle + o.heading, paint: color(car_paints[Math.floor(hash(lot.lot, i, world.seed + 63) * car_paints.length)]) };
    });
}

/** Side profile of a parked car, nose to tail over the roof: metres along it (front +) and up. */
const CAR_PROFILE: readonly (readonly [number, number])[] = [
  [2.25, 0.14],
  [2.25, 0.72],
  [0.85, 0.95],
  [0.2, 1.4],
  [-1.45, 1.4],
  [-2.25, 0.95],
  [-2.25, 0.14],
];
const CAR_HW = 0.95;
const ROOF_HW = 0.72;
/** Share of the paint a glass face keeps: the instance colour tints the whole shape, so glass is the paint near black. */
const CAR_GLASS = 0.16;

// One shell: the profile swept across the car, the roof narrower than the body so the glass leans in.
export function parked_car_geometry(): THREE.BufferGeometry {
  const shape = new Builder();
  const paint: Rgb = [1, 1, 1];
  const glass: Rgb = [CAR_GLASS, CAR_GLASS, CAR_GLASS];
  const at = (i: number, side: number): [number, number, number] => [side * (i === 3 || i === 4 ? ROOF_HW : CAR_HW), CAR_PROFILE[i][1], CAR_PROFILE[i][0]];
  for (let i = 0; i < CAR_PROFILE.length - 1; i++) shape.quad(at(i, -1), at(i, 1), at(i + 1, 1), at(i + 1, -1), i === 2 || i === 4 ? glass : paint);
  for (const side of [1, -1]) {
    const face = (a: number, b: number, c: number, rgb: Rgb) => (side > 0 ? shape.tri(at(a, side), at(b, side), at(c, side), rgb) : shape.tri(at(a, side), at(c, side), at(b, side), rgb));
    face(0, 6, 5, paint);
    face(0, 5, 2, paint);
    face(0, 2, 1, paint);
    face(2, 5, 4, glass);
    face(2, 4, 3, glass);
  }
  return geometry(shape);
}

export function parked_cars(cars: ParkedCar[], shape: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(shape, material, Math.max(1, cars.length));
  mesh.count = cars.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  cars.forEach((car, i) => {
    mesh.setMatrixAt(i, m.compose(p.set(car.x, car.y, car.z), q.setFromAxisAngle(up, car.heading), s));
    mesh.setColorAt(i, car.paint);
  });
  cast_instanced(mesh);
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function light_parts(): [THREE.BufferGeometry, THREE.Material][] {
  // Open ends: the foot is in the ground, and the pole stops inside the arm, which closes its top.
  const pole = new THREE.CylinderGeometry(0.05, 0.12, 5.9, 5, 1, true).translate(0, 2.95, 0);
  const arm = new THREE.BoxGeometry(0.08, 0.08, 1.4).translate(0, 5.9, 0.65);
  const head = new THREE.BoxGeometry(0.3, 0.12, 0.5).translate(0, 5.82, 1.3);
  return [
    [mergeGeometries([pole, arm]), new THREE.MeshLambertMaterial({ color: color(tones.post), flatShading: true })],
    [head, new THREE.MeshLambertMaterial({ color: color(tones.head), emissive: glow(tones.head), emissiveIntensity: 1.2 })],
  ];
}

export function street_lights(props: Prop[], parts: [THREE.BufferGeometry, THREE.Material][]): THREE.InstancedMesh[] {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  return parts.map(([geometry, material]) => {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, props.length));
    mesh.count = props.length;
    props.forEach((prop, i) => mesh.setMatrixAt(i, m.compose(p.set(prop.x, prop.y, prop.z), q.setFromAxisAngle(up, prop.angle), s)));
    cast_instanced(mesh);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  });
}

export interface TownChunk {
  readonly objects: THREE.Object3D[];
  /** Far: only buildings of SMALL_BUILDING and up, no glass below that, no parking, parked cars or lights. */
  far(on: boolean): void;
  /** Frees what this chunk owns (its building, glass and parking soups, its instances), not the shared kit. */
  dispose(): void;
}

export function by_chunk<T extends { x: number; z: number }>(items: T[], ext: Extent): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const key = chunk_of(item.x, item.z, ext);
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

// Lambert leaves a wall facing away from the sun near black, so one box read as two materials: each face keeps this
// share of its own colour in shade. Glass keeps more, or a shaded window reads as a grey panel.
const WALL_FILL = dark ? 0.1 : 0.18;
const GLASS_FILL = dark ? 0.1 : 0.5;

function shade_fill<M extends THREE.Material>(material: M, share: number): M {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${share.toFixed(2)};`);
  };
  material.customProgramCacheKey = () => `shade_fill:${share}`;
  return material;
}

// The town soup also holds roofs, awnings, stalls and landmarks: only facade vertices (the chunk's `fill`) keep the share.
function facade_fill<M extends THREE.Material>(material: M, share: number): M {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float fill;\nvarying float v_fill;")
      .replace("#include <color_vertex>", "#include <color_vertex>\nv_fill = fill;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float v_fill;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${share.toFixed(2)} * v_fill;`);
  };
  material.customProgramCacheKey = () => `facade_fill:${share}`;
  return material;
}

export interface TownMaterials {
  building: THREE.MeshLambertMaterial;
  glass: THREE.MeshLambertMaterial;
  parking: THREE.MeshLambertMaterial;
}

export function town_materials(kind: WorldKind): TownMaterials {
  const building = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  // Glass sits 3-8 cm off its wall; past ~200 m the depth buffer steps wider than that, so the offset holds it in front.
  const glass = new THREE.MeshLambertMaterial({ color: color(tones.shopfront), emissive: color(tones.shop_glow), emissiveIntensity: GLASS_GLOW, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const parking = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (KINDS[kind].recipe?.towns.style === "high_street") {
    facade_fill(building, WALL_FILL);
    shade_fill(glass, GLASS_FILL);
  }
  return { building, glass, parking };
}

/** Builds a chunk's town objects when it arrives: parked cars stand on its terrain, which arrives with it. */
export class TownChunks {
  private readonly building: THREE.MeshLambertMaterial;
  private readonly glass: THREE.MeshLambertMaterial;
  private readonly parking: THREE.MeshLambertMaterial;
  private readonly car_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly car_shape = parked_car_geometry();
  private readonly parts = light_parts();
  private readonly cars: Map<number, ParkedSpot[]>;
  private readonly lights: Map<number, Prop[]>;

  constructor(private readonly world: World) {
    ({ building: this.building, glass: this.glass, parking: this.parking } = town_materials(world.kind));
    this.cars = by_chunk(parked_spots(world), world.tiles.ext);
    this.lights = by_chunk(world.props.filter((p) => p.kind === PropKind.STREET_LIGHT), world.tiles.ext);
  }

  build(chunk: ChunkBuffers): TownChunk | undefined {
    const here_cars = this.cars.get(chunk.index) ?? [];
    const here_lights = this.lights.get(chunk.index) ?? [];
    if (!chunk.buildings && !chunk.parking && !here_cars.length && !here_lights.length) return undefined;
    const objects: THREE.Object3D[] = [];
    const near: THREE.Object3D[] = [];
    const ranged: [THREE.BufferGeometry, number][] = [];
    if (chunk.buildings) {
      const geometry = soup_geometry(chunk.buildings);
      if (chunk.buildings.fill) geometry.setAttribute("fill", new THREE.BufferAttribute(chunk.buildings.fill, 1, true));
      const mesh = new THREE.Mesh(geometry, this.building);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      objects.push(mesh);
      ranged.push([mesh.geometry, chunk.buildings.big]);
    }
    if (chunk.glass) {
      const mesh = new THREE.Mesh(soup_geometry(chunk.glass), this.glass);
      mesh.receiveShadow = true;
      objects.push(mesh);
      ranged.push([mesh.geometry, chunk.glass.big]);
    }
    if (chunk.parking) {
      const mesh = new THREE.Mesh(soup_geometry(chunk.parking), this.parking);
      mesh.receiveShadow = true;
      near.push(mesh);
    }
    const cars = here_cars.map((car) => ({ ...car, y: this.world.height(car.x, car.z) + PAD_LIFT }));
    if (cars.length) near.push(parked_cars(cars, this.car_shape, this.car_material));
    if (here_lights.length) near.push(...street_lights(here_lights, this.parts));
    objects.push(...near);
    return {
      objects,
      far(on) {
        for (const [geometry, big] of ranged) geometry.setDrawRange(0, on ? big : Infinity);
        for (const object of near) object.visible = !on;
      },
      dispose() {
        for (const object of objects) {
          if (object instanceof THREE.InstancedMesh) object.dispose();
          else if (object instanceof THREE.Mesh) object.geometry.dispose();
        }
      },
    };
  }
}
