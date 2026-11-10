import * as THREE from "three";
import { part_of, type Look, type Slot } from "./build";
import type { CarSpec } from "./cars";
import type { Design, Wing } from "./designs";
import { box, extrude, face_at, parts, tint, top_at, type Point } from "./geometry";
import { skirts } from "./body-shell";
import { chrome_tone } from "./wheels";
import { brand, color } from "../theme/palette";

const WINGS = [
  { lift: 0.24, span: 0.92, thick: 0.05, chord: 0.36 },
  { lift: 0.4, span: 1, thick: 0.07, chord: 0.44 },
  { lift: 0.42, span: 1.04, thick: 0.08, chord: 0.52 },
];

const NO_AERO: Required<Look>["aero"] = { wing: 0 };
const FRONT_LEVEL = { lip: 1, splitter: 2 } as const;

// Engine bulges are sized for a saloon hood; a narrower body (the formula's engine cover) scales them down to fit.
const BULGE_BODY = 1.7;

function own_wing(own: Wing, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  return [...parts(own.paint).map((g) => tint(g, paint)), ...parts(own.trim).map((g) => tint(g, trim))];
}

function wing(level: number, d: Design, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  const { width, deck: [z, y] } = d;
  if (level === 0) {
    if (!d.ducktail) return [];
    return [tint(box(1.6, 0.05, 0.3, 0, y + 0.13, z), paint), ...[-1, 1].map((side) => tint(box(0.06, 0.13, 0.12, side * 0.6, y + 0.065, z + 0.02), trim))];
  }
  const { lift, span: share, thick, chord } = WINGS[Math.min(level, WINGS.length) - 1];
  const span = width * share;
  const out = [tint(box(span, thick, chord, 0, y + lift, z - 0.04), paint)];
  if (level > 2) out.push(tint(new THREE.BoxGeometry(span, 0.035, 0.2).rotateX(0.55).translate(0, y + lift + 0.09, z - 0.04 - chord / 2), paint));
  for (const side of [-1, 1]) {
    out.push(tint(box(0.06, lift, 0.14, side * width * 0.32, y + lift / 2, z), trim));
    if (level === 2) out.push(tint(box(0.04, 0.2, 0.48, (side * span) / 2, y + lift, z - 0.04), trim));
    if (level > 2) out.push(tint(box(0.03, 0.24, chord + 0.1, (side * span) / 2, y + lift + 0.05, z - 0.09), trim));
  }
  return out;
}

export function aero_of(kit: Record<Slot, number>): Required<Look>["aero"] {
  return part_of("aero", kit.aero).look?.aero ?? NO_AERO;
}

/** The design's own rear wing for this level, or a bolt-on one on `deck`. */
export function rear_wing(d: Design, aero: Required<Look>["aero"], paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  // A level past the design's list keeps its biggest wing, so new aero parts never bolt a second one on.
  return d.wings ? own_wing(d.wings[Math.min(aero.wing, d.wings.length - 1)], paint, trim) : wing(aero.wing, d, paint, trim);
}

export function aero_parts(d: Design, spec: CarSpec, aero: Required<Look>["aero"], paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const [nose, low] = d.outline[0];
  const front = aero.front ? FRONT_LEVEL[aero.front] : 0;
  if (d.fronts) {
    out.push(...own_wing(d.fronts[Math.min(front, d.fronts.length - 1)], paint, trim));
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
export function kit_parts(d: Design, kit: Record<Slot, number>, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
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
