import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rest_reach, type Car } from "./car";
import { DECALS, DEFAULT_PARTS, build_spec, part_of, type Build, type Look, type Slot } from "./build";
import { COUPE, type BodyStyle, type CarSpec, type Triple } from "./cars";
import { livery_parts, roof, type Livery, type Panel } from "./livery";
import { NEUTRAL_INKS, brand, car_paints, color, dark, decal_inks, glow, mix, tones } from "./palette";
import type { Lab, Token } from "./theme";
import { ribbon } from "./scene";
import { ROAD_HALF, World } from "./world";

// Brake emissive runs 0.5 at rest and 2.2 braking (`sync_car_view`, remotes): only the braking glow clears bloom.
const BRAKE_GLOW = 0.5;

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
  const reflector = color(tones.reflector);
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
  /** Cockpit halo, hidden from the hood camera with `heads`; null on closed bodies. */
  halo: THREE.Mesh | null;
  /** Hood camera point in car space, or null for the camera's default. */
  eye: THREE.Vector3 | null;
  /** Nitro exhaust flame, hidden until `show_flame`. */
  flame: THREE.Mesh;
}

type Point = [number, number];

/** A box mirrored to both sides: size, centre of the left one, and an optional [x, y, z] tilt in radians. */
interface Part {
  size: Triple;
  at: Triple;
  tilt?: Triple;
  /** An eight-sided disc facing forward instead of a box: `size` x is its diameter, z its depth. */
  round?: boolean;
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
  /** Where the side glass ends toward the tail, z: a fastback roof runs on to the tail as painted panel. */
  glass_to?: number;
}

/** A side profile [z, y] extruded between two distances from the centre, mirrored: wing bulges and haunches. */
interface Slab {
  points: Point[];
  from: number;
  to: number;
}

interface Arches {
  gap: number;
  /** Segments per arch; 0 cuts none, for wheels that stand clear of the body. */
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
  tone: "metal" | "light" | "bronze";
  /** Polished outer lip as a share of the rim radius, with the spokes set back in a dark dish inside it. */
  lip?: number;
  /** Spoke width, metres; 0.06 when unset. */
  spoke?: number;
}

/** Endplates in paint, planes in trim. */
interface Wing {
  paint: Part[];
  trim: Part[];
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
  /** Factory stripes in trim, dropped when a decal is chosen so the two never overlap. */
  stripes?: Part[];
  markers: Part[];
  chrome: Part[];
  tyre: Point;
  rim: Rim;
  /** Where a bolt-on wing sits: rear deck or roof edge, [z, y]. */
  deck: Point;
  /** A built-in rear wing per aero wing level from none up, set steeper and bigger in place of a bolt-on one on `deck`. */
  wings?: Wing[];
  /** A built-in front wing per aero front piece (none, lip, splitter), grown in place of a bolt-on lip or splitter. */
  fronts?: Wing[];
  /** Side decal area when the body side between the arches is hidden, as behind sidepods. */
  panel?: Panel;
  /** Where an engine bulge or scoop sits on the hood, [z, y]. */
  hood: Point;
  /** Hood camera of an open cockpit, at the driver's eyes, [z, y]; closed bodies use the camera's own hood point. */
  eye?: Point;
  /** Left tailpipe outlet for engine upgrades, at the rear face; x 0 is one central pipe that widens instead of doubling. */
  exhaust: Triple;
  /** Nitro bottles on the rear deck (default), out of sight inside the bodywork, or on the outline at this z. */
  bottles?: "deck" | "inside" | number;
  /** Cockpit hoop in trim; hidden from the hood camera like the headlamps. */
  halo?: Part[];
  /** Stock brake caliper colour, proud of the spokes like an upgrade's; without one it hides in trim. */
  caliper?: Token;
  /** Raised profiles on the body sides in paint, such as front wings standing above a low bonnet. */
  slabs?: Slab[];
  /** Narrows the body behind z `from` to `share` of its width at the tail. */
  taper?: { from: number; share: number };
}

const MIRROR: Triple = [0.16, 0.1, 0.18];
const RIVET: Triple = [0.03, 0.025, 0.025];

/** Bolt heads around a bolt-on arch: `count` studs on a half circle of `radius` round the wheel centre [z, y], at side x. */
function rivets(z: number, y: number, radius: number, x: number, count: number): Part[] {
  return Array.from({ length: count }, (_, i): Part => {
    const a = (Math.PI * (i + 0.5)) / count;
    return { size: RIVET, at: [x, y + radius * Math.sin(a), z + radius * Math.cos(a)] };
  });
}

