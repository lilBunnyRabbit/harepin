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

/** A box mirrored to both sides: size, centre of the left one, and an optional [x, y, z] tilt in radians. */
interface Part {
  size: Triple;
  at: Triple;
  tilt?: Triple;
}

interface Cabin {
  /** Greenhouse side outline [z, y], base front first, then over the roof; its base edge sits on the body top. */
  points: Point[];
  width: number;
  tumble: number;
  /** Pillar and frame thickness per outline edge, edge i running from point i to i + 1. */
  frame: number[];
  /** Outline edges that are glass seen end-on, with the painted pillar width beside each. */
  screens: Point[];
  split?: Point;
}

interface Arches {
  gap: number;
  steps: number;
  flare: number;
  out: number;
  /** How far the flare reaches in over the body top: a tall reach reads as a fender hump from the front. */
  reach: number;
  tone: "paint" | "trim";
}

interface Rim {
  size: number;
  spokes: number;
  tone: "metal" | "light";
}

/** Profiles are [z, y] from the ground at rest, +z forward; parts are [x, y, z] for the left one. */
interface Design {
  /** Body outline from the front bottom corner over the top to the rear bottom corner; arches are cut from the wheel mounts. */
  outline: Point[];
  width: number;
  sill: number;
  cabin: Cabin;
  arches: Arches;
  heads: Part[];
  tails: Part[];
  paint: Part[];
  trim: Part[];
  markers: Part[];
  chrome: Part[];
  tyre: Point;
  rim: Rim;
  /** Where a bolt-on wing sits: rear deck or roof edge, [z, y]. */
  deck: Point;
}

const MIRROR: Triple = [0.16, 0.1, 0.18];

