import * as THREE from "three";
import { DECALS, type Build, type Decal } from "./build";
import { paint_lab } from "./paint";
import { NEUTRAL_INKS, color, dark, decal_inks } from "../theme/palette";
import type { Lab } from "../theme/theme";

type Point = [number, number];

/** The flat body side between the wheel arches, where side decals go: z from `rear` to `front`, y from `low` to `high`. */
export interface Panel {
  rear: number;
  front: number;
  low: number;
  high: number;
  side: number;
}

export interface Livery {
  decal: Decal;
  number: number;
  ink: THREE.Color;
  /** Outline under a paint-coloured ink, so two brand colours never touch; null for a neutral ink. */
  key: THREE.Color | null;
  mark: THREE.Color;
}

interface Hit {
  y: number;
  normal: THREE.Vector3;
}

/** Highest painted surface straight below (x, z), or null over glass or past the body. */
export type Roof = (x: number, z: number) => Hit | null;

const KEY_LIFT = 0.008;
const INK_LIFT = 0.016;
const MARK_LIFT = 0.024;
const KEY_WIDTH = 0.022;
const STEP = 0.05;
// A larger rise between samples is a different surface (windscreen base, deck lip), not a slope to follow.
const JUMP = 0.2;
const FLAT_ENOUGH = 0.15;
// Career reward motifs repeat on the roof and the tail, the faces the chase camera sees: on the roof across this share
// of the body's width, inset this share from each end, draped in triangles no longer than `DRAPE` so they follow its curve.
const ROOF_WIDTH = 0.78;
const ROOF_INSET = 0.06;
const MIN_ROOF = 0.4;
const DRAPE = 0.08;
const TAIL_INSET = 0.08;
const TAIL_SCAN = 2;

const SEGMENTS: Record<string, Point[]> = {
  a: [[0, 1], [1, 1]],
  b: [[1, 1], [1, 0.5]],
  c: [[1, 0.5], [1, 0]],
  d: [[0, 0], [1, 0]],
  e: [[0, 0.5], [0, 0]],
  f: [[0, 1], [0, 0.5]],
  g: [[0, 0.5], [1, 0.5]],
};
const DIGITS = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];

export const FLAME: Point[] = [[1, 0.1], [0.55, 0.1], [0.3, 0.22], [0.6, 0.3], [0.22, 0.48], [0.58, 0.52], [0.34, 0.72], [0.7, 0.7], [0.52, 0.9], [1, 0.9]];
export const SIDE_BAND: Point[][] = [
  [[0, 0.4], [0.9, 0.4], [1, 0.62], [0.1, 0.62]],
  [[0, 0.24], [0.84, 0.24], [0.87, 0.31], [0.03, 0.31]],
];
export const SLASH: Point[][] = [
  [[0.2, 0.06], [0.44, 0.06], [0.8, 0.94], [0.56, 0.94]],
  [[0.06, 0.06], [0.14, 0.06], [0.5, 0.94], [0.42, 0.94]],
];

// Career reward motifs, one per tier final's world: Sky Track chevrons, Volcano lava cracks, Ice canyon frost shards bursting from one point.
// Points are door space like the decals above: u rear to front, v sill to window line. Shards are drawn in square space
// and squashed by SQUARE, about the door's length over its height, so they keep their angles.
const SQUARE = 4.5;

function chevron(u: number, low: number, high: number): Point[] {
  const thick = 0.09;
  const depth = 0.12;
  const mid = (low + high) / 2;
  return [[u, low], [u + thick, low], [u + thick + depth, mid], [u + thick, high], [u, high], [u + depth, mid]];
}

/** A crack along `line`, `half` thick at each point, across v when it runs lengthwise and across u when it rises. */
function crack(line: Point[], half: readonly number[], across: 0 | 1): Point[] {
  const side = (s: number) => line.map(([u, v], i): Point => (across ? [u, v + s * half[i]] : [u + s * half[i], v]));
  const ring = [...side(1), ...side(-1).reverse()];
  return ring.filter(([u, v], i) => {
    const [pu, pv] = ring[(i - 1 + ring.length) % ring.length];
    return u !== pu || v !== pv;
  });
}