const DESIGNS: Record<BodyStyle, Design> = {
  coupe: {
    outline: [[2.27, 0.3], [2.33, 0.42], [2.34, 0.6], [2.29, 0.72], [2.16, 0.78], [1.3, 0.84], [0.6, 0.87], [-1.6, 0.89], [-2.14, 0.9], [-2.3, 0.88], [-2.34, 0.8], [-2.34, 0.5], [-2.27, 0.3]],
    width: 1.88,
    sill: 0.3,
    cabin: { points: [[0.6, 0.87], [-0.08, 1.19], [-0.48, 1.225], [-0.92, 1.19], [-1.6, 0.89]], width: 1.56, tumble: 0.2, frame: [0.06, 0.04, 0.04, 0.13, 0.04], screens: [[0, 0.08], [3, 0.14]], split: [-0.62, 0.08] },
    arches: { gap: 0.05, steps: 7, flare: 0.05, out: 0.03, reach: 0.08, tone: "paint" },
    heads: [{ size: [0.42, 0.1, 0.05], at: [0.6, 0.66, 2.32], tilt: [-0.39, 0, 0] }],
    tails: [{ size: [0.56, 0.12, 0.05], at: [0.58, 0.74, -2.345] }],
    paint: [{ size: MIRROR, at: [0.86, 0.93, 0.45] }],
    trim: [
      { size: [0.34, 0.1, 0.05], at: [0.17, 0.49, 2.33] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.36, 2.3] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.36, -2.3] },
    ],
    markers: [{ size: [0.05, 0.1, 0.04], at: [0.86, 0.49, 2.32] }],
    chrome: [],
    tyre: [0.28, 0.3],
    rim: { size: 0.64, spokes: 6, tone: "metal" },
    deck: [-2.0, 0.9],
    hood: [1.3, 0.84],
    exhaust: [0.55, 0.3, -2.3],
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
    hood: [1.35, 0.8],
    exhaust: [0.5, 0.32, -1.92],
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
      { size: [0.06, 0.06, 0.16], at: [0.5, 0.24, -2.46] },
    ],
    stripes: [
      { size: [0.12, 0.012, 1.7], at: [0.12, 0.916, 1.45] },
      { size: [0.12, 0.012, 0.75], at: [0.12, 1.247, -0.58] },
      { size: [0.12, 0.012, 0.8], at: [0.12, 0.886, -2.0], tilt: [-0.025, 0, 0] },
    ],
    markers: [],
    chrome: [
      { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, 2.5] },
      { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, -2.5] },
    ],
    tyre: [0.3, 0.42],
    rim: { size: 0.62, spokes: 5, tone: "metal" },
    deck: [-2.15, 0.88],
    hood: [1.95, 0.91],
    exhaust: [0.5, 0.26, -2.44],
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
    hood: [1.55, 0.75],
    exhaust: [0.55, 0.4, -2.13],
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
    hood: [1.2, 0.8],
    exhaust: [0.55, 0.3, -2.08],
  },
  sturm: {
    outline: [[2.2, 0.14], [2.27, 0.19], [2.28, 0.36], [2.24, 0.44], [2.1, 0.52], [1.8, 0.61], [1.2, 0.7], [0.76, 0.78], [-0.4, 0.82], [-1.0, 0.84], [-1.5, 0.8], [-1.78, 0.7], [-1.92, 0.58], [-1.96, 0.4], [-1.93, 0.24], [-1.86, 0.16]],
    width: 1.7,
    sill: 0.16,
    cabin: {
      points: [[0.76, 0.78], [0.44, 1.04], [0.22, 1.2], [0.0, 1.27], [-0.3, 1.3], [-0.62, 1.26], [-1.32, 0.97], [-1.56, 0.83], [-1.78, 0.68], [-1.9, 0.6]],
      width: 1.38,
      tumble: 0.22,
      frame: [0.05, 0.05, 0.035, 0.035, 0.035, 0.05, 0.035, 0.035, 0.035, 0.035],
      screens: [[0, 0.07], [1, 0.07], [5, 0.17]],
      split: [-0.42, 0.08],
      glass_to: -1.36,
    },
    arches: { gap: 0.02, steps: 8, flare: 0.13, out: 0.2, reach: 0.1, tone: "paint" },
    slabs: [
      { points: [[2.12, 0.44], [2.17, 0.56], [2.16, 0.68], [2.1, 0.78], [1.98, 0.84], [1.75, 0.85], [1.3, 0.83], [0.85, 0.82], [0.6, 0.8], [0.6, 0.5]], from: 0.46, to: 0.88 },
      { points: [[-0.08, 0.72], [-0.18, 0.86], [-0.38, 0.95], [-0.68, 0.99], [-1.08, 0.99], [-1.38, 0.95], [-1.6, 0.85], [-1.74, 0.72]], from: 0.55, to: 1.0 },
    ],
    heads: [{ size: [0.21, 0.21, 0.05], at: [0.665, 0.69, 2.175], tilt: [-0.25, 0, 0], round: true }],
    tails: [{ size: [0.84, 0.07, 0.04], at: [0.42, 0.56, -1.93] }],
    paint: [
      { size: MIRROR, at: [0.76, 0.93, 0.5] },
      { size: [0.62, 0.05, 0.28], at: [0.31, 0.74, -1.74], tilt: [-0.35, 0, 0] },
    ],
    trim: [
      { size: [0.25, 0.25, 0.03], at: [0.665, 0.69, 2.155], tilt: [-0.25, 0, 0], round: true },
      { size: [0.86, 0.17, 0.04], at: [0.43, 0.3, 2.275] },
      { size: [0.96, 0.035, 0.22], at: [0.48, 0.15, 2.22] },
      { size: [0.86, 0.1, 0.05], at: [0.43, 0.3, -1.95] },
      { size: [0.5, 0.012, 0.05], at: [0.25, 0.925, -1.4], tilt: [0.5, 0, 0] },
      { size: [0.5, 0.012, 0.05], at: [0.25, 0.885, -1.48], tilt: [0.5, 0, 0] },
      { size: [0.5, 0.012, 0.05], at: [0.25, 0.845, -1.56], tilt: [0.55, 0, 0] },
    ],
    markers: [{ size: [0.1, 0.045, 0.04], at: [0.66, 0.42, 2.255] }],
    chrome: [...rivets(1.362, 0.34, 0.43, 1.06, 7), ...rivets(-0.908, 0.34, 0.43, 1.06, 7)],
    tyre: [0.4, 0.46],
    rim: { size: 0.8, spokes: 3, tone: "metal", lip: 0.4 },
    deck: [-1.7, 0.75],
    hood: [-1.42, 0.86],
    exhaust: [0.3, 0.25, -1.94],
    bottles: 1.7,
    wings: [
      { paint: [], trim: [] },
      {
        paint: [{ size: [0.025, 0.14, 0.38], at: [0.8, 1.06, -1.78] }],
        trim: [
          { size: [0.04, 0.34, 0.1], at: [0.42, 0.88, -1.72] },
          { size: [0.8, 0.04, 0.34], at: [0.4, 1.06, -1.78], tilt: [0.08, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.02, 0.2, 0.46], at: [0.9, 1.3, -1.95] }],
        trim: [
          { size: [0.045, 0.62, 0.08], at: [0.42, 1.0, -1.74], tilt: [-0.3, 0, 0] },
          { size: [0.9, 0.045, 0.4], at: [0.45, 1.29, -1.9], tilt: [0.1, 0, 0] },
          { size: [0.9, 0.03, 0.18], at: [0.45, 1.37, -2.1], tilt: [0.45, 0, 0] },
        ],
      },
    ],
  },
  raijin: {
    outline: [[1.96, 0.22], [2.0, 0.3], [2.05, 0.46], [2.14, 0.76], [2.1, 0.82], [1.9, 0.88], [1.2, 0.95], [0.82, 1.0], [-0.6, 1.06], [-1.5, 1.11], [-1.95, 1.14], [-2.36, 1.15], [-2.42, 1.1], [-2.43, 0.7], [-2.4, 0.36], [-2.34, 0.26]],
    width: 1.78,
    sill: 0.26,
    cabin: {
      points: [[0.82, 1.0], [0.0, 1.45], [-0.4, 1.48], [-1.2, 1.47], [-1.45, 1.43], [-1.95, 1.14]],
      width: 1.5,
      tumble: 0.14,
      frame: [0.06, 0.04, 0.04, 0.04, 0.13, 0.04],
      screens: [[0, 0.08], [4, 0.13]],
      split: [-0.55, 0.09],
    },
    arches: { gap: 0.03, steps: 7, flare: 0.09, out: 0.1, reach: 0.08, tone: "paint" },
    heads: [{ size: [0.38, 0.07, 0.1], at: [0.62, 0.77, 2.11], tilt: [0.29, 0.35, 0.15] }],
    tails: [
      { size: [0.42, 0.17, 0.05], at: [0.66, 0.96, -2.43] },
      { size: [0.04, 0.12, 0.2], at: [0.885, 0.96, -2.33] },
    ],
    paint: [
      { size: [0.2, 0.36, 0.05], at: [0.52, 0.52, 2.115], tilt: [0.29, 0, -0.45] },
      { size: [0.3, 0.06, 0.9], at: [0.15, 0.97, 1.4], tilt: [-0.07, 0, 0] },
      { size: [0.18, 0.12, 0.16], at: [0.86, 1.1, 0.62] },
    ],
    trim: [
      { size: [0.5, 0.34, 0.05], at: [0.25, 0.58, 2.1], tilt: [0.29, 0, 0] },
      { size: [0.95, 0.035, 0.24], at: [0.475, 0.21, 1.98] },
      { size: [0.18, 0.02, 0.1], at: [0.82, 0.42, 2.0], tilt: [0, 0.3, 0.35] },
      { size: [0.16, 0.02, 0.1], at: [0.82, 0.33, 1.99], tilt: [0, 0.3, 0.3] },
      { size: [0.15, 0.015, 0.3], at: [0.42, 0.955, 1.5], tilt: [-0.07, 0, 0] },
      { size: [0.15, 0.06, 0.03], at: [0.075, 0.99, 1.86] },
      { size: [0.015, 0.12, 0.2], at: [0.895, 0.76, 0.46] },
      { size: [0.02, 0.38, 0.09], at: [0.7, 1.24, -0.55] },
      { size: [0.012, 0.6, 0.015], at: [0.894, 0.72, 0.6] },
      { size: [0.012, 0.74, 0.015], at: [0.894, 0.66, -0.55] },
      { size: [0.012, 0.34, 0.015], at: [0.894, 0.94, -1.3] },
      { size: [0.014, 0.03, 0.12], at: [0.896, 0.96, 0.02] },
      { size: [0.014, 0.03, 0.12], at: [0.896, 0.99, -1.0] },
      { size: [0.05, 0.05, 1.5], at: [0.885, 0.22, -0.21] },
      { size: [0.7, 0.1, 0.08], at: [0.35, 0.32, -2.4] },
      { size: [0.89, 0.02, 0.02], at: [0.445, 0.62, -2.435] },
      { size: [0.3, 0.12, 0.02], at: [0.0, 0.76, -2.435] },
    ],
    markers: [{ size: [0.05, 0.07, 0.08], at: [0.0, 0.3, 2.03] }],
    chrome: [{ size: [0.34, 0.14, 0.03], at: [0.17, 0.5, 2.09], tilt: [0.29, 0, 0] }],
    caliper: "warning",
    tyre: [0.34, 0.34],
    rim: { size: 0.8, spokes: 5, tone: "bronze", spoke: 0.1 },
    deck: [-2.2, 1.12],
    hood: [1.45, 0.89],
    exhaust: [0.4, 0.3, -2.4],
    wings: [
      {
        paint: [{ size: [0.02, 0.1, 0.28], at: [0.73, 1.29, -2.2] }],
        trim: [
          { size: [0.04, 0.14, 0.14], at: [0.55, 1.19, -2.18] },
          { size: [0.72, 0.04, 0.26], at: [0.36, 1.27, -2.2], tilt: [0.06, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.02, 0.16, 0.34], at: [0.8, 1.39, -2.24] }],
        trim: [
          { size: [0.04, 0.26, 0.14], at: [0.52, 1.25, -2.2] },
          { size: [0.8, 0.04, 0.3], at: [0.4, 1.39, -2.24], tilt: [0.08, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.02, 0.18, 0.42], at: [0.92, 1.55, -2.32] }],
        trim: [
          { size: [0.04, 0.42, 0.12], at: [0.5, 1.33, -2.2], tilt: [-0.2, 0, 0] },
          { size: [0.9, 0.045, 0.34], at: [0.45, 1.55, -2.3], tilt: [0.1, 0, 0] },
          { size: [0.9, 0.03, 0.16], at: [0.45, 1.61, -2.48], tilt: [0.45, 0, 0] },
        ],
      },
    ],
  },
  formula: {
    outline: [[2.3, 0.2], [2.32, 0.27], [2.1, 0.34], [1.3, 0.5], [0.98, 0.6], [0.9, 0.56], [0.42, 0.56], [0.3, 0.68], [-0.2, 0.7], [-1.2, 0.5], [-1.85, 0.38], [-2.0, 0.36], [-2.0, 0.12]],
    width: 0.56,
    sill: 0.1,
    cabin: { points: [[0.84, 0.6], [0.84, 0.78], [0.72, 0.9], [0.52, 0.88], [0.5, 0.6]], width: 0.24, tumble: 0.25, frame: [0.025, 0.03, 0.05, 0.2, 0.22], screens: [[1, 0.04]] },
    arches: { gap: 0, steps: 0, flare: 0, out: 0, reach: 0, tone: "trim" },
    heads: [{ size: [0.05, 0.035, 0.14], at: [0.27, 0.38, 1.75], tilt: [0.18, 0, 0] }],
    tails: [{ size: [0.07, 0.08, 0.03], at: [0.035, 0.22, -2.135] }],
    paint: [
      { size: [0.36, 0.32, 1.0], at: [0.46, 0.26, -0.62] },
      { size: [0.22, 0.2, 0.6], at: [0.38, 0.2, -1.3], tilt: [0.2, 0.16, 0] },
      { size: [0.08, 0.28, 0.3], at: [0.04, 0.84, 0.27] },
      { size: [0.06, 0.1, 1.1], at: [0.03, 0.78, -0.3], tilt: [-0.3, 0, 0] },
      { size: [0.03, 0.16, 0.52], at: [0.95, 0.17, 2.12] },
      { size: [0.12, 0.06, 0.09], at: [0.38, 0.7, 0.98] },
    ],
    trim: [
      { size: [0.62, 0.04, 2.5], at: [0.31, 0.115, -0.25] },
      { size: [0.9, 0.035, 0.42], at: [0.45, 0.13, 2.12] },
      { size: [0.62, 0.03, 0.22], at: [0.56, 0.2, 2.0], tilt: [-0.35, 0, 0] },
      { size: [0.02, 0.44, 0.14], at: [0.01, 0.62, -1.96], tilt: [0.25, 0, 0] },
      { size: [0.3, 0.2, 0.03], at: [0.43, 0.27, -0.11] },
      { size: [0.07, 0.1, 0.02], at: [0.035, 0.92, 0.42] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.42, 1.6], tilt: [0, 0, -0.2] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.24, 1.6], tilt: [0, 0, 0.12] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.42, -1.45], tilt: [0, 0, -0.2] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.22, -1.45], tilt: [0, 0, 0.12] },
      { size: [0.06, 0.02, 0.03], at: [0.3, 0.66, 0.98] },
      { size: [0.08, 0.12, 0.24], at: [0.04, 0.22, -2.0] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.32, 0.42],
    rim: { size: 0.6, spokes: 0, tone: "metal" },
    deck: [-2.0, 0.6],
    hood: [-0.6, 0.62],
    exhaust: [0, 0.34, -1.98],
    halo: [
      { size: [0.03, 0.035, 0.48], at: [0.105, 0.94, 0.67], tilt: [0, -0.24, 0] },
      { size: [0.025, 0.36, 0.035], at: [0.0125, 0.78, 0.94], tilt: [-0.3, 0, 0] },
      { size: [0.025, 0.3, 0.03], at: [0.16, 0.79, 0.44] },
    ],
    bottles: "inside",
    taper: { from: -0.3, share: 0.42 },
    wings: [
      {
        paint: [{ size: [0.03, 0.34, 0.5], at: [0.5, 0.86, -2.08] }],
        trim: [
          { size: [0.485, 0.04, 0.28], at: [0.2425, 0.82, -2.02], tilt: [0.1, 0, 0] },
          { size: [0.485, 0.03, 0.16], at: [0.2425, 0.92, -2.2], tilt: [0.35, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.03, 0.38, 0.52], at: [0.5, 0.88, -2.08] }],
        trim: [
          { size: [0.485, 0.045, 0.3], at: [0.2425, 0.82, -2.02], tilt: [0.2, 0, 0] },
          { size: [0.485, 0.03, 0.22], at: [0.2425, 0.95, -2.21], tilt: [0.65, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.03, 0.62, 0.56], at: [0.5, 0.76, -2.08] }],
        trim: [
          { size: [0.485, 0.05, 0.32], at: [0.2425, 0.82, -2.02], tilt: [0.28, 0, 0] },
          { size: [0.485, 0.035, 0.24], at: [0.2425, 0.96, -2.22], tilt: [0.8, 0, 0] },
          { size: [0.485, 0.03, 0.16], at: [0.2425, 1.04, -2.31], tilt: [1.05, 0, 0] },
          { size: [0.485, 0.03, 0.2], at: [0.2425, 0.5, -2.1], tilt: [0.3, 0, 0] },
        ],
      },
    ],
    fronts: [
      { paint: [], trim: [] },
      { paint: [], trim: [{ size: [0.56, 0.025, 0.18], at: [0.6, 0.27, 1.88], tilt: [-0.5, 0, 0] }] },
      {
        paint: [{ size: [0.03, 0.26, 0.58], at: [0.96, 0.2, 2.1] }],
        trim: [
          { size: [0.58, 0.028, 0.2], at: [0.59, 0.27, 1.88], tilt: [-0.55, 0, 0] },
          { size: [0.5, 0.025, 0.16], at: [0.65, 0.33, 1.76], tilt: [-0.8, 0, 0] },
        ],
      },
    ],
    panel: { rear: -1.08, front: -0.16, low: 0.14, high: 0.4, side: 0.64 },
    eye: [0.7, 0.84],
  },
};

