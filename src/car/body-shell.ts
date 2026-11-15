import * as THREE from "three";
import { axles_of } from "./axles";
import { hull_floor } from "./car";
import type { CarSpec } from "./cars";
import type { Cabin, Design, Slab } from "./designs";
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
function notch(points: Point[], d: Design, spec: CarSpec): Point[][] {
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

export interface Flares {
  /** The lips' outer faces, in the arch tone. */
  lips: THREE.BufferGeometry[];
  /** Their faces on the wheel side, which stand in the opening's shade. */
  walls: THREE.BufferGeometry[];
}

/**
 * A lip round each wheel opening, the same width all the way round and on every axle: the widest that stays under the
 * body top. It swells out of the body side, from the body's own surface at its outer edge to a rim standing `out` from
 * that surface over the tyre, so no step runs round it and it reads as the body's own arch. Rim and foot both follow
 * the body side, which keeps every facet flat; where the side folds, the lip folds with it.
 */
export function flares(d: Design, spec: CarSpec): Flares {
  if (d.arches.flare <= 0) return { lips: [], walls: [] };
  const inner = spec.wheel.radius + d.arches.gap - FLARE_PROUD;
  const y = spec.wheel.radius;
  const edge = d.width / 2;
  const body_top = (at: number) => Math.max(top_at(d.outline, at), ...(d.slabs ?? []).map((s) => top_at(s.points, at)));
  const openings = axles_of(spec).map(({ z }) => ({ z, opening: arc(z, y, inner, d.sill, d.arches.steps) }));
  // Each lip vertex stands straight out from its opening vertex, so every facet keeps the opening's angle.
  const ring = (z: number, opening: Point[], flare: number) => opening.map(([oz, oy]): Point => [z + ((oz - z) * (inner + flare)) / inner, y + ((oy - y) * (inner + flare)) / inner]);
  let flare = d.arches.flare;
  while (flare > MIN_FLARE && openings.some(({ z, opening }) => ring(z, opening, flare).some(([lz, ly]) => ly > body_top(lz)))) flare -= FLARE_STEP;
  const floor = ([pz, py]: Point): Point => [pz, Math.max(py, d.sill + FLARE_PROUD)];
  const out: Flares = { lips: [], walls: [] };
  const cuts = [...folds(d), ...crest(d)];
  for (const { z, opening } of openings) {
    const lip = ring(z, opening, flare).map(([lz, ly], i): Point => floor([lz, Math.max(opening[i][1], Math.min(ly, body_top(lz)))]));
    for (const side of [-1, 1]) {
      const at = ([pz, py]: Point, x: number) => new THREE.Vector3(side * x, py, pz);
      // Sculpting scales x by the body's factor: the rim is set to land `out` from the side it stands on.
      const rims = opening.map(floor).map((p) => at(p, edge + d.arches.out / sculpt_factor(d, p[1], p[0])));
      const backs = opening.map(floor).map((p) => at(p, edge - d.arches.reach));
      const foot = (p: Point) => at(p, edge - FLARE_PROUD);
      const last = opening.length - 1;
      const lips: THREE.Vector3[][] = [[rims[0], foot(lip[0]), backs[0]], [rims[last], foot(lip[last]), backs[last]]];
      const walls: THREE.Vector3[][] = [];
      for (let i = 0; i < last; i++) {
        const feet = [lip[i], ...crossings(lip[i], lip[i + 1], cuts), lip[i + 1]].map(foot);
        if (feet.length === 2) lips.push([rims[i], feet[0], feet[1], rims[i + 1]]);
        else {
          for (let k = 0; k + 2 < feet.length; k++) lips.push([rims[i], feet[k], feet[k + 1]]);
          lips.push([rims[i], feet[feet.length - 2], rims[i + 1]], [rims[i + 1], feet[feet.length - 2], feet[feet.length - 1]]);
        }
        walls.push([rims[i], backs[i], backs[i + 1], rims[i + 1]]);
      }
      out.lips.push(faces(lips, new THREE.Vector3(side * (edge - d.arches.reach), y, z), 1));
      out.walls.push(faces(walls, new THREE.Vector3(side * edge, y, z), -1));
    }
  }
  return out;
}

/** Where the line from `a` to `b` crosses `cuts`, in order from `a`. */
function crossings(a: Point, b: Point, cuts: Cut[]): Point[] {
  const shares: number[] = [];
  for (const { n, c } of cuts) {
    const [from, to] = [n[0] * a[0] + n[1] * a[1] + c, n[0] * b[0] + n[1] * b[1] + c];
    if ((from > ON_CUT && to < -ON_CUT) || (from < -ON_CUT && to > ON_CUT)) shares.push(from / (from - to));
  }
  return shares.sort((p, q) => p - q).map((t): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
}

/** Flat faces as one geometry, each wound to face away from `centre` (`way` 1) or toward it (-1). */
function faces(rings: THREE.Vector3[][], centre: THREE.Vector3, way: number): THREE.BufferGeometry {
  const position: number[] = [];
  const [edge, normal, from] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const ring of rings) {
    const [a, b, c] = ring;
    const out = normal.subVectors(b, a).cross(edge.subVectors(c, a)).dot(from.subVectors(a, centre)) * way > 0;
    for (let i = 1; i + 1 < ring.length; i++) for (const v of out ? [a, ring[i], ring[i + 1]] : [a, ring[i + 1], ring[i]]) position.push(v.x, v.y, v.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((position.length / 3) * 2), 2));
  geometry.computeVertexNormals();
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

/** Bottom of the aero kit's band, which a front lip or splitter sits on: never under the hull, or it sank into the road at speed. */
export const kit_floor = (d: Design, spec: CarSpec) => Math.max(d.sill + KIT_TOP - KIT_DEEP, hull_floor(spec));

/**
 * The aero kit's lower band: deep skirts between the wheel openings, run on past them to the nose and the tail and closed
 * across both ends. It stands just proud of the arch lips, so each lip's feet sink into it and the kit reads as one piece.
 */
export function kit_band(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  const reach = spec.wheel.radius + d.arches.gap;
  const top = d.sill + KIT_TOP;
  const low = kit_floor(d, spec);
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
    strips.push(...folded_slab(strip, inner, outer, folds(d)));
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

/** A line across a side profile: `n[0] * z + n[1] * y + c` is 0 on it. */
interface Cut {
  n: Point;
  c: number;
}

/** Where the section folds the body side: along the belt, where the tuck under a sloping belt is spent, and where the pinched nose and tail start. An end without a pinch has no fold. */
function folds(d: Design): Cut[] {
  const s = d.section;
  if (!s) return [];
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const slope = (s.belt[1] - s.belt[0]) / (tail - nose);
  const belt = { n: [-slope, 1] satisfies Point, c: slope * nose - s.belt[0] };
  return [
    ...(s.shoulder > 0 || s.tuck > 0 ? [belt] : []),
    ...(s.tuck > 0 && slope !== 0 ? [{ n: belt.n, c: belt.c + Math.min(...s.belt) - d.sill }] : []),
    ...(s.nose[1] > 0 ? [{ n: [1, 0] satisfies Point, c: s.nose[1] - nose }] : []),
    ...(s.tail[1] > 0 ? [{ n: [1, 0] satisfies Point, c: -tail - s.tail[1] }] : []),
  ];
}

/**
 * Where a pinch is spent, at the body's foremost and rearmost point: past it the body keeps its width, so only a part
 * that overhangs the nose or the tail crosses it.
 */
function ends(d: Design): Cut[] {
  const s = d.section;
  if (!s) return [];
  const [front, rear] = body_ends(d);
  return [...(s.nose[1] > 0 ? [{ n: [1, 0] satisfies Point, c: -front }] : []), ...(s.tail[1] > 0 ? [{ n: [1, 0] satisfies Point, c: -rear }] : [])];
}

/** `cuts` that `points` reach across: a profile that only touches a cut keeps the face it has there. */
function crossed(points: Point[], cuts: Cut[]): Cut[] {
  const sides = (cut: Cut) => points.map(([z, y]) => cut.n[0] * z + cut.n[1] * y + cut.c);
  return cuts.filter((cut) => sides(cut).some((side) => side > ON_CUT) && sides(cut).some((side) => side < -ON_CUT));
}

/** The fold above the body top, where the shoulder has done leaning in: only a part standing over the body crosses it. */
function crest(d: Design): Cut[] {
  const s = d.section;
  if (!s || s.shoulder <= 0) return [];
  const [belt] = folds(d);
  const rise = s.rise ?? Math.max(...d.outline.map(([, y]) => y)) - Math.max(...s.belt);
  return [{ n: belt.n, c: belt.c - rise }];
}

/** A side profile cut along `cuts`, so every sculpted face stays flat. */
function flat_pieces(outline: Point[], cuts: Cut[]): Point[][] {
  return cuts.reduce((pieces, { n, c }) => pieces.flatMap((piece) => [...split(piece, n, c), ...split(piece, [-n[0], -n[1]], -c)]), [outline]);
}

const ON_CUT = 1e-6;

/** `geometry` less the walls `flat_pieces` left between its pieces, which lie buried in the part on the body's own cuts. */
function uncut(geometry: THREE.BufferGeometry, cuts: Cut[]): THREE.BufferGeometry {
  if (!cuts.length) return geometry;
  const position = geometry.getAttribute("position");
  const kept: number[] = [];
  for (let i = 0; i < position.count; i += 3)
    if (!cuts.some(({ n, c }) => [i, i + 1, i + 2].every((v) => Math.abs(n[0] * position.getZ(v) + n[1] * position.getY(v) + c) < ON_CUT))) kept.push(i, i + 1, i + 2);
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

/** `points` between two distances from the centre, cut along `cuts` and with the walls between its pieces taken out. */
function folded_slab(points: Point[], from: number, to: number, cuts: Cut[]): THREE.BufferGeometry[] {
  return flat_pieces(points, cuts).flatMap((piece) => slab(piece, from, to).map((g) => uncut(g, cuts)));
}

/**
 * A slab cut where the body side folds: at the belt, where the nose and tail pinch start and where they are spent, and at
 * the crest over the body top. Its side then bends with the body's, so a lip as wide as the body stays on the body side
 * instead of bridging the bend and standing proud of it, and one that overhangs the body's end runs on square past it.
 * A `straight` slab skips the pinch folds and keeps one width instead.
 */
export function fitted_slab(d: Design, s: Slab): THREE.BufferGeometry[] {
  const anchor = s.straight;
  // A sloped face bends where its slope starts and ends: cut there too, or one cap spans the bend and twists.
  const bends = crossed(s.points, [s.lean, s.roll].flatMap((slope) => (slope ? [slope.low, slope.high] : [])).map((y): Cut => ({ n: [0, 1], c: -y })));
  const pieces =
    anchor === undefined
      ? folded_slab(s.points, s.from, s.to, [...folds(d), ...crest(d), ...crossed(s.points, ends(d)), ...bends])
      : folded_slab(s.points, s.from, s.to, [...[...folds(d), ...crest(d)].filter(({ n }) => n[1] !== 0), ...bends]).map((g) => unpinched(g, d, anchor));
  const { lean, roll } = s;
  const leaned = lean ? pieces.map((g) => sloped(g, s.from, lean)) : pieces;
  return roll ? leaned.map((g) => sloped(g, s.to, { low: roll.low, high: roll.high, out: -roll.in })) : leaned;
}

/** Moves the vertices on a slab face at distance `at` from the centre outward with height, from none at `low` to `out` at `high`. */
function sloped(geometry: THREE.BufferGeometry, at: number, { low, high, out }: NonNullable<Slab["lean"]>): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    if (Math.abs(Math.abs(x) - at) > ON_CUT) continue;
    const share = Math.max(0, Math.min(1, (position.getY(i) - low) / (high - low)));
    position.setX(i, Math.sign(x) * (at + out * share));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Widens `geometry` by what the pinch takes off it, less what it takes at z `anchor`: once sculpted with the body it
 * loses the same share of the half width along its whole length, so its sides stay parallel to the centreline. The belt
 * and the crest still fold it where they fold the body.
 */
function unpinched(geometry: THREE.BufferGeometry, d: Design, anchor: number): THREE.BufferGeometry {
  const kept = pinch(d, anchor);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    const factor = sculpt_factor(d, position.getY(i), z);
    position.setX(i, (position.getX(i) * (factor + pinch(d, z) - kept)) / factor);
  }
  return geometry;
}

/** The design's raised side profiles, each less the wheel openings and cut where the body side folds. */
export function body_slabs(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  return (d.slabs ?? []).flatMap((part) => notch(part.points, d, spec).flatMap((piece) => fitted_slab(d, { ...part, points: piece })));
}

export function body_pieces(d: Design, spec: CarSpec): Point[][] {
  return flat_pieces(body_outline(d, spec), [...folds(d), ...crest(d)]);
}

/** The body's foremost and rearmost z: a proud bumper stands past the outline's first and last point. */
function body_ends(d: Design): [number, number] {
  let [front, rear] = [-Infinity, Infinity];
  for (const [z] of d.outline) {
    front = Math.max(front, z);
    rear = Math.min(rear, z);
  }
  return [front, rear];
}

/**
 * Share of its x a point at `z` loses to the pinched nose and tail. A pinch runs on past the outline's first and last
 * point to the body's real end, so no face of a proud bumper folds there, and is spent past that end.
 */
function pinch(d: Design, z: number): number {
  const s = d.section;
  if (!s) return 0;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const [front_end, rear_end] = body_ends(d);
  const front = s.nose[1] > 0 ? Math.max(0, Math.min(front_end, z) - (nose - s.nose[1])) / s.nose[1] : 0;
  const back = s.tail[1] > 0 ? Math.max(0, tail + s.tail[1] - Math.max(rear_end, z)) / s.tail[1] : 0;
  return s.nose[0] * front + s.tail[0] * back;
}

/**
 * Share of its x a point keeps on a sculpted body: the shoulder over the belt, the tuck under it, the pinched ends.
 * The shares add, so the factor is linear in y and z between the folds and every flat face stays flat.
 */
export function sculpt_factor(d: Design, y: number, z: number): number {
  const s = d.section;
  if (!s) return 1;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  let top = -Infinity;
  for (const [, oy] of d.outline) top = Math.max(top, oy);
  const rise = s.rise ?? top - Math.max(...s.belt);
  const drop = Math.min(...s.belt) - d.sill;
  const belt = s.belt[0] + ((s.belt[1] - s.belt[0]) * (nose - z)) / (nose - tail);
  const side = y > belt ? s.shoulder * Math.min(1, (y - belt) / rise) : s.tuck * Math.min(1, (belt - y) / drop);
  return 1 - side - pinch(d, z);
}

export function sculpt(geometry: THREE.BufferGeometry, d: Design): THREE.BufferGeometry {
  if (!d.section) return geometry;
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * sculpt_factor(d, position.getY(i), position.getZ(i)));
  return geometry;
}