function shard(u: number, v: number, tilt: number, length: number, width: number): Point[] {
  const along = (t: number, off: number): Point => {
    const x = Math.sin(tilt) * t + Math.cos(tilt) * off;
    const y = Math.cos(tilt) * t - Math.sin(tilt) * off;
    return [u + x / SQUARE, v + y];
  };
  return [along(0, 0), along(length * 0.4, width), along(length, 0), along(length * 0.4, -width)];
}

const FISSURE: Point[] = [[0.04, 0.2], [0.17, 0.15], [0.3, 0.25], [0.44, 0.16], [0.58, 0.26], [0.72, 0.15], [0.86, 0.23], [0.96, 0.19]];
const FISSURE_HALF = [0, 0.06, 0.09, 0.1, 0.1, 0.09, 0.06, 0];
const BRANCHES: Point[][] = [
  [[0.3, 0.25], [0.26, 0.42], [0.31, 0.56], [0.27, 0.72]],
  [[0.58, 0.26], [0.62, 0.45], [0.57, 0.6]],
  [[0.72, 0.15], [0.76, 0.33], [0.73, 0.48], [0.78, 0.62], [0.75, 0.8]],
];
const taper = (line: Point[], base: number) => line.map((_, i) => base * (1 - i / (line.length - 1)));

export const REWARD_MOTIFS: Record<"sky" | "volcano" | "ice", Point[][]> = {
  sky: [chevron(0.24, 0.28, 0.72), chevron(0.42, 0.18, 0.82), chevron(0.6, 0.08, 0.92)],
  volcano: [crack(FISSURE, FISSURE_HALF, 1), ...BRANCHES.map((line) => crack(line, taper(line, 0.03), 0))],
  ice: [
    [1.5, 2.6, 0.16], [1.3, 2.1, 0.15], [1.05, 1.5, 0.14], [0.75, 1, 0.12], [1.65, 1.5, 0.1],
  ].map(([tilt, length, width]) => shard(0.06, 0.2, tilt, length, width)),
};

export function roof(shell: THREE.BufferGeometry, glass: THREE.Color): Roof {
  if (shell.index) throw new Error("roof: shell must be non-indexed");
  const position = shell.getAttribute("position");
  const tone = shell.getAttribute("color");
  const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; normal: THREE.Vector3; glass: boolean }[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const [a, b, c] = [i, i + 1, i + 2].map((k) => new THREE.Vector3().fromBufferAttribute(position, k));
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    if (Math.abs(normal.y) < FLAT_ENOUGH) continue;
    if (normal.y < 0) normal.negate();
    const is_glass = Math.abs(tone.getX(i) - glass.r) + Math.abs(tone.getY(i) - glass.g) + Math.abs(tone.getZ(i) - glass.b) < 1e-4;
    tris.push({ a, b, c, normal, glass: is_glass });
  }
  return (x, z) => {
    let best: (Hit & { glass: boolean }) | null = null;
    for (const { a, b, c, normal, glass } of tris) {
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det;
      const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y = u * a.y + v * b.y + (1 - u - v) * c.y;
      if (!best || y > best.y) best = { y, normal, glass };
    }
    return best && !best.glass ? best : null;
  };
}

// Reuses `Hit`, so its `y` holds the surface's z. Glass or trim in front of the paint hides it, as `roof` does.
export type Back = (x: number, y: number) => Hit | null;

const FACING_BACK = 0.5;

export function back(shell: THREE.BufferGeometry, paint_tone: THREE.Color): Back {
  const position = shell.getAttribute("position");
  const tone = shell.getAttribute("color");
  const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; normal: THREE.Vector3; painted: boolean }[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const painted = Math.abs(tone.getX(i) - paint_tone.r) + Math.abs(tone.getY(i) - paint_tone.g) + Math.abs(tone.getZ(i) - paint_tone.b) < 1e-4;
    const [a, b, c] = [i, i + 1, i + 2].map((k) => new THREE.Vector3().fromBufferAttribute(position, k));
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    if (Math.abs(normal.z) < FACING_BACK) continue;
    if (normal.z > 0) normal.negate();
    tris.push({ a, b, c, normal, painted });
  }
  return (x, y) => {
    let best: (Hit & { painted: boolean }) | null = null;
    for (const { a, b, c, normal, painted } of tris) {
      const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / det;
      const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const z = u * a.z + v * b.z + (1 - u - v) * c.z;
      if (!best || z < best.y) best = { y: z, normal, painted };
    }
    return best && best.painted ? best : null;
  };
}

