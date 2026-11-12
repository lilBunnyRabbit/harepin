import * as THREE from "three";
import { glow, lighten, linear, mix, tones } from "../theme/palette";
import { soup_geometry } from "../world/buildings";
import type { World } from "../world/world";
import { soup } from "../worldgen/chunks";
import { KINDS } from "../worldgen/kinds/kinds";
import { landmark_mesh, plate, prism } from "../worldgen/landmark-mesh";
import { Builder, type Frame, type Rgb } from "../worldgen/mesh";
import { hash } from "../worldgen/noise";
import { HEADINGS, reach } from "../worldgen/scatter";
import { N, PropKind, ROAD_HALF, type Prop } from "../worldgen/types";
import { mesh_tones } from "./scene";
import type { TreeLook } from "./snags";

// Drawn over the generated world, never part of it, so records and goldens stay put. Without solids, nothing here may
// stand where a car expects a hit: overlays reskin the world's boulders inside their solids, the rest is low ground
// detail, thin poles (the roadside posts are solid-free too) and fences far off the road on steep ground.
export const Piece = { BASALT: "basalt", SNOW_CAP: "snow_cap", VENT: "vent", POLE: "pole", TRAIL_POLES: "trail_poles", DRIFT: "drift", SCREE: "scree", FENCE: "fence" } as const;
export type Piece = (typeof Piece)[keyof typeof Piece];

/** A world kind's own trees and props. */
export interface Kit {
  trees: TreeLook;
  pieces: readonly Piece[];
}

export const PLAIN_KIT: Kit = { trees: "green", pieces: [] };

interface KitTones {
  basalt: Rgb;
  basalt_shade: Rgb;
  snow: Rgb;
  snow_shade: Rgb;
  pole: Rgb;
  pole_tip: Rgb;
  stone: Rgb;
  stone_shade: Rgb;
  stone_light: Rgb;
  wood: Rgb;
  wood_shade: Rgb;
  vent: Rgb;
}

function kit_tones(): KitTones {
  const basalt = mix(tones.check_dark, tones.rock, 0.45);
  const steel = mix(tones.check_dark, tones.trunk, 0.45);
  return {
    basalt: linear(basalt),
    basalt_shade: linear(lighten(basalt, -0.05)),
    snow: linear(tones.snow),
    snow_shade: linear(lighten(tones.snow, -0.05)),
    pole: linear(tones.cone),
    pole_tip: linear(tones.post),
    stone: linear(tones.rock),
    stone_shade: linear(lighten(tones.rock, -0.07)),
    stone_light: linear(lighten(tones.rock, 0.08)),
    wood: linear(steel),
    wood_shade: linear(lighten(steel, -0.05)),
    vent: [1, 1, 1],
  };
}

interface Spot {
  frame: Frame;
  scale: number;
  roll: number;
}

interface Outs {
  body: Builder;
  glow: Builder;
}

interface PieceDef {
  ground: boolean;
  /** Low ground detail stays out of the shadow pass: its shadow is a sliver, its triangles would count twice. */
  low: boolean;
  /** Share of the spots a phone keeps; phones also run without the shadow pass. */
  phone: number;
  place(world: World): Spot[];
  /** `world` is null on the review sheet's flat ground. */
  draw(out: Outs, spot: Spot, t: KitTones, world: World | null): void;
}

/** Scaled over the boulder mesh (landmark-mesh.ts) so its faces sit just outside the original's. */
const SKIN = 1.07;
const SKIN_LIFT = 0.04;
const FOOTING = 0.35;
const VENT_GLOW = 1.4;
const POLE_STEP = 12;
const POLE_OUT = ROAD_HALF + 3.4;
const FENCE_SEG = 4;
const FENCE_ROW_GAP = 11;
const FENCE_HIGH = 3;
const TRAIL_GAP = 22;
const TRAIL_CLEAR = ROAD_HALF + 6;
/** Trail poles close together on the review sheet, so its tile frames more than one. */
const SAMPLE_GAP = 3;
/** The grate leans out over the slope below it, top this far downhill of its foot. */
const FENCE_LEAN = 0.9;
const FLAT = new Float32Array((N + 1) * (N + 1));
const PHONE_SEED = 61;

