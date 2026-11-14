import * as THREE from "three";
import { axles_of } from "./axles";
import type { CarSpec } from "./cars";
import type { Cabin, Design } from "./designs";
import { arc, clip, clip_line, extrude, inset, lean, parts, screen, slab, tint, top_at, type Point } from "./geometry";
import type { Panel } from "./livery";

const PANEL_MARGIN = 0.06;
const PANEL_FLOOR = 0.08;
const PANEL_ROOF = 0.05;
// The flare's opening and floor sit this far inside the body's arch cut and sill, or they share a plane and flicker.
const FLARE_PROUD = 0.004;

export function cabin_parts(c: Cabin, paint: THREE.Color, glass: THREE.Color): THREE.BufferGeometry[] {
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

export function body_outline(d: Design, spec: CarSpec): Point[] {
  const radius = spec.wheel.radius + d.arches.gap;
  const y = spec.wheel.radius;
  return [...d.outline, ...axles_of(spec).reverse().flatMap((a) => arc(a.z, y, radius, d.sill, d.arches.steps))];
}

/** A lip round each wheel opening, kept under the body top so it never stands over a low bonnet or deck. */
export function flares(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  if (d.arches.flare <= 0) return [];
  const inner = spec.wheel.radius + d.arches.gap;
  const y = spec.wheel.radius;
  const edge = d.width / 2;
  const body_top = (at: number) => Math.max(top_at(d.outline, at), ...(d.slabs ?? []).map((s) => top_at(s.points, at)));
  return axles_of(spec).flatMap(({ z }) => {
    const opening = arc(z, y, inner - FLARE_PROUD, d.sill, d.arches.steps);
    const lip = arc(z, y, inner + d.arches.flare, d.sill, d.arches.steps).map(([lz, ly], i): Point => [lz, Math.max(opening[i][1], Math.min(ly, body_top(lz)))]);
    const lifted = [...lip, ...opening.reverse()].map(([pz, py]): Point => [pz, Math.max(py, d.sill + FLARE_PROUD)]);
    return slab(lifted, edge - d.arches.reach, edge + d.arches.out);
  });
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

/** The body outline cut at the belt and at the ends of the pinched nose and tail, so every sculpted face stays flat. */
export function body_pieces(d: Design, spec: CarSpec): Point[][] {
  const outline = body_outline(d, spec);
  const s = d.section;
  if (!s) return [outline];
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const a: Point = [nose, s.belt[0]];
  const b: Point = [tail, s.belt[1]];
  const front = nose - s.nose[1];
  const rear = tail + s.tail[1];
  const halves = s.shoulder > 0 || s.tuck > 0 ? [clip_line(outline, a, b, -1), clip_line(outline, a, b, 1)] : [outline];
  return halves
    .flatMap((piece) => [s.nose[1] > 0 ? clip(piece, front, 1) : [], clip(clip(piece, front, -1), rear, 1), s.tail[1] > 0 ? clip(piece, rear, -1) : []])
    .filter((piece) => piece.length >= 3);
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