function paint(positions: number[], tone: THREE.Color): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < colors.length; i += 3) tone.toArray(colors, i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const ab = new THREE.Vector3();
const ac = new THREE.Vector3();

function face(out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, facing: THREE.Vector3) {
  const flip = ab.subVectors(b, a).cross(ac.subVectors(c, a)).dot(facing) < 0;
  out.push(...a.toArray(), ...(flip ? c : b).toArray(), ...(flip ? b : c).toArray());
}

function signed_area(points: Point[]): number {
  return points.reduce((sum, [x, y], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    return sum + x * y2 - x2 * y;
  }, 0);
}

/** Offsets a simple polygon outward by `by`, with miters capped so sharp flame tips stay short. */
function grow(points: Point[], by: number): Point[] {
  const turn = Math.sign(signed_area(points));
  const n = points.length;
  return points.map(([x, y], i) => {
    const [px, py] = points[(i - 1 + n) % n];
    const [nx, ny] = points[(i + 1) % n];
    const e1 = normalized(x - px, y - py);
    const e2 = normalized(nx - x, ny - y);
    const n1: Point = [e1[1] * turn, -e1[0] * turn];
    const n2: Point = [e2[1] * turn, -e2[0] * turn];
    const mid = normalized(n1[0] + n2[0], n1[1] + n2[1]);
    const cos = Math.max(0.5, mid[0] * n1[0] + mid[1] * n1[1]);
    return [x + (mid[0] * by) / cos, y + (mid[1] * by) / cos];
  });
}

function normalized(x: number, y: number): Point {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

function on_side(out: number[], polygons: Point[][], side: number, panel: Panel, lift: number) {
  const x = side * (panel.side + lift);
  const facing = new THREE.Vector3(side, 0, 0);
  for (const points of polygons) {
    const flat = points.map(([z, y]) => new THREE.Vector2(z, y));
    const at = points.map(([z, y]) => new THREE.Vector3(x, y, z));
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(flat, [])) face(out, at[i], at[j], at[k], facing);
  }
}

// Draped sample by sample so it follows hood, scoop, roof and deck on every body; glass breaks it, as real stripes stop at the screen.
function strip(out: number[], roof: Roof, x0: number, x1: number, front: number, rear: number, lift: number) {
  const up = new THREE.Vector3(0, 1, 0);
  let last: [THREE.Vector3, THREE.Vector3] | null = null;
  for (let z = front; z >= rear; z -= STEP) {
    const a = roof(x0, z);
    const b = roof(x1, z);
    if (!a || !b) {
      last = null;
      continue;
    }
    const pa = new THREE.Vector3(x0, a.y, z).addScaledVector(a.normal, lift);
    const pb = new THREE.Vector3(x1, b.y, z).addScaledVector(b.normal, lift);
    if (last && Math.abs(pa.y - last[0].y) < JUMP && Math.abs(pb.y - last[1].y) < JUMP) {
      face(out, last[0], last[1], pb, up);
      face(out, last[0], pb, pa, up);
    }
    last = [pa, pb];
  }
}

interface Run {
  front: number;
  rear: number;
}

/** The roof along the centre line: of the stretches of painted top between glass and steps, the highest one. */
function top_run(over: Roof, front: number, rear: number): Run | null {
  let best: (Run & { y: number }) | null = null;
  let run: (Run & { y: number }) | null = null;
  let last: number | null = null;
  const close = () => {
    if (run && run.front - run.rear >= MIN_ROOF && (!best || run.y > best.y)) best = run;
    run = null;
  };
  for (let z = front; z >= rear; z -= STEP) {
    const hit = over(0, z);
    if (!hit || (last !== null && Math.abs(hit.y - last) > JUMP)) close();
    last = hit ? hit.y : null;
    if (!hit) continue;
    if (run) {
      run.rear = z;
      run.y = Math.max(run.y, hit.y);
    } else run = { front: z, rear: z, y: hit.y };
  }
  close();
  return best;
}

type Tri = [THREE.Vector2, THREE.Vector2, THREE.Vector2];

function split(tri: Tri): Tri[] {
  const [a, b, c] = tri;
  if (Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) <= DRAPE) return [tri];
  const ab2 = a.clone().add(b).multiplyScalar(0.5);
  const bc2 = b.clone().add(c).multiplyScalar(0.5);
  const ca2 = c.clone().add(a).multiplyScalar(0.5);
  return [[a, ab2, ca2], [ab2, b, bc2], [ca2, bc2, c], [ab2, bc2, ca2]].flatMap((t) => split(t as Tri));
}