function boulders(world: World): Spot[] {
  return world.props.filter((p) => p.kind === PropKind.BOULDER).map((p) => ({ frame: { x: p.x, y: p.y, z: p.z, fx: Math.sin(p.angle), fz: Math.cos(p.angle) }, scale: p.scale, roll: p.angle }));
}

function base_of(world: World, spot: Spot): number {
  const prop: Prop = { x: spot.frame.x, y: spot.frame.y, z: spot.frame.z, angle: spot.roll, kind: PropKind.BOULDER, scale: spot.scale };
  const r = reach(prop);
  let low = 0;
  for (const [dx, dz] of HEADINGS) low = Math.min(low, world.height(prop.x + dx * r, prop.z + dz * r) - prop.y);
  return low - FOOTING;
}

function taken(world: World, pad: number): (x: number, z: number) => boolean {
  const cell = 8;
  const grid = new Set<number>();
  const mark = (x: number, z: number, r: number) => {
    for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) grid.add(i * 65536 + j);
  };
  for (const t of world.trees) mark(t.x, t.z, pad);
  for (const p of world.props) mark(p.x, p.z, pad + 3);
  for (const b of world.buildings) mark(b.x, b.z, pad + Math.max(b.hw, b.hd));
  for (const l of world.lava) mark(l.x, l.z, l.radius + pad);
  return (x, z) => grid.has(Math.floor(x / cell) * 65536 + Math.floor(z / cell));
}

interface Strew {
  cell: number;
  odds: number;
  seed: number;
  keep(world: World, x: number, z: number, y: number, up: number): boolean;
}

const normal = new THREE.Vector3();

function strew(world: World, rule: Strew, pad: number): Spot[] {
  const { size, origin } = world.tiles.ext;
  const busy = taken(world, pad);
  const out: Spot[] = [];
  const seed = world.seed * 7919 + rule.seed;
  for (let j = 1; j * rule.cell < size; j++)
    for (let i = 1; i * rule.cell < size; i++) {
      if (hash(i, j, seed) >= rule.odds) continue;
      const x = origin + (i + hash(i, j, seed + 1) - 0.5) * rule.cell;
      const z = origin + (j + hash(i, j, seed + 2) - 0.5) * rule.cell;
      const y = world.height(x, z);
      if (busy(x, z) || world.depth(x, z) > 0 || !rule.keep(world, x, z, y, world.normal(x, z, normal).y)) continue;
      const a = hash(i, j, seed + 3) * Math.PI * 2;
      out.push({ frame: { x, y, z, fx: Math.sin(a), fz: Math.cos(a) }, scale: 0.8 + hash(i, j, seed + 4) * 0.5, roll: hash(i, j, seed + 5) });
    }
  return out;
}

const tree_line = (world: World) => KINDS[world.kind].recipe?.biomes.limits.tree_line ?? Infinity;

function basalt(out: Outs, spot: Spot, t: KitTones, world: World | null) {
  const s = spot.scale;
  const base = world ? base_of(world, spot) : -FOOTING;
  const b = out.body;
  const phase = spot.roll * Math.PI;
  prism(b, 6, 1.6 * s * SKIN, 1.05 * s * SKIN, base - 0.05, 1.0 * s + SKIN_LIFT, t.basalt, phase, t.basalt_shade);
  prism(b, 5, 1.05 * s * SKIN, 0.35 * s * SKIN, 1.0 * s, 1.5 * s + SKIN_LIFT, t.basalt_shade, phase, t.basalt);
  prism(b, 5, 0.7 * s * SKIN, 0.3 * s * SKIN, base - 0.05, 0.8 * s + SKIN_LIFT, t.basalt_shade, spot.roll * 5, t.basalt, 1.5 * s, 0.4 * s);
  const columns: readonly [number, number, number, number][] = [
    [0, 0, 0.55, 1.95],
    [0.5, -0.35, 0.42, 1.6],
    [-0.45, 0.3, 0.45, 1.75],
    [-0.1, -0.7, 0.4, 1.3],
  ];
  for (const [cx, cz, r, top] of columns) prism(b, 6, r * s, r * s, 0.6 * s, top * s, t.basalt, phase, t.basalt_shade, cx * s, cz * s);
}

