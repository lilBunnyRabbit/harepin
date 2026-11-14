import * as THREE from "three";
import { axles_of } from "./axles";
import type { CarSpec } from "./cars";
import type { Cabin, Design } from "./designs";
import { arc, clip, extrude, inset, lean, parts, screen, slab, split, tint, top_at, type Point } from "./geometry";
import type { Panel } from "./livery";

const PANEL_MARGIN = 0.06;
const PANEL_FLOOR = 0.08;
const PANEL_ROOF = 0.05;
// The flare's opening and floor sit this far inside the body's arch cut and sill, or they share a plane and flicker.
const FLARE_PROUD = 0.004;
const ARCH_SKIN = 0.025;
// A lip narrows in these steps to fit under a low bonnet or deck, and no further than this.
const MIN_FLARE = 0.025;
const FLARE_STEP = 0.005;
// A well ends this far short of its tyre's inner face, tread blocks included.
const WELL_CLEAR = 0.04;
const VISOR_PROUD = 0.02;
// The kit band: its top over the sill, its depth, how far it sinks into the body side and stands proud of the arch lips.
const KIT_TOP = 0.045;
const KIT_DEEP = 0.16;
const KIT_SINK = 0.01;
const KIT_PROUD = 0.012;
const KIT_MIN = 0.06;
const KIT_STUB = 0.05;
const KIT_CHIN = 0.12;

export function cabin_parts(c: Cabin, paint: THREE.Color, glass: THREE.Color): THREE.BufferGeometry[] {
  const ys = c.points.map(([, y]) => y);
  const base = Math.min(...ys);
  const top = Math.max(...ys);
  if (c.helmet) return [tint(extrude(c.points, c.width), paint), ...(c.visor ? [tint(extrude(c.visor, c.width + VISOR_PROUD), glass)] : [])].map((g) => lean(g, base, top, c.tumble));
  const floor = c.floor ?? [];
  const outline = [...c.points, ...floor];
  const glazed = inset(outline, [...c.frame, ...floor.map(() => c.frame[c.frame.length - 1])]);
  const window = c.glass_to === undefined ? glazed : clip(glazed, c.glass_to, 1);
  const windows = c.split ? [clip(window, c.split[0] + c.split[1] / 2, 1), clip(window, c.split[0] - c.split[1] / 2, -1)] : [window];
  return [
    tint(extrude(outline, c.width), paint),
    ...windows.map((w) => tint(extrude(w, c.width + 0.02), glass)),
    ...c.screens.map(([edge, pillar]) => tint(extrude(screen(c.points, edge, Math.max(0.05, pillar * 0.6)), c.width - 2 * pillar), glass)),
  ].map((g) => lean(g, base, top, c.tumble));
}

export function on_glass(c: Cabin, geometries: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  const ys = c.points.map(([, y]) => y);
  return geometries.map((g) => lean(g, Math.min(...ys), Math.max(...ys), c.tumble));
}

/** The wheel opening the body cuts round the axle at `z`, from the rear end of its floor over the top to the front. */
export function arch_opening(d: Design, spec: CarSpec, z: number): Point[] {
  // An arch reaching over a low bonnet (the slabs stand above it) stays under the outline, or the outline crosses itself.
  const under = ([az, ay]: Point): Point => [az, Math.min(ay, top_at(d.outline, az) - ARCH_SKIN)];
  return arc(z, spec.wheel.radius, spec.wheel.radius + d.arches.gap, d.sill, d.arches.steps).map(under);
}

export function body_outline(d: Design, spec: CarSpec): Point[] {
  return [...d.outline, ...axles_of(spec).reverse().flatMap((a) => arch_opening(d, spec, a.z))];
}

/**
 * A block filling each wheel opening between the tyres' inner faces, a steered pair's swept to full lock: the body is
 * cut right across, and without it an arch shows the far wheel. A pod's well runs from the slab face that closes it to its own tyre.
 * `tyre_width` scales the design's tyres.
 */
export function wells(d: Design, spec: CarSpec, tyre_width: number): THREE.BufferGeometry[] {
  const pods = d.pods;
  if (d.arches.steps === 0 && !pods) return [];
  return axles_of(spec).flatMap((axle, i) => {
    const half = (d.tyre[Math.min(i, 1)] * tyre_width) / 2;
    const swept = axle.steer ? half * Math.cos(spec.lock) + spec.wheel.radius * Math.sin(spec.lock) : half;
    const inner = Math.abs(spec.wheel.mounts[axle.wheels[0]][0]) - swept - WELL_CLEAR;
    if (pods) return inner > pods.from ? slab(arc(axle.z, spec.wheel.radius, pods.radius, d.sill, pods.steps), pods.from, inner) : [];
    return inner > 0 ? [extrude(arch_opening(d, spec, axle.z), 2 * inner)] : [];
  });
}

