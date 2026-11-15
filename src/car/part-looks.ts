import * as THREE from "three";
import { axles_of } from "./axles";
import { part_of, type Look, type Slot } from "./build";
import { hull_floor } from "./car";
import type { CarSpec } from "./cars";
import type { Design, Slab, Swap, Wing } from "./designs";
import { box, extrude, tint, top_at, wedge, parts, type Point } from "./geometry";
import { fitted_slab, kit_band, kit_floor } from "./body-shell";
import { canard } from "./design-parts";
import { PIPE_LENGTH, PIPE_PAIR, PIPE_REACH, nitro_parts, pipe_radius } from "./nitro-look";
import { chrome_tone } from "./wheels";
import { atan2 } from "../sim-math";

const WINGS = [
  { lift: 0.24, span: 0.86, thick: 0.05, chord: 0.36 },
  { lift: 0.4, span: 0.92, thick: 0.07, chord: 0.44 },
  { lift: 0.42, span: 0.96, thick: 0.08, chord: 0.52 },
];

// Under the 12 mm hood stripes and vents a design stands proud, so they stay on the bare panel instead of sharing its top.
const BARE_LIFT = 0.009;
/** The widest tyre look a part can fit, against the design's tyre width. */
const WIDEST_TYRE = 1.32;
// The generic diffuser: tray and strake length, tray thickness, strake thickness and depth under the floor at the tail,
// and how far both sink into the floor so they hang from it.
const DIFFUSER_LONG = 0.46;
const DIFFUSER_TRAY = 0.025;
const DIFFUSER_FIN = 0.025;
const DIFFUSER_DROP = 0.09;
const DIFFUSER_SINK = 0.01;
// Their rear faces stand this far behind the tail's, so the two never share a plane.
const DIFFUSER_PROUD = 0.005;

/** How far a bolt-on wing's legs sink into the deck, so they meet it where it falls away from `deck`. */
const LEG_SINK = 0.06;

const NO_AERO: Required<Look>["aero"] = { wing: 0 };
const FRONT_LEVEL = { lip: 1, splitter: 2 } as const;

// Engine bulges are sized for a saloon hood; a narrower body (the formula's engine cover) scales them down to fit.
const BULGE_BODY = 1.7;
// [width, height, length]: a low bulge that rises to the screen, then a scoop that opens forward. Each sinks this far into the hood.
const BULGE: [number, number, number] = [0.52, 0.05, 0.66];
const SCOOP: [number, number, number] = [0.48, 0.1, 0.62];
const HOOD_SINK = 0.012;
// A dive plane sits this far up the nose from its bottom edge.
const CANARD_UP = 0.17;
// A pipe's dark bore ends this far past its chrome, so the two never share an end face.
const PIPE_BORE_PROUD = 0.003;

function own_wing(d: Design, own: Wing, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  const shapes = (list: Slab[] = []) => list.flatMap((s) => fitted_slab(d, s));
  return [...parts(own.paint), ...shapes(own.lips)].map((g) => tint(g, paint)).concat([...parts(own.trim), ...shapes(own.stands)].map((g) => tint(g, trim)));
}

function wing(level: number, d: Design, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  const { width, deck: [z, y] } = d;
  if (level === 0) return [];
  const { lift, span: share, thick, chord } = WINGS[Math.min(level, WINGS.length) - 1];
  const span = width * share;
  const foot = top_at(d.outline, z) - LEG_SINK;
  const out = [tint(box(span, thick, chord, 0, y + lift, z - 0.04), paint)];
  if (level > 2) out.push(tint(new THREE.BoxGeometry(span, 0.035, 0.2).rotateX(0.55).translate(0, y + lift + 0.09, z - 0.04 - chord / 2), paint));
  for (const side of [-1, 1]) {
    out.push(tint(box(0.06, y + lift - foot, 0.14, side * width * 0.32, (y + lift + foot) / 2, z), trim));
    if (level === 2) out.push(tint(box(0.04, 0.2, 0.48, side * (span / 2 + 0.02), y + lift, z - 0.04), trim));
    if (level > 2) out.push(tint(box(0.03, 0.24, chord + 0.11, side * (span / 2 + 0.015), y + lift + 0.05, z - 0.085), trim));
  }
  return out;
}

