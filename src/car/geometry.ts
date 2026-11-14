import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Triple } from "./cars";

export type Point = [number, number];

/** A box mirrored to both sides: size, centre of the left one, and an optional [x, y, z] tilt in radians. */
export interface Part {
  size: Triple;
  at: Triple;
  tilt?: Triple;
  /** An eight-sided disc facing forward instead of a box: `size` x is its diameter, z its depth. */
  round?: boolean;
}

export function merge(...parts: (THREE.BufferGeometry | THREE.BufferGeometry[])[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts.flat().map((part) => (part.index ? part.toNonIndexed() : part)));
  if (!geometry) throw new Error("mergeGeometries: parts have mismatched attributes");
  return geometry;
}

export function tint(geometry: THREE.BufferGeometry, tone: THREE.Color): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const colors = new Float32Array(flat.getAttribute("position").count * 3);
  for (let i = 0; i < colors.length; i += 3) tone.toArray(colors, i);
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

export function extrude(profile: [number, number][], width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  return geometry.translate(0, 0, -width / 2).rotateY(-Math.PI / 2);
}

export function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

export function arc(z: number, y: number, radius: number, floor: number, steps: number): Point[] {
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

export function inset(points: Point[], by: number[]): Point[] {
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

export function clip(points: Point[], at: number, keep: number): Point[] {
  const out: Point[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const p_in = (p[0] - at) * keep >= 0;
    if (p_in) out.push(p);
    if (p_in !== (q[0] - at) * keep >= 0) out.push([at, p[1] + ((q[1] - p[1]) * (at - p[0])) / (q[0] - p[0])]);
  });
  return out;
}

export function screen(points: Point[], edge: number, end: number): Point[] {
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
export function lean(geometry: THREE.BufferGeometry, from: number, to: number, share: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * (1 - (share * (position.getY(i) - from)) / (to - from)));
  return geometry;
}

export function taper(geometry: THREE.BufferGeometry, from: number, tail: number, share: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const k = Math.max(0, Math.min(1, (from - position.getZ(i)) / (from - tail)));
    position.setX(i, position.getX(i) * (1 - (1 - share) * k));
  }
  return geometry;
}

export function slab(points: Point[], from: number, to: number): THREE.BufferGeometry[] {
  return [-1, 1].map((side) => extrude(points, to - from).translate((side * (from + to)) / 2, 0, 0));
}

export function parts(list: Part[]): THREE.BufferGeometry[] {
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

export function face_at(outline: Point[], y: number): number {
  let face = -Infinity;
  for (let i = 0; i + 1 < outline.length; i++) {
    const [z0, y0] = outline[i];
    const [z1, y1] = outline[i + 1];
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1) || y0 === y1) continue;
    face = Math.max(face, z0 + ((z1 - z0) * (y - y0)) / (y1 - y0));
  }
  return face;
}

export function top_at(outline: Point[], z: number): number {
  let top = -Infinity;
  for (let i = 0; i + 1 < outline.length; i++) {
    const [z0, y0] = outline[i];
    const [z1, y1] = outline[i + 1];
    if (z < Math.min(z0, z1) || z > Math.max(z0, z1) || z0 === z1) continue;
    top = Math.max(top, y0 + ((y1 - y0) * (z - z0)) / (z1 - z0));
  }
  return top;
}

interface Crossing {
  at: Point;
  along: number;
  chain: number;
  leaving: boolean;
}

/**
 * The pieces of a simple polygon where `n·p + c > 0`, one ring per separate region. Unlike `clip`, a cut across a
 * notch (a wheel arch reaching over the belt) yields two pieces instead of one bridged along the cut line.
 */
export function split(points: Point[], n: Point, c: number): Point[][] {
  const side = points.map(([z, y]) => n[0] * z + n[1] * y + c);
  if (side.every((s) => s > 0)) return [points];
  const start = side.findIndex((s) => s <= 0);
  const chains: Point[][] = [];
  const crossings: Crossing[] = [];
  for (let k = 0; k < points.length; k++) {
    const i = (start + k) % points.length;
    const j = (i + 1) % points.length;
    const [p, q] = [points[i], points[j]];
    if (side[i] > 0) chains[chains.length - 1].push(p);
    if (side[i] > 0 === side[j] > 0) continue;
    const t = side[i] / (side[i] - side[j]);
    const at: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const leaving = side[i] > 0;
    if (leaving) chains[chains.length - 1].push(at);
    else chains.push([at]);
    crossings.push({ at, along: at[1] * n[0] - at[0] * n[1], chain: chains.length - 1, leaving });
  }
  crossings.sort((x, y) => x.along - y.along);
  // Sorted along the line, crossings pair into the stretches inside the polygon; each joins a chain's exit to an entry.
  const next: number[] = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const [out, back] = crossings[i].leaving ? [crossings[i], crossings[i + 1]] : [crossings[i + 1], crossings[i]];
    next[out.chain] = back.chain;
  }
  const done = new Set<number>();
  const rings: Point[][] = [];
  chains.forEach((_, first) => {
    const ring: Point[] = [];
    for (let at = first; !done.has(at); at = next[at]) {
      done.add(at);
      ring.push(...chains[at]);
    }
    if (ring.length >= 3) rings.push(ring);
  });
  return rings;
}

/** Rearmost z of the outline at height y: the tail face, as `face_at` gives the nose. */
export function tail_at(outline: Point[], y: number): number {
  let face = Infinity;
  for (let i = 0; i + 1 < outline.length; i++) {
    const [z0, y0] = outline[i];
    const [z1, y1] = outline[i + 1];
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1) || y0 === y1) continue;
    face = Math.min(face, z0 + ((z1 - z0) * (y - y0)) / (y1 - y0));
  }
  return face;
}