function arc(z: number, y: number, radius: number, floor: number, steps: number): Point[] {
  if (steps === 0) return [];
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

function taper(geometry: THREE.BufferGeometry, from: number, tail: number, share: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const k = Math.max(0, Math.min(1, (from - position.getZ(i)) / (from - tail)));
    position.setX(i, position.getX(i) * (1 - (1 - share) * k));
  }
  return geometry;
}

function slab(points: Point[], from: number, to: number): THREE.BufferGeometry[] {
  return [-1, 1].map((side) => extrude(points, to - from).translate((side * (from + to)) / 2, 0, 0));
}

function parts(list: Part[]): THREE.BufferGeometry[] {
  return list.flatMap(({ size, at: [x, y, z], tilt: [rx, ry, rz] = [0, 0, 0], round }) =>
    [-1, 1].map((side) =>
      (round ? new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, size[2], 8).rotateX(Math.PI / 2) : new THREE.BoxGeometry(...size))
        .rotateX(rx)
        .rotateY(side * ry)
        .rotateZ(side * rz)
        .translate(side * x, y, z),
    ),
  );
}

function cabin_parts(c: Cabin, paint: THREE.Color, glass: THREE.Color): THREE.BufferGeometry[] {
  const ys = c.points.map(([, y]) => y);
  const base = Math.min(...ys);
  const top = Math.max(...ys);
  const window = c.glass_to === undefined ? inset(c.points, c.frame) : clip(inset(c.points, c.frame), c.glass_to, 1);
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

function skirts(d: Design, spec: CarSpec, thick: number, deep: number): THREE.BufferGeometry[] {
  const reach = spec.wheel.radius + d.arches.gap + d.arches.flare;
  const front = spec.wheel.mounts[0][2] - reach;
  const rear = spec.wheel.mounts[2][2] + reach;
  return parts([{ size: [thick, deep, front - rear], at: [d.width / 2 - 0.01 + thick / 2, d.sill + 0.045 - deep / 2, (front + rear) / 2] }]);
}

const WINGS = [
  { lift: 0.24, span: 0.92, thick: 0.05, chord: 0.36 },
  { lift: 0.4, span: 1, thick: 0.07, chord: 0.44 },
  { lift: 0.42, span: 1.04, thick: 0.08, chord: 0.52 },
];

function wing(level: number, style: BodyStyle, width: number, [z, y]: Point, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  if (level === 0) {
    if (style !== "coupe") return [];
    return [tint(box(1.6, 0.05, 0.3, 0, y + 0.13, z), paint), ...[-1, 1].map((side) => tint(box(0.06, 0.13, 0.12, side * 0.6, y + 0.065, z + 0.02), trim))];
  }
  const { lift, span: share, thick, chord } = WINGS[Math.min(level, WINGS.length) - 1];
  const span = width * share;
  const parts = [tint(box(span, thick, chord, 0, y + lift, z - 0.04), paint)];
  if (level > 2) parts.push(tint(new THREE.BoxGeometry(span, 0.035, 0.2).rotateX(0.55).translate(0, y + lift + 0.09, z - 0.04 - chord / 2), paint));
  for (const side of [-1, 1]) {
    parts.push(tint(box(0.06, lift, 0.14, side * width * 0.32, y + lift / 2, z), trim));
    if (level === 2) parts.push(tint(box(0.04, 0.2, 0.48, (side * span) / 2, y + lift, z - 0.04), trim));
    if (level > 2) parts.push(tint(box(0.03, 0.24, chord + 0.1, (side * span) / 2, y + lift + 0.05, z - 0.09), trim));
  }
  return parts;
}

function face_at(outline: Point[], y: number): number {
  let face = -Infinity;
  for (let i = 0; i + 1 < outline.length; i++) {
    const [z0, y0] = outline[i];
    const [z1, y1] = outline[i + 1];
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1) || y0 === y1) continue;
    face = Math.max(face, z0 + ((z1 - z0) * (y - y0)) / (y1 - y0));
  }
  return face;
}