const DESIGNS: Record<BodyStyle, Design> = {
  coupe: {
    outline: [[2.28, 0.3], [2.33, 0.6], [2.26, 0.68], [0.95, 0.82], [-1.3, 0.86], [-2.18, 0.88], [-2.33, 0.84], [-2.34, 0.5], [-2.27, 0.3]],
    width: 1.88,
    sill: 0.3,
    cabin: { points: [[0.95, 0.82], [0.2, 1.2], [-0.75, 1.21], [-1.3, 0.86]], width: 1.56, tumble: 0.2, frame: [0.06, 0.05, 0.13, 0.04], screens: [[0, 0.08], [2, 0.14]], split: [-0.45, 0.1] },
    arches: { gap: 0.05, steps: 7, flare: 0.05, out: 0.03, reach: 0.08, tone: "paint" },
    heads: [{ size: [0.42, 0.11, 0.05], at: [0.6, 0.52, 2.325] }],
    tails: [{ size: [0.56, 0.13, 0.05], at: [0.58, 0.72, -2.345] }],
    paint: [{ size: MIRROR, at: [0.86, 0.9, 0.72] }],
    trim: [
      { size: [0.34, 0.11, 0.05], at: [0.17, 0.52, 2.325] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.36, 2.3] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.36, -2.3] },
    ],
    markers: [{ size: [0.05, 0.1, 0.04], at: [0.86, 0.52, 2.31] }],
    chrome: [],
    tyre: [0.28, 0.3],
    rim: { size: 0.64, spokes: 6, tone: "metal" },
    deck: [-2.02, 0.88],
  },
  hatch: {
    outline: [[1.9, 0.3], [1.95, 0.62], [1.88, 0.72], [1.0, 0.86], [-1.82, 0.92], [-1.95, 0.92], [-1.97, 0.6], [-1.93, 0.3]],
    width: 1.7,
    sill: 0.3,
    cabin: { points: [[1.0, 0.86], [0.25, 1.3], [-1.45, 1.33], [-1.84, 0.92]], width: 1.5, tumble: 0.14, frame: [0.06, 0.05, 0.14, 0.04], screens: [[0, 0.08], [2, 0.12]], split: [-0.25, 0.1] },
    arches: { gap: 0.05, steps: 6, flare: 0.06, out: 0.03, reach: 0.04, tone: "trim" },
    heads: [{ size: [0.34, 0.16, 0.05], at: [0.56, 0.62, 1.94] }],
    tails: [{ size: [0.18, 0.3, 0.05], at: [0.72, 0.72, -1.975] }],
    paint: [
      { size: MIRROR, at: [0.82, 0.93, 0.8] },
      { size: [0.66, 0.05, 0.24], at: [0.33, 1.355, -1.44] },
    ],
    trim: [
      { size: [0.25, 0.12, 0.05], at: [0.125, 0.62, 1.94] },
      { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, 1.93] },
      { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, -1.95] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.24, 0.24],
    rim: { size: 0.6, spokes: 0, tone: "metal" },
    deck: [-1.44, 1.37],
  },
  muscle: {
    outline: [[2.46, 0.28], [2.53, 0.4], [2.53, 0.74], [2.4, 0.78], [0.45, 0.84], [-1.6, 0.86], [-2.42, 0.88], [-2.52, 0.84], [-2.52, 0.5], [-2.46, 0.28]],
    width: 1.98,
    sill: 0.28,
    cabin: { points: [[0.45, 0.84], [-0.22, 1.22], [-0.95, 1.24], [-1.6, 0.86]], width: 1.5, tumble: 0.22, frame: [0.08, 0.05, 0.15, 0.05], screens: [[0, 0.08], [2, 0.16]], split: [-0.78, 0.06] },
    arches: { gap: 0.05, steps: 7, flare: 0.1, out: 0.08, reach: 0.22, tone: "paint" },
    heads: [
      { size: [0.17, 0.15, 0.04], at: [0.74, 0.6, 2.545] },
      { size: [0.17, 0.15, 0.04], at: [0.52, 0.6, 2.545] },
    ],
    tails: [{ size: [0.82, 0.13, 0.04], at: [0.44, 0.73, -2.535] }],
    paint: [
      { size: MIRROR, at: [0.88, 0.9, 0.3] },
      { size: [0.35, 0.08, 1.7], at: [0.175, 0.87, 1.45] },
      { size: [0.24, 0.12, 0.42], at: [0.12, 0.95, 1.3] },
    ],
    trim: [
      { size: [0.9, 0.26, 0.04], at: [0.45, 0.6, 2.535] },
      { size: [0.19, 0.07, 0.02], at: [0.095, 0.97, 1.52] },
      { size: [0.12, 0.012, 1.7], at: [0.12, 0.916, 1.45] },
      { size: [0.12, 0.012, 0.75], at: [0.12, 1.247, -0.58] },
      { size: [0.12, 0.012, 0.8], at: [0.12, 0.886, -2.0], tilt: [-0.025, 0, 0] },
      { size: [0.06, 0.06, 0.16], at: [0.5, 0.24, -2.46] },
    ],
    markers: [],
    chrome: [
      { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, 2.5] },
      { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, -2.5] },
    ],
    tyre: [0.3, 0.42],
    rim: { size: 0.62, spokes: 5, tone: "metal" },
    deck: [-2.15, 0.88],
  },
  rally: {
    outline: [[2.15, 0.38], [2.2, 0.5], [2.17, 0.66], [1.2, 0.8], [-1.6, 0.88], [-2.13, 0.9], [-2.2, 0.86], [-2.2, 0.56], [-2.14, 0.38]],
    width: 1.8,
    sill: 0.38,
    cabin: { points: [[1.2, 0.8], [0.4, 1.3], [-1.0, 1.33], [-1.6, 0.88]], width: 1.5, tumble: 0.12, frame: [0.07, 0.05, 0.1, 0.05], screens: [[0, 0.08], [2, 0.12]], split: [-0.24, 0.1] },
    arches: { gap: 0.1, steps: 3, flare: 0.1, out: 0.08, reach: 0.06, tone: "trim" },
    heads: [
      { size: [0.34, 0.1, 0.05], at: [0.62, 0.58, 2.2], tilt: [-0.2, 0, 0] },
      { size: [0.15, 0.13, 0.03], at: [0.14, 0.76, 2.13] },
      { size: [0.15, 0.13, 0.03], at: [0.38, 0.76, 2.13] },
    ],
    tails: [{ size: [0.4, 0.15, 0.05], at: [0.62, 0.74, -2.21] }],
    paint: [{ size: MIRROR, at: [0.85, 0.9, 0.95] }],
    trim: [
      { size: [0.55, 0.18, 0.08], at: [0.275, 0.76, 2.08] },
      { size: [0.18, 0.08, 0.32], at: [0.09, 1.37, 0.1] },
      { size: [0.75, 0.06, 0.4], at: [0.375, 0.36, 1.9] },
      { size: [0.9, 0.12, 0.06], at: [0.45, 0.44, 2.18] },
      { size: [0.9, 0.12, 0.06], at: [0.45, 0.44, -2.18] },
      { size: [0.3, 0.3, 0.03], at: [0.78, 0.25, 0.75] },
      { size: [0.3, 0.3, 0.03], at: [0.78, 0.25, -1.8] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.3, 0.3],
    rim: { size: 0.56, spokes: 0, tone: "light" },
    deck: [-1.95, 0.9],
  },
  kaze: {
    outline: [[1.96, 0.28], [2.0, 0.56], [1.94, 0.65], [0.57, 0.93], [-1.9, 0.95], [-2.0, 0.94], [-2.12, 0.91], [-2.14, 0.6], [-2.08, 0.28]],
    width: 1.9,
    sill: 0.28,
    cabin: { points: [[0.57, 0.93], [-0.05, 1.26], [-0.35, 1.3], [-0.78, 1.28], [-1.9, 0.95]], width: 1.66, tumble: 0.34, frame: [0.05, 0.035, 0.035, 0.05, 0.035], screens: [[0, 0.07], [3, 0.2]] },
    arches: { gap: 0.07, steps: 8, flare: 0, out: 0, reach: 0, tone: "paint" },
    heads: [{ size: [0.38, 0.05, 0.24], at: [0.64, 0.67, 1.88], tilt: [0.42, 0.22, 0] }],
    tails: [{ size: [0.46, 0.14, 0.05], at: [0.63, 0.79, -2.155] }],
    paint: [
      { size: [0.18, 0.14, 0.18], at: [0.94, 1.0, 0.4] },
      { size: [0.8, 0.05, 0.18], at: [0.4, 0.96, -2.04], tilt: [0.25, 0, 0] },
    ],
    trim: [
      { size: [0.88, 0.05, 0.22], at: [0.44, 0.26, 1.9] },
      { size: [0.52, 0.12, 0.04], at: [0.25, 0.4, 1.985] },
      { size: [0.03, 0.16, 0.05], at: [0.955, 0.8, -0.7] },
      { size: [0.9, 0.14, 0.04], at: [0.45, 0.37, -2.11] },
    ],
    markers: [{ size: [0.05, 0.16, 0.04], at: [0.78, 0.42, 1.99] }],
    chrome: [{ size: [0.12, 0.07, 0.1], at: [0.55, 0.3, -2.12] }],
    tyre: [0.34, 0.36],
    rim: { size: 0.58, spokes: 0, tone: "metal" },
    deck: [-2.0, 0.97],
  },
};