// Snow lies on the boulder's top cone and its lobe, the parts of landmark-mesh.ts's boulder that face the sky.
function snow_cap(out: Outs, spot: Spot, t: KitTones) {
  const s = spot.scale;
  const phase = spot.roll * Math.PI;
  prism(out.body, 5, 1.05 * s * 1.09, 0.35 * s * 1.12, 0.96 * s, 1.5 * s + 0.07, t.snow, phase, t.snow_shade);
  prism(out.body, 5, 0.45 * s, 0.33 * s, 0.6 * s, 0.84 * s + 0.04, t.snow, spot.roll * 5, t.snow_shade, 1.5 * s, 0.4 * s);
}

function vent(out: Outs, spot: Spot, t: KitTones) {
  const s = spot.scale;
  const phase = spot.roll * Math.PI;
  prism(out.body, 7, 2.6 * s, 1.3 * s, -0.5, 0.6 * s, t.basalt, phase, t.basalt_shade);
  for (let k = 0; k < 4; k++) {
    const a = phase + k * 1.7;
    const d = (2.6 + hash(k, 1, spot.roll * 1000) * 1.2) * s;
    prism(out.body, 5, 0.45 * s, 0.2 * s, -0.3, 0.35 * s, t.basalt_shade, a, t.basalt, Math.cos(a) * d, Math.sin(a) * d);
  }
  prism(out.glow, 7, 0.95 * s, 0.95 * s, 0.6 * s, 0.63 * s, t.vent, phase);
}

// A snowmobile trail's line of poles across the flats, broken where it would cross a road.
function trail_poles(out: Outs, spot: Spot, t: KitTones, world: World | null) {
  const { x, z, fx, fz } = spot.frame;
  const count = 6 + Math.floor(spot.roll * 8);
  for (let k = 0; k < count; k++) {
    const along = (k - count / 2) * (world ? TRAIL_GAP : SAMPLE_GAP);
    if (world && world.distance_to_road(x + fx * along, z + fz * along) < TRAIL_CLEAR) continue;
    pole_at(out, t, along);
  }
}

// A wind drift: a long low snow ridge along the wind, slopes shallow enough to light like the snow round it.
function drift(out: Outs, spot: Spot, t: KitTones) {
  const l = 8 * spot.scale;
  const w = 3 * spot.scale;
  const h = 0.2 + spot.roll * 0.25;
  const b = out.body;
  b.quad([-w, -0.1, -l], [-w, -0.1, l], [0, h * 0.6, l * 0.45], [0, h, -l * 0.35], t.snow);
  b.quad([w * 0.6, -0.1, l], [w * 0.6, -0.1, -l], [0, h, -l * 0.35], [0, h * 0.6, l * 0.45], t.snow);
  b.tri([-w, -0.1, -l], [0, h, -l * 0.35], [w * 0.6, -0.1, -l], t.snow);
  b.tri([w * 0.6, -0.1, l], [0, h * 0.6, l * 0.45], [-w, -0.1, l], t.snow);
}

// A snow pole: orange so a plough driver finds the road's edge under drifts, a pale tip over the snow.
function pole_at(out: Outs, t: KitTones, along: number) {
  prism(out.body, 4, 0.07, 0.06, -0.4, 2.1, t.pole, Math.PI / 4, undefined, 0, along);
  prism(out.body, 4, 0.06, 0.05, 2.1, 2.45, t.pole_tip, Math.PI / 4, undefined, 0, along);
}

const pole = (out: Outs, _spot: Spot, t: KitTones) => pole_at(out, t, 0);