/** `points` less every wheel opening, so a slab standing over a wheel never closes over its tyre. */
export function notch(points: Point[], d: Design, spec: CarSpec): Point[][] {
  if (d.arches.steps === 0) return [points];
  const radius = spec.wheel.radius + d.arches.gap;
  let pieces = [points];
  for (const { z } of axles_of(spec)) {
    const opening = arc(z, spec.wheel.radius, radius, d.sill, d.arches.steps);
    const kept: Point[][] = [];
    // The opening is convex: what lies outside it is the union of what lies past each edge, taken in turn.
    opening.forEach((p, i) => {
      const q = opening[(i + 1) % opening.length];
      const n: Point = [q[1] - p[1], p[0] - q[0]];
      const out = n[0] * (z - p[0]) + n[1] * (spec.wheel.radius - p[1]) > 0 ? -1 : 1;
      const c = -(n[0] * p[0] + n[1] * p[1]);
      kept.push(...pieces.flatMap((piece) => split(piece, [n[0] * out, n[1] * out], c * out)));
      pieces = pieces.flatMap((piece) => split(piece, [-n[0] * out, -n[1] * out], -c * out));
    });
    pieces = kept;
  }
  return pieces;
}

/** A lip round each wheel opening, the same width all the way round and on every axle: the widest that stays under the body top. */
export function flares(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  if (d.arches.flare <= 0) return [];
  const inner = spec.wheel.radius + d.arches.gap - FLARE_PROUD;
  const y = spec.wheel.radius;
  const edge = d.width / 2;
  const body_top = (at: number) => Math.max(top_at(d.outline, at), ...(d.slabs ?? []).map((s) => top_at(s.points, at)));
  const openings = axles_of(spec).map(({ z }) => ({ z, opening: arc(z, y, inner, d.sill, d.arches.steps) }));
  // Each lip vertex stands straight out from its opening vertex, so every facet keeps the opening's angle.
  const ring = (z: number, opening: Point[], flare: number) => opening.map(([oz, oy]): Point => [z + ((oz - z) * (inner + flare)) / inner, y + ((oy - y) * (inner + flare)) / inner]);
  let flare = d.arches.flare;
  while (flare > MIN_FLARE && openings.some(({ z, opening }) => ring(z, opening, flare).some(([lz, ly]) => ly > body_top(lz)))) flare -= FLARE_STEP;
  return openings.flatMap(({ z, opening }) => {
    const lip = ring(z, opening, flare).map(([lz, ly], i): Point => [lz, Math.max(opening[i][1], Math.min(ly, body_top(lz)))]);
    const lifted = [...lip, ...opening.reverse()].map(([pz, py]): Point => [pz, Math.max(py, d.sill + FLARE_PROUD)]);
    const top = Math.max(...lifted.map(([, ly]) => ly));
    return slab(lifted, edge - d.arches.reach, edge + d.arches.out).map((g) => flat_side(g, d, top));
  });
}

/**
 * Widens `geometry` so that, once sculpted with the body, its side runs straight from the sill to `top` instead of
 * folding at the belt: an arch lip keeps one flat face across the body's crease.
 */
function flat_side(geometry: THREE.BufferGeometry, d: Design, top: number): THREE.BufferGeometry {
  if (!d.section) return geometry;
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const [y, z] = [position.getY(i), position.getZ(i)];
    const [low, high] = [sculpt_factor(d, d.sill, z), sculpt_factor(d, top, z)];
    const share = Math.max(0, Math.min(1, (y - d.sill) / (top - d.sill)));
    position.setX(i, (position.getX(i) * (low + (high - low) * share)) / sculpt_factor(d, y, z));
  }
  return geometry;
}

/** Body length between the front and rear arches, `reach` short of each axle: [front, rear]. */
function wheel_span(spec: CarSpec, reach: number): [number, number] {
  const axles = axles_of(spec);
  return [axles[0].z - reach, axles[axles.length - 1].z + reach];
}

export function skirts(d: Design, spec: CarSpec, thick: number, deep: number): THREE.BufferGeometry[] {
  const reach = spec.wheel.radius + d.arches.gap + d.arches.flare;
  const [front, rear] = wheel_span(spec, reach);
  return parts([{ size: [thick, deep, front - rear], at: [d.width / 2 - 0.01 + thick / 2, d.sill + 0.045 - deep / 2, (front + rear) / 2] }]);
}

/** Bottom of the aero kit's band, which a front lip or splitter sits on. */
export const kit_floor = (d: Design) => d.sill + KIT_TOP - KIT_DEEP;

/**
 * The aero kit's lower band: deep skirts between the wheel openings, run on past them to the nose and the tail and closed
 * across both ends. It stands just proud of the arch lips, so each lip's feet sink into it and the kit reads as one piece.
 */
