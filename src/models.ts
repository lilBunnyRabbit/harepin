import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rest_reach, type Car } from "./car";
import type { Level } from "./build";
import { COUPE, type BodyStyle, type CarSpec, type Triple } from "./cars";
import { brand, color, dark, mix, tones } from "./palette";
import { ribbon } from "./scene";
import { ROAD_HALF, World } from "./world";

export interface Gate {
  group: THREE.Group;
  material: THREE.MeshLambertMaterial;
}

export function gates(world: World): Gate[] {
  const frame = merge(
    [-1, 1].map((side) => new THREE.BoxGeometry(0.7, 6.4, 0.7).translate(side * (ROAD_HALF + 1.7), 3.2, 0)),
    new THREE.BoxGeometry(ROAD_HALF * 2 + 3.4, 0.5, 0.5).translate(0, 6.2, 0),
  );
  const columns = 14;
  const tiles: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < columns; col++) {
      const tile = new THREE.BoxGeometry(1, 0.55, 0.3).translate((col - (columns - 1) / 2) * 1, 6.9 + row * 0.55, 0);
      tiles.push(tint(tile, color((row + col) % 2 ? tones.check_dark : tones.check_light)));
    }
  const checker = new THREE.Mesh(merge(...tiles), new THREE.MeshLambertMaterial({ vertexColors: true }));
  return world.checkpoints.map((cp, index) => {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color: color(tones.gate), emissive: new THREE.Color(0, 0, 0) });
    const mesh = new THREE.Mesh(frame, material);
    mesh.castShadow = true;
    group.add(mesh);
    if (index === 0) group.add(checker);
    group.position.set(cp.x, world.height(cp.x, cp.z), cp.z);
    group.rotation.y = cp.heading;
    return { group, material };
  });
}

function curvature(world: World, s: number): number {
  const road = world.road;
  const a = road[(s - 6 + road.length) % road.length];
  const b = road[(s + 6) % road.length];
  return Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz);
}

const MOUTH_MARGIN = 3;

// Ring samples where a spur leaves the loop; curbs and posts there would wall off the side road.
function mouths(world: World): Set<number> {
  const clear = new Set<number>();
  for (const node of world.graph.nodes) {
    if (node.kind !== "junction") continue;
    const spurs = world.graph.edges.filter((e) => !e.closed && (e.a === node.id || e.b === node.id));
    if (!spurs.length) continue;
    const reach = Math.max(...spurs.map((e) => e.half)) + MOUTH_MARGIN;
    world.road.forEach((p, s) => {
      if (Math.hypot(p.x - node.x, p.z - node.z) < reach + ROAD_HALF) clear.add(s);
    });
  }
  return clear;
}

export function roadside(world: World): THREE.Object3D {
  const group = new THREE.Group();
  const clear = mouths(world);
  const inside = new Map<number, number>();
  for (let s = 0; s < world.road.length; s++) {
    const k = curvature(world, s);
    if (Math.abs(k) > 0.09) inside.set(s, Math.sign(k));
  }
  for (const [tone, parity] of [
    [brand.accent, 0],
    [tones.check_light, 1],
  ] as const) {
    for (const side of [-1, 1]) {
      const from = side > 0 ? ROAD_HALF - 0.1 : -ROAD_HALF - 0.9;
      const to = side > 0 ? ROAD_HALF + 0.9 : -ROAD_HALF + 0.1;
      // Positive curvature bends toward the +side offset, so matching signs put the curb on the inside of the bend.
      group.add(ribbon(world, from, to, 0.12, (s) => inside.get(s) === side && s % 2 === parity && !clear.has(s), color(tone), -5));
    }
  }

  const spacing = 12;
  const count = Math.ceil(world.road.length / spacing) * 2;
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 1.0, 0.14).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ color: color(tones.post) }),
    count,
  );
  const reflector = color(tones.head);
  const caps = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.16).translate(0, 1.05, 0),
    new THREE.MeshLambertMaterial({ color: reflector, emissive: reflector, emissiveIntensity: 0.9 }),
    count,
  );
  const m = new THREE.Matrix4();
  let n = 0;
  for (let s = 0; s < world.road.length; s += spacing) {
    if (clear.has(s)) continue;
    const p = world.road[s];
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + 1.6);
      const x = p.x - p.tz * off;
      const z = p.z + p.tx * off;
      m.makeTranslation(x, world.height(x, z), z);
      posts.setMatrixAt(n, m);
      caps.setMatrixAt(n, m);
      n++;
    }
  }
  posts.count = caps.count = n;
  posts.castShadow = true;
  group.add(posts, caps);
  return group;
}

function merge(...parts: (THREE.BufferGeometry | THREE.BufferGeometry[])[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts.flat().map((part) => (part.index ? part.toNonIndexed() : part)));
  if (!geometry) throw new Error("mergeGeometries: parts have mismatched attributes");
  return geometry;
}