const NO_AERO: Required<Look>["aero"] = { wing: 0 };
const FRONT_LEVEL = { lip: 1, splitter: 2 } as const;

function aero_parts(d: Design, spec: CarSpec, aero: Required<Look>["aero"], paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const [nose, low] = d.outline[0];
  const front = aero.front ? FRONT_LEVEL[aero.front] : 0;
  if (d.fronts) {
    const own = d.fronts[Math.min(front, d.fronts.length - 1)];
    out.push(...parts(own.paint).map((g) => tint(g, paint)), ...parts(own.trim).map((g) => tint(g, trim)));
  } else if (front > 0) {
    const splitter = front > 1;
    const reach = splitter ? 0.16 : 0.08;
    out.push(tint(box(d.width * (splitter ? 0.98 : 0.88), splitter ? 0.035 : 0.03, 0.2 + reach, 0, low - 0.01, nose - 0.1 + reach / 2), splitter ? trim : paint));
    if (splitter) {
      const y = low + 0.17;
      const z = face_at(d.outline, y);
      for (const side of [-1, 1]) out.push(tint(new THREE.BoxGeometry(0.18, 0.016, 0.14).rotateZ(side * 0.3).translate(side * (d.width / 2 - 0.12), y, z + 0.03), trim));
    }
  }
  if (aero.skirts && d.arches.steps > 0) out.push(...skirts(d, spec, 0.07, 0.16).map((g) => tint(g, paint)));
  if (aero.diffuser) {
    const [tail, bottom] = d.outline[d.outline.length - 1];
    const span = d.width * 0.82;
    const kick = (g: THREE.BufferGeometry) => tint(g.rotateX(0.2).translate(0, bottom + 0.03, tail + 0.1), trim);
    out.push(kick(new THREE.BoxGeometry(span, 0.025, 0.46)));
    for (const x of [-0.42, -0.16, 0.16, 0.42]) out.push(kick(new THREE.BoxGeometry(0.02, 0.1, 0.42).translate(x * span, -0.05, 0)));
  }
  return out;
}