interface Sampled {
  at: THREE.Vector3;
  normal: THREE.Vector3;
  /** How far the surface sits along its facing, so a jump between samples reads as a step. */
  depth: number;
}

type Sample = (a: number, b: number) => Sampled | null;

const on_roof = (over: Roof): Sample => (x, z) => {
  const hit = over(x, z);
  return hit && { at: new THREE.Vector3(x, hit.y, z), normal: hit.normal, depth: hit.y };
};

const on_tail = (behind: Back): Sample => (x, y) => {
  const hit = behind(x, y);
  return hit && { at: new THREE.Vector3(x, y, hit.y), normal: hit.normal, depth: hit.y };
};

// A piece off the paint or across a step is left out, as stripes stop at the screen.
function drape(out: number[], polygons: Point[][], sample: Sample, lift: number, facing: THREE.Vector3) {
  for (const points of polygons) {
    const flat = points.map(([a, b]) => new THREE.Vector2(a, b));
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(flat, []))
      for (const tri of split([flat[i], flat[j], flat[k]])) {
        const hits = tri.map((p) => sample(p.x, p.y));
        if (hits.some((hit) => !hit)) continue;
        const depths = hits.map((hit) => hit!.depth);
        if (Math.max(...depths) - Math.min(...depths) > JUMP) continue;
        const [a, b, c] = hits.map((hit) => hit!.at.clone().addScaledVector(hit!.normal, lift));
        face(out, a, b, c, facing);
      }
  }
}

interface Box {
  low: number;
  high: number;
  half: number;
}

function tail_box(behind: Back): Box | null {
  const runs: { low: number; high: number }[] = [];
  let last: number | null = null;
  for (let y = 0; y <= TAIL_SCAN; y += STEP / 2) {
    const hit = behind(0, y);
    const run = runs[runs.length - 1];
    if (hit && run && last !== null && Math.abs(hit.y - last) < JUMP) run.high = y;
    else if (hit) runs.push({ low: y, high: y });
    last = hit ? hit.y : null;
  }
  const tallest = runs.reduce<{ low: number; high: number } | null>((best, run) => (!best || run.high - run.low > best.high - best.low ? run : best), null);
  if (!tallest || tallest.high - tallest.low < STEP) return null;
  const mid = (tallest.low + tallest.high) / 2;
  let half = 0;
  while (half < TAIL_SCAN && behind(half + STEP / 2, mid) && behind(-half - STEP / 2, mid)) half += STEP / 2;
  return half > 0 ? { ...tallest, half } : null;
}

const NO_LAYERS: Layers = { key: [], ink: [], mark: [] };

function keyed_ink(livery: Livery, ink: Point[][]): Layers {
  return { key: livery.key ? ink.map((p) => grow(p, KEY_WIDTH)) : [], ink, mark: [] };
}

function motif(livery: Livery): Point[][] | null {
  return livery.decal === "sky" || livery.decal === "volcano" || livery.decal === "ice" ? REWARD_MOTIFS[livery.decal] : null;
}

function roof_layers(livery: Livery, panel: Panel, over: Roof, front: number, rear: number): Layers {
  const shapes = motif(livery);
  const run = shapes && top_run(over, front, rear);
  if (!shapes || !run) return NO_LAYERS;
  const length = run.front - run.rear;
  const z0 = run.rear + length * ROOF_INSET;
  const span = length * (1 - 2 * ROOF_INSET);
  const width = panel.side * 2 * ROOF_WIDTH;
  return keyed_ink(livery, shapes.map((points) => points.map(([u, v]): Point => [(v - 0.5) * width, z0 + u * span])));
}