function tint(geometry: THREE.BufferGeometry, tone: THREE.Color): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const colors = new Float32Array(flat.getAttribute("position").count * 3);
  for (let i = 0; i < colors.length; i += 3) tone.toArray(colors, i);
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

function extrude(profile: [number, number][], width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  return geometry.translate(0, 0, -width / 2).rotateY(-Math.PI / 2);
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

export interface CarView {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Group[];
  brake: THREE.MeshLambertMaterial;
  /** Headlamp lenses; hidden from the hood camera, which sits right behind them. */
  heads: THREE.Mesh;
}

type Point = [number, number];

interface Profile {
  points: Point[];
  width: number;
}

/** Side profiles are [z, y] from the ground at rest, +z forward; lamps are [x, y, z] for the left one. */
interface Shape {
  body: Profile;
  trim: Profile;
  glass: Profile;
  roof: Profile;
  head: Triple;
  tail: Triple;
  /** Where a bolt-on wing sits: rear deck or roof edge, [z, y]. */
  deck: Point;
  tyre: number;
  extras(paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[];
}

const mirrors = (x: number, y: number, z: number, paint: THREE.Color) => [-1, 1].map((side) => tint(box(0.16, 0.1, 0.2, side * x, y, z), paint));

const SHAPES: Record<BodyStyle, Shape> = {
  coupe: {
    body: { points: [[-2.18, 0.3], [2.12, 0.3], [2.3, 0.4], [2.26, 0.56], [1.5, 0.7], [-1.75, 0.8], [-2.24, 0.74], [-2.3, 0.5]], width: 1.86 },
    trim: { points: [[-2.1, 0.2], [2.2, 0.2], [2.36, 0.33], [-2.2, 0.33]], width: 1.9 },
    glass: { points: [[1.42, 0.7], [0.42, 1.12], [-0.85, 1.15], [-1.7, 0.8]], width: 1.52 },
    roof: { points: [[0.3, 1.12], [-0.82, 1.15], [-0.88, 1.2], [0.22, 1.18]], width: 1.44 },
    head: [0.64, 0.55, 2.24],
    tail: [0.6, 0.68, -2.27],
    deck: [-2.0, 0.79],
    tyre: 0.3,
    extras: (paint, trim) => [...mirrors(0.98, 0.84, 0.86, paint), tint(box(1.0, 0.14, 0.04, 0, 0.42, 2.3), trim)],
  },
  hatch: {
    body: { points: [[-1.88, 0.28], [1.8, 0.28], [1.95, 0.38], [1.92, 0.55], [1.3, 0.72], [-1.85, 0.82], [-1.95, 0.6]], width: 1.7 },
    trim: { points: [[-1.85, 0.18], [1.85, 0.18], [1.98, 0.3], [-1.95, 0.3]], width: 1.74 },
    glass: { points: [[1.25, 0.72], [0.45, 1.18], [-1.55, 1.22], [-1.88, 0.84]], width: 1.48 },
    roof: { points: [[0.4, 1.18], [-1.5, 1.22], [-1.56, 1.27], [0.32, 1.24]], width: 1.4 },
    head: [0.56, 0.56, 1.9],
    tail: [0.6, 0.72, -1.94],
    deck: [-1.5, 1.17],
    tyre: 0.26,
    extras: (paint, trim) => [...mirrors(0.9, 0.86, 1.0, paint), tint(box(0.8, 0.14, 0.04, 0, 0.42, 1.96), trim)],
  },
  muscle: {
    body: { points: [[-2.42, 0.32], [2.4, 0.32], [2.52, 0.42], [2.48, 0.7], [0.9, 0.8], [-1.6, 0.84], [-2.45, 0.82], [-2.52, 0.55]], width: 1.96 },
    trim: { points: [[-2.4, 0.2], [2.45, 0.2], [2.56, 0.34], [-2.5, 0.34]], width: 2.0 },
    glass: { points: [[0.85, 0.8], [-0.1, 1.17], [-1.0, 1.19], [-1.65, 0.84]], width: 1.6 },
    roof: { points: [[-0.15, 1.17], [-0.95, 1.19], [-1.0, 1.24], [-0.2, 1.22]], width: 1.52 },
    head: [0.7, 0.6, 2.48],
    tail: [0.68, 0.72, -2.5],
    deck: [-2.2, 0.83],
    tyre: 0.36,
    extras: (paint, trim) => [
      ...mirrors(1.04, 0.9, 0.6, paint),
      tint(box(0.5, 0.1, 0.8, 0, 0.82, 1.5), paint),
      tint(box(0.36, 0.06, 0.04, 0, 0.84, 1.9), trim),
      tint(box(1.3, 0.16, 0.04, 0, 0.45, 2.55), trim),
    ],
  },
  rally: {
    body: { points: [[-2.1, 0.36], [2.05, 0.36], [2.2, 0.46], [2.16, 0.62], [1.35, 0.78], [-1.95, 0.86], [-2.2, 0.66]], width: 1.84 },
    trim: { points: [[-2.05, 0.22], [2.1, 0.22], [2.24, 0.38], [-2.15, 0.38]], width: 1.92 },
    glass: { points: [[1.3, 0.78], [0.4, 1.24], [-1.45, 1.28], [-1.95, 0.9]], width: 1.52 },
    roof: { points: [[0.35, 1.24], [-1.4, 1.28], [-1.46, 1.33], [0.27, 1.3]], width: 1.44 },
    head: [0.62, 0.6, 2.17],
    tail: [0.62, 0.76, -2.2],
    deck: [-1.42, 1.23],
    tyre: 0.3,
    extras: (paint, trim) => [
      ...mirrors(0.98, 0.9, 1.0, paint),
      tint(box(0.34, 0.1, 0.42, 0, 1.37, 0.05), trim),
      tint(box(1.2, 0.08, 0.08, 0, 1.38, 0.32), trim),
      ...[-1, 1].map((side) => tint(box(0.3, 0.22, 0.03, side * 0.82, 0.3, -1.68), trim)),
      tint(box(1.5, 0.08, 0.5, 0, 0.26, 1.9), trim),
    ],
  },
  kaze: {
    body: { points: [[-2.0, 0.3], [2.0, 0.3], [2.13, 0.4], [2.1, 0.53], [0.8, 0.7], [-1.82, 0.83], [-2.06, 0.81], [-2.12, 0.54]], width: 1.8 },
    trim: { points: [[-1.98, 0.2], [2.04, 0.2], [2.17, 0.34], [-2.1, 0.34]], width: 1.86 },
    glass: { points: [[0.78, 0.7], [-0.06, 1.19], [-0.72, 1.21], [-1.84, 0.83]], width: 1.44 },
    roof: { points: [[-0.12, 1.19], [-0.68, 1.21], [-0.74, 1.25], [-0.18, 1.23]], width: 1.36 },
    head: [0.64, 0.54, 2.08],
    tail: [0.62, 0.72, -2.09],
    deck: [-1.95, 0.82],
    tyre: 0.32,
    extras: (paint, trim) => [
      ...mirrors(0.94, 0.85, 0.62, paint),
      ...[-1, 1].map((side) => tint(box(0.12, 0.24, 1.1, side * 0.93, 0.6, -1.4), paint)),
      tint(box(1.2, 0.12, 0.04, 0, 0.38, 2.16), trim),
    ],
  },
};

function wing(level: Level, style: BodyStyle, width: number, [z, y]: Point, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  if (level === 0) {
    if (style !== "coupe") return [];
    return [tint(box(1.82, 0.05, 0.42, 0, 1.04, -2.02), paint), ...[-1, 1].map((side) => tint(box(0.06, 0.22, 0.14, side * 0.62, 0.9, -1.98), trim))];
  }
  const lift = level === 1 ? 0.24 : 0.4;
  const span = width * (level === 1 ? 0.92 : 1);
  const parts = [tint(box(span, level === 1 ? 0.05 : 0.07, level === 1 ? 0.36 : 0.44, 0, y + lift, z - 0.04), paint)];
  for (const side of [-1, 1]) {
    parts.push(tint(box(0.06, lift, 0.14, side * width * 0.32, y + lift / 2, z), trim));
    if (level === 2) parts.push(tint(box(0.04, 0.2, 0.48, (side * span) / 2, y + lift, z - 0.04), trim));
  }
  return parts;
}

// Paint, trim and glass are baked into vertex colours so the whole shell is one draw; a repaint rebuilds the view.
export function car_view(paint: THREE.Color, spec: CarSpec = COUPE, spoiler: Level = 0): CarView {
  const style = spec.body.style;
  const shape = SHAPES[style];
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -(rest_reach(spec) - spec.wheel.mounts[0][1]);
  const trim = color(tones.trim);

  const shell = merge(
    tint(extrude(shape.body.points, shape.body.width), paint),
    tint(extrude(shape.trim.points, shape.trim.width), trim),
    tint(extrude(shape.glass.points, shape.glass.width), color(tones.glass)),
    tint(extrude(shape.roof.points, shape.roof.width), paint),
    wing(spoiler, style, shape.body.width, shape.deck, paint, trim),
    shape.extras(paint, trim),
  );
  const hull = new THREE.Mesh(shell, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  hull.castShadow = true;

  const head = color(tones.head);
  const head_material = new THREE.MeshLambertMaterial({ color: head, emissive: head, emissiveIntensity: 1.2 });
  const tail = color(brand.error);
  const brake = new THREE.MeshLambertMaterial({ color: tail, emissive: tail, emissiveIntensity: 0.5 });
  const [hx, hy, hz] = shape.head;
  const [tx, ty, tz] = shape.tail;
  const heads = merge([-1, 1].map((side) => new THREE.BoxGeometry(0.46, 0.08, 0.1).rotateX(-0.25).translate(side * hx, hy, hz)));
  const tails = merge([-1, 1].map((side) => box(0.5, 0.1, 0.06, side * tx, ty, tz)));
  const head_mesh = new THREE.Mesh(heads, head_material);
  body.add(hull, head_mesh, new THREE.Mesh(tails, brake));
  root.add(body);

  const radius = spec.wheel.radius;
  const wheel = merge(
    tint(new THREE.CylinderGeometry(radius, radius, shape.tyre, 12).rotateZ(Math.PI / 2), color(tones.tyre)),
    tint(new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, shape.tyre + 0.02, 6).rotateZ(Math.PI / 2), color(mix(brand.foreground, brand.background_lightest, 0.6))),
  );
  const wheel_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wheels = [0, 1, 2, 3].map(() => {
    const steer = new THREE.Group();
    const spin = new THREE.Group();
    const mesh = new THREE.Mesh(wheel, wheel_material);
    mesh.castShadow = true;
    spin.add(mesh);
    steer.add(spin);
    root.add(steer);
    return steer;
  });
  return { root, body, wheels, brake, heads: head_mesh };
}

export function sync_car_view(view: CarView, car: Car) {
  view.root.position.copy(car.pos);
  view.root.quaternion.copy(car.quat);
  car.wheels.forEach((w, i) => {
    const g = view.wheels[i];
    g.position.set(w.mount.x, w.mount.y - (w.reach - car.spec.wheel.radius), w.mount.z);
    g.rotation.y = -w.angle;
    g.children[0].rotation.x = w.spin;
  });
  view.brake.emissiveIntensity = car.braking > 0.05 ? 2.2 : 0.5;
}

export function rest_wheels(view: CarView, spec: CarSpec = COUPE) {
  const drop = rest_reach(spec) - spec.wheel.radius;
  view.wheels.forEach((wheel, i) => {
    const [x, y, z] = spec.wheel.mounts[i];
    wheel.position.set(x, y - drop, z);
  });
}

// Ghost and remote cars have no collision, so one can pass right through the camera and fill the view.
const CAMERA_HIDE = 2.5;
const CAMERA_CLEAR = 6;

/** Opacity factor for a see-through car centred at `at`: 0 within `CAMERA_HIDE` metres of the camera, 1 from `CAMERA_CLEAR` out. */
export function camera_fade(at: THREE.Vector3, camera: THREE.Vector3): number {
  const k = Math.max(0, Math.min(1, (at.distanceTo(camera) - CAMERA_HIDE) / (CAMERA_CLEAR - CAMERA_HIDE)));
  // Squared: a car a few metres off still fills most of the frame, so it stays faint until it is clear.
  return k * k;
}

export function dispose_car_view(view: CarView) {
  view.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  });
}