function arc(z: number, y: number, radius: number, floor: number, steps: number): Point[] {
  const low = Math.asin(Math.max(-1, Math.min(1, (floor - y) / radius)));
  return Array.from({ length: steps + 1 }, (_, i): Point => {
    const a = Math.PI - low - ((Math.PI - 2 * low) * i) / steps;
    return [z + radius * Math.cos(a), y + radius * Math.sin(a)];
  });
}

function signed_area(points: Point[]): number {
  return points.reduce((sum, [z, y], i) => {
    const [z2, y2] = points[(i + 1) % points.length];
    return sum + z * y2 - z2 * y;
  }, 0);
}

function inset(points: Point[], by: number[]): Point[] {
  const n = points.length;
  const turn = Math.sign(signed_area(points));
  const lines = points.map(([z, y], i) => {
    const [z2, y2] = points[(i + 1) % n];
    const dz = z2 - z;
    const dy = y2 - y;
    const length = Math.hypot(dz, dy);
    return { z: z - (dy / length) * turn * by[i], y: y + (dz / length) * turn * by[i], dz, dy };
  });
  return lines.map((b, i): Point => {
    const a = lines[(i - 1 + n) % n];
    const t = ((b.z - a.z) * b.dy - (b.y - a.y) * b.dz) / (a.dz * b.dy - a.dy * b.dz);
    return [a.z + a.dz * t, a.y + a.dy * t];
  });
}

