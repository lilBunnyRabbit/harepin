import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { car_paints, color, dark, tones } from "./palette";
import type { World } from "./world";
import { chunk_of, type ChunkBuffers, type Soup } from "./worldgen/chunks";
import { Builder, type Rgb, type Sphere } from "./worldgen/mesh";
import { hash } from "./worldgen/noise";
import type { Prop } from "./worldgen/types";

const PAD_LIFT = 0.06;
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

function parked_car_list(world: World): ParkedCar[] {
  return world.parking
    .flatMap((lot) => lot.obstacles.filter((o) => o.kind === "car").map((o) => ({ lot, o })))
    .map(({ lot, o }, i) => {
      const frame = world.lots[lot.lot];
      const x = frame.x + frame.fz * o.x + frame.fx * o.z;
      const z = frame.z - frame.fx * o.x + frame.fz * o.z;
      return { x, y: world.height(x, z) + PAD_LIFT, z, heading: frame.angle + o.heading, paint: color(car_paints[Math.floor(hash(lot.lot, i, world.seed + 63) * car_paints.length)]) };
    });
}

export function parked_car_geometry(): THREE.BufferGeometry {
  const shape = new Builder();
  const white: Rgb = [1, 1, 1];
  shape.walls(0.95, 2.25, 0.25, 0.95, white);
  shape.top(0.95, 2.25, 0.95, white);
  shape.at({ x: 0, y: 0, z: -0.3, fx: 0, fz: 1 }).walls(0.8, 1.1, 0.95, 1.4, white);
  shape.top(0.8, 1.1, 1.4, white);
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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function light_parts(): [THREE.BufferGeometry, THREE.Material][] {
  const pole = new THREE.CylinderGeometry(0.08, 0.12, 6, 5).translate(0, 3, 0);
  const arm = new THREE.BoxGeometry(0.08, 0.08, 1.4).translate(0, 5.9, 0.65);
  const head = new THREE.BoxGeometry(0.3, 0.12, 0.5).translate(0, 5.82, 1.3);
  return [
    [mergeGeometries([pole, arm]), new THREE.MeshLambertMaterial({ color: color(tones.post), flatShading: true })],
    [head, new THREE.MeshLambertMaterial({ color: color(tones.head), emissive: color(tones.head), emissiveIntensity: 0.6 })],
  ];
}

function street_lights(props: Prop[], parts: [THREE.BufferGeometry, THREE.Material][]): THREE.InstancedMesh[] {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  return parts.map(([geometry, material]) => {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, props.length));
    mesh.count = props.length;
    props.forEach((prop, i) => mesh.setMatrixAt(i, m.compose(p.set(prop.x, prop.y, prop.z), q.setFromAxisAngle(up, prop.angle), s)));
    mesh.castShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  });
}

export interface TownChunk {
  readonly objects: THREE.Object3D[];
  /** Far: only buildings of SMALL_BUILDING and up, no glass below that, no parking, parked cars or lights. */
  far(on: boolean): void;
}

export function by_chunk<T extends { x: number; z: number }>(items: T[]): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const key = chunk_of(item.x, item.z);
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

export function town_chunks(world: World, chunks: ChunkBuffers[]): Map<number, TownChunk> {
  const building = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({ color: color(tones.shopfront), emissive: color(tones.shop_glow), emissiveIntensity: GLASS_GLOW, flatShading: true });
  const parking = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const car_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const car_shape = parked_car_geometry();
  const parts = light_parts();
  const cars = by_chunk(parked_car_list(world));
  const lights = by_chunk(world.props);
  const out = new Map<number, TownChunk>();
  for (const chunk of chunks) {
    const here_cars = cars.get(chunk.index) ?? [];
    const here_lights = lights.get(chunk.index) ?? [];
    if (!chunk.buildings && !chunk.parking && !here_cars.length && !here_lights.length) continue;
    const objects: THREE.Object3D[] = [];
    const near: THREE.Object3D[] = [];
    const ranged: [THREE.BufferGeometry, number][] = [];
    if (chunk.buildings) {
      const mesh = new THREE.Mesh(soup_geometry(chunk.buildings), building);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      objects.push(mesh);
      ranged.push([mesh.geometry, chunk.buildings.big]);
    }
    if (chunk.glass) {
      const mesh = new THREE.Mesh(soup_geometry(chunk.glass), glass);
      mesh.receiveShadow = true;
      objects.push(mesh);
      ranged.push([mesh.geometry, chunk.glass.big]);
    }
    if (chunk.parking) {
      const mesh = new THREE.Mesh(soup_geometry(chunk.parking), parking);
      mesh.receiveShadow = true;
      near.push(mesh);
    }
    if (here_cars.length) near.push(parked_cars(here_cars, car_shape, car_material));
    if (here_lights.length) near.push(...street_lights(here_lights, parts));
    objects.push(...near);
    out.set(chunk.index, {
      objects,
      far(on) {
        for (const [geometry, big] of ranged) geometry.setDrawRange(0, on ? big : Infinity);
        for (const object of near) object.visible = !on;
      },
    });
  }
  return out;
}