export function aero_of(kit: Record<Slot, number>): Required<Look>["aero"] {
  return part_of("aero", kit.aero).look?.aero ?? NO_AERO;
}

/** The design's own rear wing for this level, or a bolt-on one on `deck`. */
export function rear_wing(d: Design, aero: Required<Look>["aero"], paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry[] {
  // A level past the design's list keeps its biggest wing, so new aero parts never bolt a second one on.
  return d.wings ? own_wing(d, d.wings[Math.min(aero.wing, d.wings.length - 1)], paint, trim) : wing(aero.wing, d, paint, trim);
}

/**
 * The aero kit's band of deep skirts, which takes the stock sill strip's place. A body without arches keeps its strip, and so
 * does a kit that draws its own shell: its sills, chin and tail are in its outline.
 */
export const kit_skirts = (d: Design, aero: Required<Look>["aero"]) => aero.skirts === true && d.arches.steps > 0 && !d.kit?.outline;

/** Where the front wheel opening and its lip start, z. */
export const arch_front = (d: Design, spec: CarSpec) => axles_of(spec)[0].z + spec.wheel.radius + d.arches.gap + d.arches.flare;

export function aero_parts(d: Design, spec: CarSpec, aero: Required<Look>["aero"], paint: THREE.Color, trim: THREE.Color, swaps: ReadonlySet<Swap> = new Set()): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const kitted = kit_skirts(d, aero);
  const nose = d.outline[0][0];
  // On the kit's band where there is one, so the piece is its bottom edge instead of a plate in its face.
  const low = Math.max(kitted ? kit_floor(d, spec) + 0.025 : d.outline[0][1], hull_floor(spec) + 0.03);
  const front = aero.front ? FRONT_LEVEL[aero.front] : 0;
  if (d.fronts) {
    out.push(...own_wing(d, d.fronts[Math.min(front, d.fronts.length - 1)], paint, trim));
  } else if (front > 0) {
    const splitter = front > 1;
    const reach = splitter ? 0.16 : 0.08;
    out.push(tint(box(d.width * (splitter || kitted ? 0.98 : 0.88), splitter ? 0.035 : 0.03, 0.2 + reach, 0, low - 0.01, nose - 0.1 + reach / 2), splitter ? trim : paint));
    if (splitter) out.push(...parts(canard(d.outline, d.width / 2, d.outline[0][1] + CANARD_UP, arch_front(d, spec))).map((g) => tint(g, paint)));
  }
  if (kitted) out.push(...kit_band(d, spec).map((g) => tint(g, paint)));
  if (aero.diffuser && !swaps.has("diffuser")) {
    const tail = d.outline[d.outline.length - 1][0];
    const bottom = Math.max(kitted ? kit_floor(d, spec) : d.outline[d.outline.length - 1][1], hull_floor(spec) + DIFFUSER_DROP - DIFFUSER_SINK);
    // Inside the widest tyre the rear wheels take, so the plate never reaches into their openings.
    const inner = Math.abs(spec.wheel.mounts[spec.wheel.mounts.length - 1][0]) - d.tyre[1] * WIDEST_TYRE / 2 - 0.01;
    const span = Math.min(d.width * 0.82, 2 * inner);
    // A thin tray on the floor that ends at the tail, and strakes hung under it: full depth at the rear, running out to
    // nothing ahead. A kicked plate stood out behind the tail as a shelf, and square strakes read as stacked planks.
    const under = (g: THREE.BufferGeometry, x: number, depth: number) => tint(g.translate(x, bottom + DIFFUSER_SINK - depth / 2, tail - DIFFUSER_PROUD + DIFFUSER_LONG / 2), trim);
    out.push(under(new THREE.BoxGeometry(span, DIFFUSER_TRAY, DIFFUSER_LONG), 0, DIFFUSER_TRAY));
    for (const x of [-0.42, -0.16, 0.16, 0.42]) out.push(under(wedge(DIFFUSER_FIN, DIFFUSER_DROP, DIFFUSER_LONG).rotateX(Math.PI), x * span, DIFFUSER_DROP));
  }
  return out;
}