// Wide and low: a spill reads as a pale fan from the road below, and stays under a wheel's height up close.
function scree(out: Outs, spot: Spot, t: KitTones) {
  const count = 6 + Math.floor(spot.roll * 6);
  const seed = Math.floor(spot.roll * 100000);
  for (let k = 0; k < count; k++) {
    const a = hash(k, 0, seed) * Math.PI * 2;
    const d = Math.sqrt(hash(k, 1, seed)) * 7 * spot.scale;
    const r = (0.4 + hash(k, 2, seed) * 0.5) * spot.scale;
    const h = Math.min(0.35, r * (0.35 + hash(k, 3, seed) * 0.3));
    const tone = k % 3 === 0 ? t.stone : t.stone_light;
    prism(out.body, 4, r, r * 0.55, -0.2, h, tone, a, t.stone_shade, Math.cos(a) * d, Math.sin(a) * d);
  }
}

function fence(out: Outs, spot: Spot, t: KitTones) {
  const segs = 3 + Math.floor(spot.roll * 3);
  for (const [row, shift] of [[0, 0], [-FENCE_ROW_GAP, FENCE_SEG / 2]] as const)
    for (let k = 0; k < segs; k++) {
      const x0 = (k - segs / 2) * FENCE_SEG + shift;
      const x1 = x0 + FENCE_SEG - 0.3;
      for (const x of [x0, x1]) {
        prism(out.body, 4, 0.1, 0.09, -0.5, 0.3, t.wood_shade, Math.PI / 4, undefined, x, row);
        plate(out.body, [x - 0.08, 0.3, row], [x + 0.08, 0.3, row], [x + 0.08, FENCE_HIGH, row + FENCE_LEAN], [x - 0.08, FENCE_HIGH, row + FENCE_LEAN], t.wood_shade);
        plate(out.body, [x, -0.2, row + 2.6], [x, -0.2, row + 2.4], [x, FENCE_HIGH * 0.75, row + FENCE_LEAN * 0.75], [x, FENCE_HIGH * 0.75 + 0.12, row + FENCE_LEAN * 0.75], t.wood_shade);
      }
      for (let y = 0.4; y < FENCE_HIGH; y += 0.32) {
        const z = row + (FENCE_LEAN * y) / FENCE_HIGH + 0.1;
        plate(out.body, [x0, y, z], [x1, y, z], [x1, y + 0.16, z + 0.03], [x0, y + 0.16, z + 0.03], t.wood);
      }
    }
}

function downhill(world: World, spot: Spot): Spot {
  const n = world.normal(spot.frame.x, spot.frame.z, normal);
  const len = Math.hypot(n.x, n.z) || 1;
  return { ...spot, frame: { ...spot.frame, fx: n.x / len, fz: n.z / len } };
}

function poles(world: World): Spot[] {
  const out: Spot[] = [];
  const clear = world.kerbs.clear;
  world.road.forEach((p, s) => {
    if (s % POLE_STEP !== POLE_STEP / 2 || clear.has(s)) return;
    for (const side of [-1, 1]) {
      const x = p.x - p.tz * side * POLE_OUT;
      const z = p.z + p.tx * side * POLE_OUT;
      if (world.distance_to_road(x, z) < POLE_OUT - 1 || world.depth(x, z) > 0) continue;
      out.push({ frame: { x, y: world.height(x, z), z, fx: p.tx, fz: p.tz }, scale: 1, roll: 0 });
    }
  });
  return out;
}