// On the tail u runs left to right as the chase camera sees it, which is toward -x.
function tail_layers(livery: Livery, behind: Back): Layers {
  const shapes = motif(livery);
  const box = shapes && tail_box(behind);
  if (!shapes || !box) return NO_LAYERS;
  const width = box.half * 2 * (1 - 2 * TAIL_INSET);
  const height = (box.high - box.low) * (1 - 2 * TAIL_INSET);
  const low = box.low + (box.high - box.low) * TAIL_INSET;
  return keyed_ink(livery, shapes.map((points) => points.map(([u, v]): Point => [(0.5 - u) * width, low + v * height])));
}

function ring(z: number, y: number, radius: number, steps: number): Point[] {
  return Array.from({ length: steps }, (_, i): Point => [z + radius * Math.cos((i * 2 * Math.PI) / steps), y + radius * Math.sin((i * 2 * Math.PI) / steps)]);
}

function oval(z: number, y: number, rz: number, ry: number, tilt: number, steps: number): Point[] {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return Array.from({ length: steps }, (_, i): Point => {
    const a = (i * 2 * Math.PI) / steps;
    const dz = rz * Math.cos(a);
    const dy = ry * Math.sin(a);
    return [z + dz * cos - dy * sin, y + dz * sin + dy * cos];
  });
}

function digits(value: number, z: number, y: number, height: number, side: number): Point[][] {
  const text = String(value);
  const width = height * 0.52;
  const thick = height * 0.17;
  const gap = height * 0.18;
  const span = text.length * width + (text.length - 1) * gap;
  return [...text].flatMap((char, n) =>
    [...DIGITS[Number(char)]].map((segment): Point[] => {
      const [[u0, v0], [u1, v1]] = SEGMENTS[segment];
      const left = -span / 2 + n * (width + gap);
      const ua = left + Math.min(u0, u1) * (width - thick);
      const ub = left + Math.max(u0, u1) * (width - thick) + thick;
      const va = -height / 2 + Math.min(v0, v1) * (height - thick);
      const vb = -height / 2 + Math.max(v0, v1) * (height - thick) + thick;
      // Seen from +x the car's front is on the viewer's left, so screen-right runs toward -z there.
      return [[ua, va], [ub, va], [ub, vb], [ua, vb]].map(([u, v]): Point => [z - side * u, y + v]);
    }),
  );
}

interface Layers {
  key: Point[][];
  ink: Point[][];
  mark: Point[][];
}

function side_layers(livery: Livery, panel: Panel, side: number): Layers {
  const length = panel.front - panel.rear;
  const height = panel.high - panel.low;
  const at = (points: Point[]): Point[] => points.map(([u, v]) => [panel.rear + u * length, panel.low + v * height]);
  const z = (panel.front + panel.rear) / 2;
  const y = (panel.low + panel.high) / 2;
  const keyed = (ink: Point[][]): Layers => ({ key: livery.key ? ink.map((p) => grow(p, KEY_WIDTH)) : [], ink, mark: [] });
  switch (livery.decal) {
    case "side":
      return keyed(SIDE_BAND.map(at));
    case "slash":
      return keyed(SLASH.map(at));
    case "sky":
    case "volcano":
    case "ice":
      return keyed(REWARD_MOTIFS[livery.decal].map(at));
    case "flames":
      return keyed([at(FLAME)]);
    case "number": {
      const radius = Math.min(height * 0.46, 0.3);
      return { ...keyed([ring(z, y, radius, 14)]), mark: digits(livery.number, z, y, radius * 1.1, side) };
    }
    case "rabbit": {
      const h = height * 1.05;
      const base = panel.low - height * 0.06;
      const head = ring(z, base + h * 0.34, h * 0.2, 10);
      const ears = [-1, 1].map((s) => oval(z + s * h * 0.09, base + h * 0.7, h * 0.07, h * 0.24, -s * 0.22, 8));
      return keyed([head, ...ears]);
    }
    case "checker": {
      const band = height * 0.56;
      const square = band / 2;
      const count = Math.floor((length * 0.92) / square);
      const start = z - (count * square) / 2;
      const ink: Point[][] = [];
      for (let col = 0; col < count; col++)
        for (let row = 0; row < 2; row++) {
          if ((col + row) % 2) continue;
          const z0 = start + col * square;
          const y0 = y - square + row * square;
          ink.push([[z0, y0], [z0 + square, y0], [z0 + square, y0 + square], [z0, y0 + square]]);
        }
      const pad = KEY_WIDTH;
      const back: Point[] = [[start - pad, y - square - pad], [start + count * square + pad, y - square - pad], [start + count * square + pad, y + square + pad], [start - pad, y + square + pad]];
      return { key: [back], ink, mark: [] };
    }
    default:
      return { key: [], ink: [], mark: [] };
  }
}