function clip(points: Point[], at: number, keep: number): Point[] {
  const out: Point[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const p_in = (p[0] - at) * keep >= 0;
    if (p_in) out.push(p);
    if (p_in !== (q[0] - at) * keep >= 0) out.push([at, p[1] + ((q[1] - p[1]) * (at - p[0])) / (q[0] - p[0])]);
  });
  return out;
}

function screen(points: Point[], edge: number, end: number): Point[] {
  const turn = Math.sign(signed_area(points));
  const a = points[edge];
  const b = points[(edge + 1) % points.length];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const out: Point = [u[1] * turn, -u[0] * turn];
  const at = (p: Point, along: number, by: number): Point => [p[0] + u[0] * along + out[0] * by, p[1] + u[1] * along + out[1] * by];
  return [at(a, end, 0.012), at(b, -end, 0.012), at(b, -end, -0.03), at(a, end, -0.03)];
}

/** Narrows x linearly with height, so flat sides stay flat while leaning in. */
function lean(geometry: THREE.BufferGeometry, from: number, to: number, share: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * (1 - (share * (position.getY(i) - from)) / (to - from)));
  return geometry;
}

function slab(points: Point[], from: number, to: number): THREE.BufferGeometry[] {
  return [-1, 1].map((side) => extrude(points, to - from).translate((side * (from + to)) / 2, 0, 0));
}

function parts(list: Part[]): THREE.BufferGeometry[] {
  return list.flatMap(({ size, at: [x, y, z], tilt: [rx, ry, rz] = [0, 0, 0] }) =>
    [-1, 1].map((side) => new THREE.BoxGeometry(...size).rotateX(rx).rotateY(side * ry).rotateZ(side * rz).translate(side * x, y, z)),
  );
}

function cabin_parts(c: Cabin, paint: THREE.Color, glass: THREE.Color): THREE.BufferGeometry[] {
  const ys = c.points.map(([, y]) => y);
  const base = Math.min(...ys);
  const top = Math.max(...ys);
  const window = inset(c.points, c.frame);
  const windows = c.split ? [clip(window, c.split[0] + c.split[1] / 2, 1), clip(window, c.split[0] - c.split[1] / 2, -1)] : [window];
  return [
    tint(extrude(c.points, c.width), paint),
    ...windows.map((w) => tint(extrude(w, c.width + 0.02), glass)),
    ...c.screens.map(([edge, pillar]) => tint(extrude(screen(c.points, edge, Math.max(0.05, pillar * 0.6)), c.width - 2 * pillar), glass)),
  ].map((g) => lean(g, base, top, c.tumble));
}

function body_outline(d: Design, spec: CarSpec): Point[] {
  const radius = spec.wheel.radius + d.arches.gap;
  const y = spec.wheel.radius;
  return [...d.outline, ...arc(spec.wheel.mounts[2][2], y, radius, d.sill, d.arches.steps), ...arc(spec.wheel.mounts[0][2], y, radius, d.sill, d.arches.steps)];
}

function flares(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  if (d.arches.flare <= 0) return [];
  const inner = spec.wheel.radius + d.arches.gap;
  const y = spec.wheel.radius;
  const edge = d.width / 2;
  return [spec.wheel.mounts[0][2], spec.wheel.mounts[2][2]].flatMap((z) => {
    const ring = [...arc(z, y, inner + d.arches.flare, d.sill, d.arches.steps), ...arc(z, y, inner, d.sill, d.arches.steps).reverse()];
    return slab(ring, edge - d.arches.reach, edge + d.arches.out);
  });
}