function hood_tilt(d: Design, z: number): number {
  return -atan2(top_at(d.outline, z + 0.2) - top_at(d.outline, z - 0.2), 0.4);
}

function panel(outline: Point[], from: number, to: number, width: number): THREE.BufferGeometry {
  const zs = Array.from({ length: 7 }, (_, i) => from + ((to - from) * i) / 6);
  const top = zs.map((z): Point => [z, top_at(outline, z) + BARE_LIFT]);
  const under = [...zs].reverse().map((z): Point => [z, top_at(outline, z) - 0.02]);
  return extrude([...top, ...under], width);
}

/** Engine bulge or scoop and tailpipes, and the bare panels of a weight-stripped car. */
export function kit_parts(d: Design, kit: Record<Slot, number>, paint: THREE.Color, trim: THREE.Color, swaps: ReadonlySet<Swap> = new Set()): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const base = d.cabin.points[0][0];
  const nose = d.outline[0][0];
  const bare = paint.clone().lerp(trim, 0.75);
  const bare_bonnet = kit.weight > 0 && !swaps.has("bonnet");
  if (bare_bonnet) {
    out.push(tint(panel(d.outline, base + 0.05, base + (nose - base) * 0.85, d.width * 0.72), bare));
    const rear = d.cabin.points[d.cabin.points.length - 1][0] - 0.05;
    const tail = d.outline[d.outline.length - 1][0] + 0.15;
    if (kit.weight > 1 && rear - tail > 0.2) out.push(tint(panel(d.outline, tail, rear, d.width * 0.72), bare));
  }
  const engine = kit.engine;
  if (engine > 0) {
    const [z, y] = d.hood;
    const tilt = hood_tilt(d, z);
    const scoop = engine > 1;
    const [stock_w, h, l] = scoop ? SCOOP : BULGE;
    const w = stock_w * Math.min(1, d.width / BULGE_BODY);
    const on_hood = (g: THREE.BufferGeometry) => g.translate(0, -HOOD_SINK, 0).rotateX(tilt).translate(0, y, z);
    // One piece with the bonnet: it takes the bonnet's tone, and its top runs down into the panel.
    if (!swaps.has("bulge")) {
      const grown = wedge(w, h + HOOD_SINK, l).translate(0, (h + HOOD_SINK) / 2, 0);
      out.push(tint(on_hood(scoop ? grown : grown.rotateY(Math.PI)), bare_bonnet ? bare : paint));
      if (scoop) out.push(tint(on_hood(new THREE.BoxGeometry(w * 0.68, h * 0.55, 0.02).translate(0, HOOD_SINK + h * 0.5, l / 2 + 0.004)), trim));
    }
    const [x, py, pz] = d.exhaust;
    const central = x === 0;
    const r = pipe_radius(engine, central, d.width);
    const xs = central || engine === 1 ? [x] : [x - PIPE_PAIR, x + PIPE_PAIR];
    const chrome = chrome_tone();
    const at = pz - PIPE_REACH + PIPE_LENGTH / 2;
    for (const side of swaps.has("pipes") ? [] : central ? [1] : [-1, 1])
      for (const px of xs) {
        out.push(tint(new THREE.CylinderGeometry(r, r, PIPE_LENGTH, 8).rotateX(Math.PI / 2).translate(side * px, py, at), chrome));
        out.push(tint(new THREE.CylinderGeometry(r * 0.65, r * 0.65, PIPE_LENGTH, 8).rotateX(Math.PI / 2).translate(side * px, py, at - PIPE_BORE_PROUD), trim));
      }
  }
  const bottle = part_of("nitro", kit.nitro).look?.bottle;
  if (bottle && !swaps.has("tips")) out.push(...nitro_parts(d, bottle, engine, trim));
  return out;
}