export function livery_parts(livery: Livery, panel: Panel, over: Roof, behind: Back, front: number, rear: number): THREE.BufferGeometry[] {
  const width = panel.side * 2;
  const stripes: Point[] =
    livery.decal === "centre"
      ? [[-0.1 * width, 0.1 * width]]
      : livery.decal === "twin"
        ? [[-0.125 * width, -0.04 * width], [0.04 * width, 0.125 * width]]
        : [];
  const key: number[] = [];
  const ink: number[] = [];
  const mark: number[] = [];
  for (const [x0, x1] of stripes) {
    if (livery.key) strip(key, over, x0 - KEY_WIDTH, x1 + KEY_WIDTH, front, rear, KEY_LIFT);
    strip(ink, over, x0, x1, front, rear, INK_LIFT);
  }
  const up = new THREE.Vector3(0, 1, 0);
  const rearward = new THREE.Vector3(0, 0, -1);
  const top = roof_layers(livery, panel, over, front, rear);
  drape(key, top.key, on_roof(over), KEY_LIFT, up);
  drape(ink, top.ink, on_roof(over), INK_LIFT, up);
  const tail = tail_layers(livery, behind);
  drape(key, tail.key, on_tail(behind), KEY_LIFT, rearward);
  drape(ink, tail.ink, on_tail(behind), INK_LIFT, rearward);
  for (const side of [-1, 1]) {
    const layers = side_layers(livery, panel, side);
    on_side(key, layers.key, side, panel, KEY_LIFT);
    on_side(ink, layers.ink, side, panel, INK_LIFT);
    on_side(mark, layers.mark, side, panel, MARK_LIFT);
  }
  const key_tone = livery.decal === "checker" ? livery.mark : livery.key;
  return [
    key.length && key_tone ? paint(key, key_tone) : null,
    ink.length ? paint(ink, livery.ink) : null,
    mark.length ? paint(mark, livery.mark) : null,
  ].filter((g): g is THREE.BufferGeometry => g !== null);
}

const INK_CLASH = 0.1;
const NEUTRAL_CONTRAST = 0.15;
// Dusk lights the car from ahead, so the chase camera sees its paint in shade at about this share of its lightness: a
// dark ink that clears the paint's token still sinks into it there.
const DUSK_SHADE = 0.4;

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const seen = (paint: Lab) => (dark ? paint[0] * DUSK_SHADE : paint[0]);

function far_neutral(from: number): Lab {
  const [light, dark_ink] = decal_inks;
  return Math.abs(light[0] - from) >= Math.abs(dark_ink[0] - from) ? light : dark_ink;
}

/** Decal colours for a build: the chosen ink unless it would vanish on the paint as the light shows it, then the neutral that stands out. */
export function livery_of(build: Build): Livery {
  const paint = paint_lab(build.paint);
  const chosen = decal_inks[build.ink % decal_inks.length];
  const neutral = build.ink % decal_inks.length < NEUTRAL_INKS;
  const vanishes = neutral ? Math.abs(chosen[0] - seen(paint)) < NEUTRAL_CONTRAST : distance(chosen, paint) < INK_CLASH;
  const ink = vanishes ? far_neutral(seen(paint)) : chosen;
  return {
    decal: DECALS[build.decal] ?? "none",
    number: build.number,
    ink: color(ink),
    key: neutral || vanishes ? null : color(far_neutral(seen(paint))),
    mark: color(far_neutral(ink[0])),
  };
}