// Engine bulges are sized for a saloon hood; a narrower body (the formula's engine cover) scales them down to fit.
const BULGE_BODY = 1.7;
const STOCK_TYRE: Required<Look>["tyre"] = { width: 1, rim: 1 };
const STOCK_CALIPER: Required<Look>["caliper"] = { size: 1 };
const TREAD_BLOCKS = 12;

const chrome_tone = () => color(mix(brand.foreground, brand.background_lightest, 0.6));
const RIM_TONES: Record<Rim["tone"], () => THREE.Color> = {
  metal: chrome_tone,
  light: () => color(tones.check_light),
  bronze: () => color(mix(brand.warning, tones.trim, 0.7)),
};

function wheel_geometry(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"]): THREE.BufferGeometry {
  const tone = RIM_TONES[rim.tone]();
  const wide = width * look.width;
  const disc = radius * rim.size * look.rim;
  const rubber = color(tones.tyre);
  const pieces = [
    tint(new THREE.CylinderGeometry(radius, radius, wide, 8).rotateZ(Math.PI / 2), rubber),
    tint(new THREE.CylinderGeometry(disc, disc, wide + 0.02, 8).rotateZ(Math.PI / 2), rim.spokes ? color(tones.trim) : tone),
  ];
  // A dished rim: the lip is the polished disc's rim, the dark dish covers its centre and the spokes stand on the dish.
  const face = rim.lip ? disc * (1 - rim.lip) : disc;
  const step = rim.lip ? 0.01 : 0;
  if (rim.lip) {
    pieces[1] = tint(new THREE.CylinderGeometry(disc, disc, wide + 0.02, 8).rotateZ(Math.PI / 2), color(tones.check_light));
    pieces.push(tint(new THREE.CylinderGeometry(face, face, wide + 0.03, 8).rotateZ(Math.PI / 2), color(tones.tyre)));
  }
  for (let i = 0; i < rim.spokes; i++) pieces.push(tint(new THREE.BoxGeometry(wide + 0.04 + step, face * 1.9, rim.spoke ?? 0.06).rotateX((i * Math.PI) / rim.spokes), tone));
  if (rim.spokes) pieces.push(tint(new THREE.CylinderGeometry(face * 0.3, face * 0.3, wide + 0.05 + step, 6).rotateZ(Math.PI / 2), tone));
  if (look.band) pieces.push(tint(new THREE.CylinderGeometry(disc + 0.022, disc + 0.022, wide + 0.01, 8).rotateZ(Math.PI / 2), color(brand[look.band])));
  if (look.tread)
    for (let i = 0; i < TREAD_BLOCKS; i++)
      pieces.push(tint(new THREE.BoxGeometry(wide * 0.46, 0.05, 0.1).translate((i % 2 ? 1 : -1) * wide * 0.26, radius, 0).rotateX((i * 2 * Math.PI) / TREAD_BLOCKS), rubber));
  return merge(...pieces);
}