let blob: THREE.CanvasTexture | null = null;

function blob_texture(): THREE.CanvasTexture {
  if (blob) return blob;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, "rgb(255 255 255 / 1)");
  gradient.addColorStop(0.55, "rgb(255 255 255 / 0.75)");
  gradient.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  blob = new THREE.CanvasTexture(canvas);
  return blob;
}

export interface ContactShadow {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  strength: number;
}

// The sun's shadow lands metres away at a low sun and blurs out, so without a dark patch right under the body the car
// reads as hovering; this is that patch, tinted from the theme rather than black.
export function contact_shadow(): ContactShadow {
  const strength = dark ? 0.7 : 0.4;
  const material = new THREE.MeshBasicMaterial({
    color: color(tones.skid),
    alphaMap: blob_texture(),
    transparent: true,
    opacity: strength,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.0).rotateX(-Math.PI / 2), material);
  mesh.renderOrder = 1;
  return { mesh, material, strength };
}

const up = new THREE.Vector3(0, 1, 0);
const ground_normal = new THREE.Vector3();
const tilt = new THREE.Quaternion();
const yaw = new THREE.Quaternion();

export function place_contact_shadow(shadow: ContactShadow, x: number, y: number, z: number, heading: number, world: World) {
  const ground = world.height(x, z);
  world.normal(x, z, ground_normal);
  shadow.mesh.position.set(x, ground + 0.05, z);
  tilt.setFromUnitVectors(up, ground_normal);
  yaw.setFromAxisAngle(up, heading);
  shadow.mesh.quaternion.copy(tilt).multiply(yaw);
  const lift = Math.max(0, y - ground - 0.5);
  shadow.material.opacity = shadow.strength * Math.max(0, 1 - lift / 3);
}