export function kit_band(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  const reach = spec.wheel.radius + d.arches.gap;
  const top = d.sill + KIT_TOP;
  const low = kit_floor(d);
  const inner = d.width / 2 - KIT_SINK;
  const outer = d.width / 2 + Math.max(KIT_MIN, d.arches.out + KIT_PROUD);
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const ends = [nose, ...axles_of(spec).flatMap(({ z }) => [z + reach, z - reach]), tail];
  const strips: THREE.BufferGeometry[] = [];
  for (let i = 0; i + 1 < ends.length; i += 2) {
    const [from, to] = [ends[i], ends[i + 1]];
    if (from - to < KIT_STUB) continue;
    const strip: Point[] = [[from, low], [from, top], [to, top], [to, low]];
    strips.push(...flat_pieces(d, strip).flatMap((piece) => slab(piece, inner, outer).map((g) => uncut(g, d))));
  }
  const across = (from: number, to: number) => extrude([[from, low], [from, top], [to, top], [to, low]], 2 * outer);
  return [...strips, across(nose, nose - KIT_CHIN), across(tail + KIT_CHIN, tail)];
}

export function side_panel(d: Design, spec: CarSpec): Panel {
  if (d.panel) return d.panel;
  const reach = spec.wheel.radius + d.arches.gap + d.arches.flare + PANEL_MARGIN;
  const [front, rear] = wheel_span(spec, reach);
  let belt = Infinity;
  for (let i = 0; i <= 10; i++) belt = Math.min(belt, top_at(d.outline, rear + ((front - rear) * i) / 10));
  // A decal that crossed the belt would bridge the shoulder's crease and sink into it.
  const high = d.section && d.section.shoulder > 0 ? Math.min(belt - PANEL_ROOF, Math.min(...d.section.belt) - 0.03) : belt - PANEL_ROOF;
  return { rear, front, low: d.sill + PANEL_FLOOR, high, side: d.width / 2 };
}

/** A side profile cut at the belt and at the ends of the pinched nose and tail, so every sculpted face stays flat. */
function flat_pieces(d: Design, outline: Point[]): Point[][] {
  const s = d.section;
  if (!s) return [outline];
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const slope = (s.belt[1] - s.belt[0]) / (tail - nose);
  const above = (keep: number) => split(outline, [-slope * keep, keep], (slope * nose - s.belt[0]) * keep);
  const front = nose - s.nose[1];
  const rear = tail + s.tail[1];
  const halves = s.shoulder > 0 || s.tuck > 0 ? [...above(-1), ...above(1)] : [outline];
  return halves.flatMap((piece) => [
    ...(s.nose[1] > 0 ? split(piece, [1, 0], -front) : []),
    ...split(piece, [-1, 0], front).flatMap((mid) => split(mid, [1, 0], -rear)),
    ...(s.tail[1] > 0 ? split(piece, [-1, 0], rear) : []),
  ]);
}

const ON_CUT = 1e-6;

/** `geometry` less the walls `flat_pieces` left between its pieces, which lie buried in the part on the body's own cuts. */
function uncut(geometry: THREE.BufferGeometry, d: Design): THREE.BufferGeometry {
  const s = d.section;
  if (!s) return geometry;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const slope = (s.belt[1] - s.belt[0]) / (tail - nose);
  const cuts = [(z: number, y: number) => y - s.belt[0] - slope * (z - nose), (z: number) => z - (nose - s.nose[1]), (z: number) => z - (tail + s.tail[1])];
  const position = geometry.getAttribute("position");
  const kept: number[] = [];
  for (let i = 0; i < position.count; i += 3)
    if (!cuts.some((cut) => [i, i + 1, i + 2].every((v) => Math.abs(cut(position.getZ(v), position.getY(v))) < ON_CUT))) kept.push(i, i + 1, i + 2);
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    const values = new Float32Array(kept.length * size);
    kept.forEach((v, k) => {
      for (let c = 0; c < size; c++) values[k * size + c] = attribute.getComponent(v, c);
    });
    out.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  return out;
}

export function body_pieces(d: Design, spec: CarSpec): Point[][] {
  return flat_pieces(d, body_outline(d, spec));
}

/** Share of its x a point keeps on a sculpted body: the shoulder over the belt, the tuck under it, the pinched ends. */
export function sculpt_factor(d: Design, y: number, z: number): number {
  const s = d.section;
  if (!s) return 1;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const top = Math.max(...d.outline.map(([, oy]) => oy));
  const rise = top - Math.max(...s.belt);
  const drop = Math.min(...s.belt) - d.sill;
  const belt = s.belt[0] + ((s.belt[1] - s.belt[0]) * (nose - z)) / (nose - tail);
  const side = y > belt ? s.shoulder * Math.min(1, (y - belt) / rise) : s.tuck * Math.min(1, (belt - y) / drop);
  const front = s.nose[1] > 0 ? Math.max(0, Math.min(1, (z - (nose - s.nose[1])) / s.nose[1])) : 0;
  const back = s.tail[1] > 0 ? Math.max(0, Math.min(1, (tail + s.tail[1] - z) / s.tail[1])) : 0;
  return (1 - side) * (1 - s.nose[0] * front - s.tail[0] * back);
}

export function sculpt(geometry: THREE.BufferGeometry, d: Design): THREE.BufferGeometry {
  if (!d.section) return geometry;
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * sculpt_factor(d, position.getY(i), position.getZ(i)));
  return geometry;
}