// Fixed to the steering knuckle, not the spinning wheel. Stock hides behind the spokes; an upgrade sits proud of them so
// its colour reads at speed and on disc rims.
function caliper_geometry(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"], { size, tone }: Required<Look>["caliper"]): THREE.BufferGeometry {
  const disc = radius * rim.size * look.rim;
  const proud = tone ? 0.046 : 0.03;
  return tint(new THREE.BoxGeometry(width * look.width + proud, disc * 0.3 * size, disc * 0.5 * size).translate(0, disc * 0.68, 0).rotateX(-0.8), color(tone ? brand[tone] : tones.trim));
}

function hood_tilt(d: Design, z: number): number {
  return -Math.atan2(top_at(d.outline, z + 0.2) - top_at(d.outline, z - 0.2), 0.4);
}

function panel(outline: Point[], from: number, to: number, width: number): THREE.BufferGeometry {
  const zs = Array.from({ length: 7 }, (_, i) => from + ((to - from) * i) / 6);
  const top = zs.map((z): Point => [z, top_at(outline, z) + 0.012]);
  const under = [...zs].reverse().map((z): Point => [z, top_at(outline, z) - 0.02]);
  return extrude([...top, ...under], width);
}

/** Engine bulge or scoop and tailpipes, and the bare panels of a weight-stripped car. */
function kit_parts(d: Design, kit: Record<Slot, number>, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const base = d.cabin.points[0][0];
  const nose = d.outline[0][0];
  if (kit.weight > 0) {
    const bare = paint.clone().lerp(trim, 0.75);
    out.push(tint(panel(d.outline, base + 0.05, base + (nose - base) * 0.85, d.width * 0.72), bare));
    const rear = d.cabin.points[d.cabin.points.length - 1][0] - 0.05;
    const tail = d.outline[d.outline.length - 1][0] + 0.15;
    if (kit.weight > 1 && rear - tail > 0.2) out.push(tint(panel(d.outline, tail, rear, d.width * 0.72), bare));
  }
  const engine = kit.engine;
  if (engine > 0) {
    const [z, y] = d.hood;
    const tilt = hood_tilt(d, z);
    const [stock_w, h, l] = engine === 1 ? [0.56, 0.045, 0.7] : [0.5, 0.11, 0.6];
    const w = stock_w * Math.min(1, d.width / BULGE_BODY);
    out.push(tint(new THREE.BoxGeometry(w, h, l).translate(0, h / 2, 0).rotateX(tilt).translate(0, y, z), paint));
    if (engine > 1) out.push(tint(new THREE.BoxGeometry(w * 0.8, h * 0.6, 0.02).translate(0, h * 0.5, l / 2 + 0.005).rotateX(tilt).translate(0, y, z), trim));
    const [x, py, pz] = d.exhaust;
    const central = x === 0;
    const r = (engine === 1 ? 0.045 : 0.052) * (central ? 1.4 : 1);
    const xs = central || engine === 1 ? [x] : [x - 0.065, x + 0.065];
    const chrome = chrome_tone();
    for (const side of central ? [1] : [-1, 1])
      for (const at of xs) {
        out.push(tint(new THREE.CylinderGeometry(r, r, 0.22, 8).rotateX(Math.PI / 2).translate(side * at, py, pz - 0.05), chrome));
        out.push(tint(new THREE.CylinderGeometry(r * 0.65, r * 0.65, 0.22, 8).rotateX(Math.PI / 2).translate(side * at, py, pz - 0.056), trim));
      }
  }
  const bottle = part_of("nitro", kit.nitro).look?.bottle;
  if (bottle && d.bottles !== "inside") {
    const rear = d.cabin.points[d.cabin.points.length - 1][0];
    const tail = d.outline[d.outline.length - 1][0];
    const r = 0.065 * bottle.size;
    const z = typeof d.bottles === "number" ? d.bottles : (rear + tail) / 2;
    const y = top_at(d.outline, z) + r;
    const length = 0.46 * bottle.size;
    const tank = color(brand.info);
    const chrome = chrome_tone();
    for (const dz of bottle.twin ? [-r * 1.1, r * 1.1] : [0]) {
      out.push(tint(new THREE.CylinderGeometry(r, r, length, 10).rotateZ(Math.PI / 2).translate(0, y, z + dz), tank));
      out.push(tint(new THREE.CylinderGeometry(r * 0.45, r * 0.6, 0.08, 8).rotateZ(Math.PI / 2).translate(length / 2 + 0.04, y, z + dz), chrome));
    }
  }
  return out;
}