function skirts(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  const reach = spec.wheel.radius + d.arches.gap + d.arches.flare;
  const front = spec.wheel.mounts[0][2] - reach;
  const rear = spec.wheel.mounts[2][2] + reach;
  return parts([{ size: [0.03, 0.09, front - rear], at: [d.width / 2 + 0.005, d.sill, (front + rear) / 2] }]);
}

function wing(level: Level, style: BodyStyle, width: number, [z, y]: Point, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  if (level === 0) {
    if (style !== "coupe") return [];
    return [tint(box(1.6, 0.05, 0.3, 0, y + 0.13, z), paint), ...[-1, 1].map((side) => tint(box(0.06, 0.13, 0.12, side * 0.6, y + 0.065, z + 0.02), trim))];
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

function wheel_geometry(radius: number, width: number, rim: Rim): THREE.BufferGeometry {
  const metal = color(mix(brand.foreground, brand.background_lightest, 0.6));
  const tone = rim.tone === "light" ? color(tones.check_light) : metal;
  const disc = radius * rim.size;
  const pieces = [
    tint(new THREE.CylinderGeometry(radius, radius, width, 8).rotateZ(Math.PI / 2), color(tones.tyre)),
    tint(new THREE.CylinderGeometry(disc, disc, width + 0.02, 8).rotateZ(Math.PI / 2), rim.spokes ? color(tones.trim) : tone),
  ];
  for (let i = 0; i < rim.spokes; i++) pieces.push(tint(new THREE.BoxGeometry(width + 0.04, disc * 1.9, 0.06).rotateX((i * Math.PI) / rim.spokes), tone));
  if (rim.spokes) pieces.push(tint(new THREE.CylinderGeometry(disc * 0.3, disc * 0.3, width + 0.05, 6).rotateZ(Math.PI / 2), tone));
  return merge(...pieces);
}

// Paint, trim and glass are baked into vertex colours so the whole shell is one draw; a repaint rebuilds the view.
export function car_view(paint: THREE.Color, spec: CarSpec = COUPE, spoiler: Level = 0): CarView {
  const style = spec.body.style;
  const d = DESIGNS[style];
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -(rest_reach(spec) - spec.wheel.mounts[0][1]);
  const trim = color(tones.trim);
  const arch_tone = d.arches.tone === "paint" ? paint : trim;

  const shell = merge(
    tint(extrude(body_outline(d, spec), d.width), paint),
    cabin_parts(d.cabin, paint, color(tones.glass)),
    flares(d, spec).map((g) => tint(g, arch_tone)),
    skirts(d, spec).map((g) => tint(g, trim)),
    parts(d.paint).map((g) => tint(g, paint)),
    parts(d.trim).map((g) => tint(g, trim)),
    parts(d.markers).map((g) => tint(g, color(brand.warning))),
    parts(d.chrome).map((g) => tint(g, color(mix(brand.foreground, brand.background_lightest, 0.6)))),
    wing(spoiler, style, d.width, d.deck, paint, trim),
  );
  const hull = new THREE.Mesh(shell, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  hull.castShadow = true;

  const head = color(tones.head);
  const head_material = new THREE.MeshLambertMaterial({ color: head, emissive: head, emissiveIntensity: 1.2 });
  const tail = color(brand.error);
  const brake = new THREE.MeshLambertMaterial({ color: tail, emissive: tail, emissiveIntensity: 0.5 });
  const head_mesh = new THREE.Mesh(merge(parts(d.heads)), head_material);
  body.add(hull, head_mesh, new THREE.Mesh(merge(parts(d.tails)), brake));
  root.add(body);

  const axles = [wheel_geometry(spec.wheel.radius, d.tyre[0], d.rim), wheel_geometry(spec.wheel.radius, d.tyre[1], d.rim)];
  const wheel_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wheels = [0, 1, 2, 3].map((i) => {
    const steer = new THREE.Group();
    const spin = new THREE.Group();
    const mesh = new THREE.Mesh(axles[i < 2 ? 0 : 1], wheel_material);
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
