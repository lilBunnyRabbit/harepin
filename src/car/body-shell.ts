import * as THREE from "three";
import { axles_of } from "./axles";
import type { CarSpec } from "./cars";
import type { Cabin, Design } from "./designs";
import { arc, clip, extrude, inset, lean, parts, screen, slab, tint, top_at, type Point } from "./geometry";
import type { Panel } from "./livery";

const PANEL_MARGIN = 0.06;
const PANEL_FLOOR = 0.08;
const PANEL_ROOF = 0.05;

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

export function flares(d: Design, spec: CarSpec): THREE.BufferGeometry[] {
  if (d.arches.flare <= 0) return [];
  const inner = spec.wheel.radius + d.arches.gap;
  const y = spec.wheel.radius;
  const edge = d.width / 2;
  return axles_of(spec).flatMap(({ z }) => {
    const ring = [...arc(z, y, inner + d.arches.flare, d.sill, d.arches.steps), ...arc(z, y, inner, d.sill, d.arches.steps).reverse()];
    return slab(ring, edge - d.arches.reach, edge + d.arches.out);
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
  return { rear, front, low: d.sill + PANEL_FLOOR, high: belt - PANEL_ROOF, side: d.width / 2 };
}