const FLAME_LENGTH = 1;

function flame_mesh(d: Design): THREE.Mesh {
  const [x, y, z] = d.exhaust;
  const outer = color(brand.info);
  const core = color(brand.cottontail);
  const cone = (r: number, length: number, side: number, tone: THREE.Color) =>
    tint(new THREE.ConeGeometry(r, length, 8).rotateX(-Math.PI / 2).translate(side * x, y, -length / 2), tone);
  const geometry = merge((x === 0 ? [1] : [-1, 1]).flatMap((side) => [cone(0.15, FLAME_LENGTH, side, outer), cone(0.07, FLAME_LENGTH * 0.6, side, core)]));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.position.z = z - 0.16;
  mesh.visible = false;
  return mesh;
}

/** Shows or hides the nitro flame; `time` in seconds drives its flicker. */
export function show_flame(view: CarView, on: boolean, time: number) {
  const { flame } = view;
  flame.visible = on;
  if (!on) return;
  const flicker = Math.sin(time * 61) * Math.sin(time * 23 + 1);
  flame.scale.set(1 + 0.15 * flicker, 1 + 0.15 * flicker, 0.75 + 0.25 * flicker);
}

const PANEL_MARGIN = 0.06;
const PANEL_FLOOR = 0.08;
const PANEL_ROOF = 0.05;

function top_at(outline: Point[], z: number): number {
  let top = -Infinity;
  for (let i = 0; i + 1 < outline.length; i++) {
    const [z0, y0] = outline[i];
    const [z1, y1] = outline[i + 1];
    if (z < Math.min(z0, z1) || z > Math.max(z0, z1) || z0 === z1) continue;
    top = Math.max(top, y0 + ((y1 - y0) * (z - z0)) / (z1 - z0));
  }
  return top;
}

function side_panel(d: Design, spec: CarSpec): Panel {
  if (d.panel) return d.panel;
  const reach = spec.wheel.radius + d.arches.gap + d.arches.flare + PANEL_MARGIN;
  const front = spec.wheel.mounts[0][2] - reach;
  const rear = spec.wheel.mounts[2][2] + reach;
  let belt = Infinity;
  for (let i = 0; i <= 10; i++) belt = Math.min(belt, top_at(d.outline, rear + ((front - rear) * i) / 10));
  return { rear, front, low: d.sill + PANEL_FLOOR, high: belt - PANEL_ROOF, side: d.width / 2 };
}

const INK_CLASH = 0.1;
const NEUTRAL_CONTRAST = 0.15;

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function far_neutral(from: Lab): Lab {
  const [light, dark_ink] = decal_inks;
  return Math.abs(light[0] - from[0]) >= Math.abs(dark_ink[0] - from[0]) ? light : dark_ink;
}

/** Decal colours for a build: the chosen ink unless it would vanish on the paint, then the neutral that stands out. */
export function livery_of(build: Build): Livery {
  const paint = car_paints[build.paint % car_paints.length];
  const chosen = decal_inks[build.ink % decal_inks.length];
  const neutral = build.ink % decal_inks.length < NEUTRAL_INKS;
  const vanishes = neutral ? Math.abs(chosen[0] - paint[0]) < NEUTRAL_CONTRAST : distance(chosen, paint) < INK_CLASH;
  const ink = vanishes ? far_neutral(paint) : chosen;
  return {
    decal: DECALS[build.decal] ?? "none",
    number: build.number,
    ink: color(ink),
    key: neutral || vanishes ? null : color(far_neutral(paint)),
    mark: color(far_neutral(ink)),
  };
}