const PIECES: Record<Piece, PieceDef> = {
  [Piece.BASALT]: { ground: false, low: false, phone: 1, place: boulders, draw: basalt },
  [Piece.SNOW_CAP]: { ground: false, low: false, phone: 1, place: boulders, draw: snow_cap },
  [Piece.VENT]: {
    ground: true,
    low: false, phone: 0.5,
    place: (world) =>
      strew(world, { cell: 70, odds: 0.45, seed: 11, keep: (w, x, z, y, up) => up > 0.82 && y > 25 && w.distance_to_road(x, z) > ROAD_HALF + 14 }, 6),
    draw: vent,
  },
  [Piece.POLE]: { ground: true, low: false, phone: 1, place: poles, draw: pole },
  [Piece.TRAIL_POLES]: {
    ground: true,
    low: false, phone: 0.5,
    place: (world) => strew(world, { cell: 260, odds: 0.5, seed: 41, keep: (w, x, z) => w.distance_to_road(x, z) > 40 }, 0),
    draw: trail_poles,
  },
  [Piece.DRIFT]: {
    ground: true,
    low: true, phone: 0.3,
    place: (world) => {
      const wind = hash(world.seed, 0, 53) * Math.PI;
      const fx = Math.sin(wind);
      const fz = Math.cos(wind);
      return strew(world, { cell: 34, odds: 0.55, seed: 47, keep: (w, x, z, _y, up) => up > 0.9 && w.distance_to_road(x, z) > ROAD_HALF + 10 }, 2).map((spot) => ({ ...spot, frame: { ...spot.frame, fx, fz } }));
    },
    draw: drift,
  },
  [Piece.SCREE]: {
    ground: true,
    low: true, phone: 0.2,
    place: (world) =>
      strew(world, { cell: 30, odds: 0.55, seed: 23, keep: (w, x, z, y, up) => up < 0.92 && up > 0.45 && y > tree_line(w) - 40 && w.distance_to_road(x, z) > ROAD_HALF + 8 }, 3),
    draw: scree,
  },
  [Piece.FENCE]: {
    ground: true,
    low: false, phone: 0,
    place: (world) =>
      strew(world, { cell: 70, odds: 0.6, seed: 37, keep: (w, x, z, y, up) => up < 0.88 && up > 0.5 && y > tree_line(w) - 20 && w.distance_to_road(x, z) > 40 }, 8).map((spot) =>
        downhill(world, spot),
      ),
    draw: fence,
  },
};

const body_material = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });

function meshes(body: Builder[], low: Builder[], glow_parts: Builder[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const [parts, cast] of [[body, true], [low, false]] as const) {
    const lit = soup(parts);
    if (!lit) continue;
    const mesh = new THREE.Mesh(soup_geometry(lit), body_material());
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    out.push(mesh);
  }
  const hot = soup(glow_parts);
  if (hot) out.push(new THREE.Mesh(soup_geometry({ positions: hot.positions, sphere: hot.sphere }), new THREE.MeshBasicMaterial({ color: glow(tones.lava, VENT_GLOW) })));
  return out;
}

/** A shadow-casting mesh, a low-detail mesh and, with vents, a glow mesh: three draws at most for the whole kit. */
export function kit_meshes(world: World, kit: readonly Piece[], phone: boolean): THREE.Mesh[] {
  if (!kit.length) return [];
  const t = kit_tones();
  const height = (x: number, z: number) => world.height(x, z);
  const flat = new Builder();
  const hugging = new Builder(undefined, height);
  const glow_flat = new Builder();
  const glow_hugging = new Builder(undefined, height);
  const low = new Builder(undefined, height);
  for (const piece of kit) {
    const def = PIECES[piece];
    if (phone && def.phone === 0) continue;
    const out = def.low ? { body: low, glow: glow_hugging } : def.ground ? { body: hugging, glow: glow_hugging } : { body: flat, glow: glow_flat };
    const spots = def.place(world).filter((_, i) => !phone || hash(i, 0, PHONE_SEED) < def.phone);
    for (const spot of spots) {
      out.body.at(spot.frame);
      out.glow.at(spot.frame);
      def.draw(out, spot, t, world);
    }
  }
  return meshes([flat, hugging], [low], [glow_flat, glow_hugging]);
}

export function kit_sample(piece: Piece, snowy: boolean): THREE.Mesh[] {
  const t = kit_tones();
  const body = new Builder();
  const glow_out = new Builder();
  const spot: Spot = { frame: { x: 0, y: 0, z: 0, fx: 0, fz: 1 }, scale: 1, roll: 0.3 };
  const def = PIECES[piece];
  if (!def.ground) landmark_mesh(body, { x: 0, y: 0, z: 0, angle: spot.roll, kind: PropKind.BOULDER, scale: 1 }, FLAT, mesh_tones(snowy).landmark);
  body.at(spot.frame);
  def.draw({ body, glow: glow_out }, spot, t, null);
  return meshes([body], [], [glow_out]);
}