export function build_view(build: Build, spec: CarSpec = build_spec(build)): CarView {
  return car_view(color(car_paints[build.paint % car_paints.length]), spec, build.parts, livery_of(build));
}

// Paint, trim, glass and decals are baked into vertex colours so the whole shell is one draw; a repaint rebuilds the view.
export function car_view(paint: THREE.Color, spec: CarSpec = COUPE, kit: Record<Slot, number> = DEFAULT_PARTS, livery: Livery | null = null): CarView {
  const style = spec.body.style;
  const d = DESIGNS[style];
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -(rest_reach(spec) - spec.wheel.mounts[0][1]);
  const trim = color(tones.trim);
  const arch_tone = d.arches.tone === "paint" ? paint : trim;

  const glass = color(tones.glass);
  const stripped = kit.weight > 1;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const shell_body = extrude(body_outline(d, spec), d.width);
  const base = merge(
    tint(d.taper ? taper(shell_body, d.taper.from, tail, d.taper.share) : shell_body, paint),
    cabin_parts(d.cabin, paint, glass),
    flares(d, spec).map((g) => tint(g, arch_tone)),
    (d.slabs ?? []).flatMap((slab_part) => slab(slab_part.points, slab_part.from, slab_part.to)).map((g) => tint(g, paint)),
    skirts(d, spec, 0.03, 0.09).map((g) => tint(g, trim)),
    parts(d.paint).map((g) => tint(g, paint)),
    parts(d.trim).map((g) => tint(g, trim)),
    parts(livery && livery.decal !== "none" ? [] : (d.stripes ?? [])).map((g) => tint(g, trim)),
    parts(stripped ? [] : d.markers).map((g) => tint(g, color(brand.warning))),
    parts(stripped ? [] : d.chrome).map((g) => tint(g, chrome_tone())),
  );
  const decals = livery && livery.decal !== "none" ? livery_parts(livery, side_panel(d, spec), roof(base, glass), nose, tail) : [];
  // A level past the design's list keeps its biggest wing, so new aero parts never bolt a second one on.
  const aero = part_of("aero", kit.aero).look?.aero ?? NO_AERO;
  const own = d.wings ? d.wings[Math.min(aero.wing, d.wings.length - 1)] : null;
  const rear_wing = own ? [...parts(own.paint).map((g) => tint(g, paint)), ...parts(own.trim).map((g) => tint(g, trim))] : wing(aero.wing, style, d.width, d.deck, paint, trim);
  const shell = merge(base, rear_wing, aero_parts(d, spec, aero, paint, trim), kit_parts(d, kit, paint, trim), decals);
  const hull = new THREE.Mesh(shell, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  hull.castShadow = true;
  const halo = d.halo ? new THREE.Mesh(merge(parts(d.halo).map((g) => tint(g, trim))), hull.material) : null;
  if (halo) {
    halo.castShadow = true;
    body.add(halo);
  }

  const head_material = new THREE.MeshLambertMaterial({ color: color(tones.head), emissive: glow(tones.head), emissiveIntensity: 1.2 });
  const brake = new THREE.MeshLambertMaterial({ color: color(brand.error), emissive: glow(brand.error, BRAKE_GLOW), emissiveIntensity: 0.5 });
  const head_mesh = new THREE.Mesh(merge(parts(d.heads)), head_material);
  const flame = flame_mesh(d);
  body.add(hull, head_mesh, new THREE.Mesh(merge(parts(d.tails)), brake), flame);
  root.add(body);

  const tyre = part_of("tyres", kit.tyres).look?.tyre ?? STOCK_TYRE;
  const caliper = part_of("brakes", kit.brakes).look?.caliper ?? (d.caliper ? { ...STOCK_CALIPER, tone: d.caliper } : STOCK_CALIPER);
  const axles = [0, 1].map((axle) => wheel_geometry(spec.wheel.radius, d.tyre[axle], d.rim, tyre));
  const calipers = [0, 1].map((axle) => caliper_geometry(spec.wheel.radius, d.tyre[axle], d.rim, tyre, caliper));
  const wheel_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wheels = [0, 1, 2, 3].map((i) => {
    const steer = new THREE.Group();
    const spin = new THREE.Group();
    const mesh = new THREE.Mesh(axles[i < 2 ? 0 : 1], wheel_material);
    mesh.castShadow = true;
    spin.add(mesh);
    steer.add(spin, new THREE.Mesh(calipers[i < 2 ? 0 : 1], wheel_material));
    root.add(steer);
    return steer;
  });
  return { root, body, wheels, brake, heads: head_mesh, halo, eye: d.eye ? new THREE.Vector3(0, body.position.y + d.eye[1], d.eye[0]) : null, flame };
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
// reads as hovering; this is that patch, tinted from the theme rather than black. It multiplies what is under it: a plain
// blend toward the darkest token comes out lighter than lit asphalt of that same token.
export function contact_shadow(): ContactShadow {
  const strength = dark ? 0.7 : 0.4;
  const material = new THREE.MeshBasicMaterial({
    color: color(tones.skid),
    alphaMap: blob_texture(),
    transparent: true,
    opacity: strength,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
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
  const ground = world.height(x, z, y);
  world.normal(x, z, ground_normal, y);
  shadow.mesh.position.set(x, ground + 0.05, z);
  tilt.setFromUnitVectors(up, ground_normal);
  yaw.setFromAxisAngle(up, heading);
  shadow.mesh.quaternion.copy(tilt).multiply(yaw);
  const lift = Math.max(0, y - ground - 0.5);
  shadow.material.opacity = shadow.strength * Math.max(0, 1 - lift / 3);
}
