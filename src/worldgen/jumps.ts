import { on_ice, type FrozenLake } from "./ice";
import { in_lava, type LavaPool } from "./lava";
import { mulberry32, sub } from "../rng";
import { sample, up, vertex } from "./field";
import type { GapJump } from "./gap";
import { circle16, length } from "./noise";
import { ISLAND, type RoadRecipe, type Runup } from "./recipe";
import { CELL, ORIGIN, ROAD_HALF, SIZE, type Challenge, type ChallengeKind, type Item, type ItemKind, type Lot, type Ramp, type RampKind, type RoadPoint, type Solid, type Terrain, type Town } from "./types";

export const GRAVITY = 9.81;
const BACK = 1.2;
const SIDE = 1;
// Ramp mesh and surface reach this far below the base line, so uneven ground never shows a gap under one.
const BURY = 3;
export const RIDE = 0.5;
// Share of the lip's vertical speed the car keeps: the suspension soaks up the rest. Fitted on every car at 360 Hz.
const LAUNCH_KEEP = 0.91;

const RUNUP = 30;
const ROADSIDE_OFFSET = 18;
const FLAT_BELOW = 1.2;
const LANDING_UP = 0.85;
const KEEP_OFF_ROAD = 3;
const TOWN_CLEAR = 20;

export interface RampShape {
  kind: RampKind;
  back?: number;
  hw: number;
  length: number;
  rise: number;
  landing: number;
  speed: number;
}

const KICKER: RampShape = { kind: "kicker", hw: 2.6, length: 8, rise: 2, landing: 45, speed: 21 };
const BIG: RampShape = { kind: "big", hw: 3.2, length: 14, rise: 4, landing: 80, speed: 27 };
// A slow car on the circuit has to roll off the lip, not hang its belly on it as on the steep back of an off-road kicker.
const ROAD_BACK = 0.3;
// Tuned for racing pace: the landing runs out a 40 m/s launch.
export const ROAD_KICKER: RampShape = { kind: "kicker", hw: ROAD_HALF + 0.5, length: 8, rise: 2, landing: 90, speed: 24, back: ROAD_BACK };

const FRAME = 0.35;
const WALL_HW = 7;
const WALL_ABOVE = 1.2;
const PIECE_HD = 0.25;
const PILLAR = 0.5;
const GAP_HW = 2.6;
const GAP_BELOW = 1.3;
const GAP_ABOVE = 1.7;
// Racers hit a road kicker well past its design speed and fly higher than the line it is tuned for.
const ROAD_HEADROOM = 1;
const BAR_CLEAR = 1.6;
const BAR_MIN = 0.8;
const PILLAR_TOP = 6;
/** Most the ground may climb across a challenge, and highest its opening may sit above that ground. */
const CHALLENGE_SLOPE = 2.5;
const CHALLENGE_HIGH = 6.5;
const MIN_LAUNCH = 0.15;

export interface Surface {
  y: number;
  gx: number;
  gz: number;
}

export function ramp_local(r: Ramp, x: number, z: number): [number, number] {
  return [local_u(r, x, z), local_v(r, x, z)];
}

function local_u(r: Ramp, x: number, z: number): number {
  return (x - r.x) * r.fz - (z - r.z) * r.fx;
}

function local_v(r: Ramp, x: number, z: number): number {
  return (x - r.x) * r.fx + (z - r.z) * r.fz;
}

export function ramp_world(r: Ramp, u: number, v: number): [number, number] {
  return [r.x + r.fz * u + r.fx * v, r.z - r.fx * u + r.fz * v];
}

export function ramp_extent(r: Ramp): { reach: number; from: number; to: number } {
  return { reach: extent_reach(r), from: extent_from(r), to: extent_to(r) };
}

function extent_reach(r: Ramp): number {
  return r.kind === "landing" ? r.hw + BURY / SIDE : r.hw + (r.rise + BURY) / SIDE;
}

function extent_from(r: Ramp): number {
  return r.kind === "landing" ? 0 : (-BURY * r.length) / r.rise;
}

function extent_to(r: Ramp): number {
  return r.kind === "landing" ? r.length : r.length + (r.rise + BURY) / (r.back ?? BACK);
}

/** Squared radius around (r.x, r.z) outside which `ramp_surface` is always null. */
export function ramp_reach2(r: Ramp): number {
  return (extent_reach(r) + Math.max(Math.abs(extent_from(r)), Math.abs(extent_to(r)))) ** 2;
}

// Planar on every cell of the grid u = ±hw, v = length: the mesh drawn on that grid is exactly the surface physics rides.
export function ramp_lift(r: Ramp, u: number, v: number): number {
  const along = v <= r.length ? (r.rise * v) / r.length : r.rise - (v - r.length) * (r.back ?? BACK);
  return along - Math.max(0, Math.abs(u) - r.hw) * SIDE;
}

/** The ground is the higher of this and terrain. */
export function ramp_surface(r: Ramp, x: number, z: number): Surface | null {
  const u = local_u(r, x, z);
  const v = local_v(r, x, z);
  if (v < extent_from(r) || v > extent_to(r) || Math.abs(u) > extent_reach(r)) return null;
  const dv = r.grade + (v <= r.length ? r.rise / r.length : -(r.back ?? BACK));
  const du = Math.abs(u) > r.hw ? -SIDE * Math.sign(u) : 0;
  return { y: r.y + r.grade * v + ramp_lift(r, u, v), gx: dv * r.fx + du * r.fz, gz: dv * r.fz - du * r.fx };
}

/** Where the face past the lip meets the base line again. */
export function face_end(r: Ramp): number {
  return r.length + r.rise / (r.back ?? BACK);
}

/**
 * Circuit points a reset or a mode start must not drop a car on: a road kicker from its toe to the end of its landing,
 * and each challenge plane on the circuit, SPAWN_CLEAR either side. A car put down there can straddle a slab or a lip.
 */
export function spawn_blocks(road: readonly RoadPoint[], ramps: readonly Ramp[], challenges: readonly Challenge[]): Uint8Array {
  const out = new Uint8Array(road.length);
  road.forEach((p, i) => {
    for (const r of ramps) {
      if (!r.road) continue;
      const { reach, from, to } = ramp_extent(r);
      const [u, v] = ramp_local(r, p.x, p.z);
      if (Math.abs(u) < reach && v > from - SPAWN_CLEAR && v < to + r.landing) out[i] = 1;
    }
    for (const c of challenges) {
      if (!ramps[c.ramp].road) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      if (Math.abs(dx * c.fx + dz * c.fz) < SPAWN_CLEAR && Math.abs(dx * c.fz - dz * c.fx) < challenge_outer(c) + SPAWN_CLEAR) out[i] = 1;
    }
  });
  return out;
}

export function lip_height(r: Ramp): number {
  return r.y + r.grade * r.length + r.rise;
}

export function launch(r: Ramp, speed: number): { speed: number; slope: number } {
  const climb = r.rise + r.grade * r.length;
  return { speed: Math.sqrt(speed * speed - 2 * GRAVITY * climb), slope: r.grade + r.rise / r.length };
}

/** Centre-of-mass height `d` metres past the lip for a car that hits the toe at `speed`. */
export function flight(r: Ramp, speed: number, d: number): number {
  const out = launch(r, speed);
  const n = Math.sqrt(1 + out.slope * out.slope);
  const vx = out.speed / n;
  const t = d / vx;
  return lip_height(r) + RIDE + ((LAUNCH_KEEP * out.speed * out.slope) / n) * t - (GRAVITY * t * t) / 2;
}

export function apex(r: Ramp): number {
  const out = launch(r, r.speed);
  return (LAUNCH_KEEP * out.slope * out.speed * out.speed) / (1 + out.slope * out.slope) / GRAVITY;
}

export interface Piece {
  lx: number;
  hw: number;
  bottom: number;
  top: number;
  frame: boolean;
}

export function challenge_pieces(c: Challenge): Piece[] {
  const g = c.gap_hw;
  const gb = c.gap_bottom;
  const gt = c.gap_top;
  const outer = g + FRAME;
  if (c.kind === "pillars")
    return [-1, 1].map((side) => ({ lx: side * (g + PILLAR), hw: PILLAR, bottom: -1, top: gt, frame: true }));
  if (c.kind === "bar") return [{ lx: 0, hw: g, bottom: -1, top: gb, frame: true }];
  const frame: Piece[] = [
    { lx: -g - FRAME / 2, hw: FRAME / 2, bottom: c.kind === "hoop" ? -1 : gb - FRAME, top: gt + FRAME, frame: true },
    { lx: g + FRAME / 2, hw: FRAME / 2, bottom: c.kind === "hoop" ? -1 : gb - FRAME, top: gt + FRAME, frame: true },
    { lx: 0, hw: g, bottom: gt, top: gt + FRAME, frame: true },
    { lx: 0, hw: g, bottom: gb - FRAME, top: gb, frame: true },
  ];
  if (c.kind === "hoop") return frame;
  const top = gt + WALL_ABOVE;
  const side = (WALL_HW - outer) / 2;
  return [
    ...frame,
    { lx: -outer - side, hw: side, bottom: -1, top, frame: false },
    { lx: outer + side, hw: side, bottom: -1, top, frame: false },
    { lx: 0, hw: outer, bottom: -1, top: gb - FRAME, frame: false },
    { lx: 0, hw: outer, bottom: gt + FRAME, top, frame: false },
  ];
}

export const PIECE_DEPTH = PIECE_HD;

/** Half-width of everything a challenge puts up, across its flight line. */
export function challenge_outer(c: Challenge): number {
  return Math.max(...challenge_pieces(c).map((p) => Math.abs(p.lx) + p.hw));
}

export function piece_solid(c: Challenge, p: Piece): Solid {
  return { kind: "box", x: c.x + c.fz * p.lx, y: c.y, z: c.z - c.fx * p.lx, hw: p.hw, hd: PIECE_HD, cos: c.fz, sin: c.fx, height: p.top, bottom: p.bottom };
}

export interface Spot {
  x: number;
  z: number;
}

interface Zone extends Spot {
  r: number;
}

const ZONE_CELL = 16;

/** Circles bucketed by every ZONE_CELL square they touch. */
class Zones {
  private readonly cells = new Map<number, Zone[]>();

  private key(i: number, j: number) {
    return (i + 512) * 1024 + (j + 512);
  }

  add(zone: Zone) {
    const [i0, i1] = [Math.floor((zone.x - zone.r) / ZONE_CELL), Math.floor((zone.x + zone.r) / ZONE_CELL)];
    const [j0, j1] = [Math.floor((zone.z - zone.r) / ZONE_CELL), Math.floor((zone.z + zone.r) / ZONE_CELL)];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = this.key(i, j);
        const list = this.cells.get(k);
        if (list) list.push(zone);
        else this.cells.set(k, [zone]);
      }
  }

  hits(x: number, z: number, r: number): boolean {
    const [i0, i1] = [Math.floor((x - r) / ZONE_CELL), Math.floor((x + r) / ZONE_CELL)];
    const [j0, j1] = [Math.floor((z - r) / ZONE_CELL), Math.floor((z + r) / ZONE_CELL)];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) for (const q of this.cells.get(this.key(i, j)) ?? []) if (length(q.x - x, q.z - z) < q.r + r) return true;
    return false;
  }
}

export interface Jumps {
  ramps: Ramp[];
  items: Item[];
  challenges: Challenge[];
  solids: Solid[];
  blocks(x: number, z: number, r: number): boolean;
}

interface ItemShape {
  light: boolean;
  r: number;
  solid?: (x: number, y: number, z: number, fx: number, fz: number, scale: number) => Solid;
}

/** A traffic cone's size, for the baked cones and the cones a race closes roads with. */
export const CONE_RADIUS = 0.25;
export const CONE_HEIGHT = 0.75;

export const ITEMS: Record<ItemKind, ItemShape> = {
  cone: { light: true, r: 0.3 },
  barrel: { light: true, r: 0.45 },
  hay: { light: true, r: 0.8 },
  log: { light: false, r: 2.4, solid: (x, y, z, fx, fz, s) => ({ kind: "box", x, y, z, hw: 2.2 * s, hd: 0.35 * s, cos: fz, sin: fx, height: 0.6 * s }) },
  rock: { light: false, r: 1.1, solid: (x, y, z, _fx, _fz, s) => ({ kind: "circle", x, y, z, radius: 0.95 * s, height: 1.3 * s }) },
  barrier: { light: false, r: 1.6, solid: (x, y, z, fx, fz, s) => ({ kind: "box", x, y, z, hw: 0.3 * s, hd: 1.5 * s, cos: fz, sin: fx, height: 0.85 * s }) },
};

const ROADSIDE_STRIDE = 70;
const OPEN_KICKERS = 40;
const OPEN_ITEMS = 160;
const HILL_STEP = 32;
const HILL_RING = 48;
const HILL_MIN = 22;
const HILL_SPACING = 260;
const RAMP_SPACING = 120;
/** Trail points 2 m apart: every third one keeps a TRAIL_CLEAR disc free, the trail half plus a car either side. */
const TRAIL_STRIDE = 3;
const TRAIL_CLEAR = 8;
const LOT_ITEMS = 0.5;
const ROAD_STRIDE = 6;
const ROAD_RUNUP = 30;
/** Most the circuit's centre may stray from a road ramp's line: under the deck, and over its run-up and landing. */
export const DECK_DRIFT = 0.4;
export const RUN_DRIFT = 4;
/** Sine of the most the circuit may turn away from a road ramp's line, out to ROAD_RUNOUT past its landing. */
const RUN_TURN = 0.2;
const ROAD_RUNOUT = 50;
/** Checkpoints and spur junctions keep this far from anything on the circuit. */
export const GATE_CLEAR = 20;
/** Circuit past a road kicker's landing that keeps GATE_CLEAR from gates, so a car that touches down off line has time to straighten before the posts. */
export const GATE_RUNOUT = 35;
/** Open ground beside a challenge that spans the road, so a car that misses the jump can drive round it. */
export const BYPASS = 4;
const SPAWN_CLEAR = 3;
const CHICANES = 2;
const CHICANE_STRIDE = 37;
const CHICANE_GAP = 8;
const CHICANE_RUN = 60;
const CHICANE_KINDS: ItemKind[] = ["cone", "barrel", "hay"];
/** Most the ground may stray under a heavy box's corners from its centre: worldcheck's grounding limit, less a margin. */
const LEVEL = 0.2;

export function steep_runup(road: readonly RoadPoint[], toe: number, runup: Runup): boolean {
  const n = road.length;
  for (let k = 1, along = 0; along < runup.reach && k < n; k++) {
    const a = road[(toe - k + n) % n];
    const b = road[(toe - k + 1 + n) % n];
    const run = length(b.x - a.x, b.z - a.z);
    if (a.y - b.y > runup.grade * run) return true;
    along += run;
  }
  return false;
}

export class JumpPlanner {
  readonly out: Jumps;
  private readonly next: () => number;
  /** Ramp run-ups, flights and landings plus every item: trees keep off these. */
  private readonly zones = new Zones();
  /** Solids placed before the planner ran. */
  private readonly taken = new Zones();
  private readonly dirs = circle16();

  constructor(
    seed: number,
    private readonly terrain: Terrain,
    private readonly towns: Town[],
    private readonly occupied: Uint8Array,
    existing: Solid[],
    private readonly caps: RoadRecipe["kickers"] = ISLAND.road.kickers,
    private readonly lakes: readonly FrozenLake[] = [],
    private readonly lava: readonly LavaPool[] = [],
  ) {
    this.next = mulberry32(sub(seed, "jumps"));
    for (const s of existing) this.taken.add({ x: s.x, z: s.z, r: s.kind === "circle" ? s.radius : length(s.hw, s.hd) });
    const zones = this.zones;
    this.out = { ramps: [], items: [], challenges: [], solids: [], blocks: (x, z, r) => zones.hits(x, z, r) };
  }

  private height(x: number, z: number) {
    return sample(this.terrain.heights, x, z);
  }

  private road(x: number, z: number) {
    return sample(this.terrain.road_dist, x, z);
  }

  private in_town(x: number, z: number, margin: number) {
    return this.towns.some((t) => length(t.x - x, t.z - z) < t.radius + margin);
  }

  private clear(x: number, z: number, r: number, town_ok = false): boolean {
    return this.road(x, z) >= ROAD_HALF + r + KEEP_OFF_ROAD && this.free(x, z, r, town_ok);
  }

  private free(x: number, z: number, r: number, town_ok = false): boolean {
    return this.bare(x, z, town_ok) && !this.zones.hits(x, z, r) && !this.taken.hits(x, z, r);
  }

  private bare(x: number, z: number, town_ok = false): boolean {
    if (Math.abs(x) > SIZE / 2 - 40 || Math.abs(z) > SIZE / 2 - 40) return false;
    if (this.height(x, z) < 3.5) return false;
    const k = vertex(Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL));
    if (this.occupied[k] || on_ice(this.lakes, x, z) || (this.lava.length > 0 && in_lava(this.lava, x, z, this.height(x, z)))) return false;
    return town_ok || !this.in_town(x, z, TOWN_CLEAR);
  }

  private fits(r: Ramp): boolean {
    const reach = r.hw + r.rise / SIDE + 1;
    const to = r.length + r.rise / BACK;
    for (let v = -RUNUP; v <= to + r.landing; v += 2)
      for (let u = -reach; u <= reach; u += 2) {
        const [x, z] = ramp_world(r, u, v);
        if (!this.clear(x, z, 0.5)) return false;
        const ground = this.height(x, z);
        if (v >= 0 && v <= r.length && Math.abs(u) <= r.hw) {
          const base = r.y + r.grade * v;
          if (ground < base - FLAT_BELOW || (v > r.length / 4 && ground > base + ramp_lift(r, u, v) - 0.05)) return false;
        }
        if (v < 0 && up(this.terrain.heights, x, z) < LANDING_UP) return false;
        if (v > to) {
          if (up(this.terrain.heights, x, z) < LANDING_UP) return false;
          if (ground > lip_height(r) + RIDE) return false;
          if (v - r.length < apex(r) * 2 && ground > flight(r, r.speed, v - r.length) - 1.5) return false;
        }
      }
    return true;
  }

  private ramp(shape: RampShape, x: number, z: number, fx: number, fz: number): Ramp | null {
    const r = this.shaped(shape, x, z, fx, fz);
    return r && this.fits(r) ? r : null;
  }

  private shaped(shape: RampShape, x: number, z: number, fx: number, fz: number): Ramp | null {
    const y = this.height(x, z);
    const lip = this.height(x + fx * shape.length, z + fz * shape.length);
    const r: Ramp = { id: this.out.ramps.length, kind: shape.kind, x, y, z, fx, fz, hw: shape.hw, length: shape.length, rise: shape.rise, grade: (lip - y) / shape.length, landing: shape.landing, speed: shape.speed };
    if (shape.back !== undefined) r.back = shape.back;
    const out = launch(r, r.speed);
    if (Math.abs(r.grade) > 0.2 || out.slope < MIN_LAUNCH || !(out.speed > 8)) return null;
    if (this.out.ramps.some((o) => length(o.x - x, o.z - z) < RAMP_SPACING)) return null;
    return r;
  }

  private fits_road(r: Ramp, road: RoadPoint[], toe: number, gates: Spot[]): boolean {
    const { reach } = ramp_extent(r);
    const to = face_end(r);
    const end = to + r.landing;
    const n = road.length;
    for (let k = -ROAD_RUNUP; k < n; k++) {
      const p = road[(toe + k + n) % n];
      const [u, v] = ramp_local(r, p.x, p.z);
      if (v > end + ROAD_RUNOUT) break;
      if (v < -ROAD_RUNUP) continue;
      if (Math.abs(p.tx * r.fz - p.tz * r.fx) > RUN_TURN) return false;
      if (v <= end && Math.abs(u) > (v >= -1 && v <= face_end(r) ? DECK_DRIFT : RUN_DRIFT)) return false;
      if (v <= end + GATE_RUNOUT && gates.some((g) => length(g.x - p.x, g.z - p.z) < GATE_CLEAR)) return false;
    }
    for (let v = -ROAD_RUNUP; v <= end; v += 2)
      for (let u = -reach; u <= reach; u += 2) {
        const [x, z] = ramp_world(r, u, v);
        if (!this.free(x, z, 0.5)) return false;
        const ground = this.height(x, z);
        if (Math.abs(u) > r.hw) continue;
        if (v >= 0 && v <= r.length) {
          const base = r.y + r.grade * v;
          if (ground < base - FLAT_BELOW || (v > r.length / 4 && ground > base + ramp_lift(r, u, v) - 0.05)) return false;
        }
        if ((v < 0 || v > to) && up(this.terrain.heights, x, z) < LANDING_UP) return false;
        if (v > to) {
          if (ground > lip_height(r) + RIDE) return false;
          if (v - r.length < apex(r) * 2 && ground > flight(r, r.speed, v - r.length) - 1.5) return false;
        }
      }
    return true;
  }

  private accept(r: Ramp) {
    this.out.ramps.push(r);
    const { to } = ramp_extent(r);
    for (let v = -RUNUP; v <= to + r.landing; v += 6) {
      const [x, z] = ramp_world(r, 0, v);
      this.zones.add({ x, z, r: ramp_extent(r).reach + 3 });
    }
    for (const v of [-7, -14])
      for (const side of [-1, 1]) {
        const [x, z] = ramp_world(r, side * (r.hw + 1.4), v);
        this.items.push({ kind: "cone", x, y: this.height(x, z), z, fx: r.fx, fz: r.fz, scale: 1, light: true });
      }
    if (this.next() < 0.75) this.challenge(r);
  }

  private get items() {
    return this.out.items;
  }

  private challenge(r: Ramp) {
    const d = apex(r) * 0.85;
    const [x, z] = ramp_world(r, 0, r.length + d);
    let y = Infinity;
    let high = -Infinity;
    for (let lx = -WALL_HW; lx <= WALL_HW; lx += 1)
      for (const dv of [-PIECE_HD, PIECE_HD]) {
        const ground = this.height(...ramp_world(r, lx, r.length + d + dv));
        y = Math.min(y, ground);
        high = Math.max(high, ground);
      }
    if (high - y > CHALLENGE_SLOPE) return;
    const com = flight(r, r.speed, d) - y;
    if (com > CHALLENGE_HIGH) return;
    const kinds: ChallengeKind[] = ["wall", "hoop", "pillars", "bar"];
    let kind = kinds[Math.floor(this.next() * kinds.length)];
    if (kind !== "bar" && kind !== "pillars" && com - GAP_BELOW < 1.2) kind = "bar";
    const c: Challenge = { id: this.out.challenges.length, ramp: r.id, kind, x, y, z, fx: r.fx, fz: r.fz, gap_hw: GAP_HW, gap_bottom: com - GAP_BELOW, gap_top: com + GAP_ABOVE + (r.road ? ROAD_HEADROOM : 0) };
    if (kind === "pillars") {
      c.gap_bottom = 0;
      c.gap_top = Math.max(PILLAR_TOP, com + GAP_ABOVE);
    }
    if (kind === "bar") {
      c.gap_hw = WALL_HW - 2;
      c.gap_bottom = com - BAR_CLEAR;
      c.gap_top = 60;
      if (c.gap_bottom < BAR_MIN) return;
    }
    if (r.road && (kind === "wall" || kind === "bar") && !this.bypass(c)) return;
    this.out.challenges.push(c);
    for (const p of challenge_pieces(c)) this.out.solids.push(piece_solid(c, p));
  }

  private bypass(c: Challenge): boolean {
    const outer = challenge_outer(c);
    for (const side of [-1, 1]) {
      let open = true;
      for (let lx = outer + 0.5; open && lx <= outer + BYPASS; lx += 1)
        for (let dv = -BYPASS; open && dv <= BYPASS; dv += 2) {
          const x = c.x + c.fz * side * lx + c.fx * dv;
          const z = c.z - c.fx * side * lx + c.fz * dv;
          open = this.bare(x, z) && !this.taken.hits(x, z, 0.5) && up(this.terrain.heights, x, z) >= LANDING_UP;
        }
      if (!open) continue;
      const [x, z] = [c.x + c.fz * side * (outer + BYPASS / 2), c.z - c.fx * side * (outer + BYPASS / 2)];
      this.zones.add({ x, z, r: BYPASS });
      return true;
    }
    return false;
  }

  circuit(road: RoadPoint[], gates: Spot[], runup: Runup | null) {
    const n = road.length;
    const start = Math.floor(this.next() * n);
    let placed = 0;
    for (let k = 0; k < n && placed < this.caps.road; k += ROAD_STRIDE) {
      const toe = (start + k) % n;
      if (runup && steep_runup(road, toe, runup)) continue;
      const p = road[toe];
      const q = road[(toe + ROAD_KICKER.length / 2) % n];
      const d = length(q.x - p.x, q.z - p.z);
      const r = this.shaped(ROAD_KICKER, p.x, p.z, (q.x - p.x) / d, (q.z - p.z) / d);
      if (!r || !this.fits_road(r, road, toe, gates)) continue;
      r.road = true;
      this.accept(r);
      placed++;
    }
    this.chicanes(road, gates);
  }

  private chicanes(road: RoadPoint[], gates: Spot[]) {
    const n = road.length;
    const start = Math.floor(this.next() * n);
    let made = 0;
    for (let k = 0; k < n && made < CHICANES; k += CHICANE_STRIDE) {
      const at = (start + k) % n;
      const kind = CHICANE_KINDS[Math.floor(this.next() * CHICANE_KINDS.length)];
      const r = ITEMS[kind].r;
      const side = this.next() < 0.5 ? -1 : 1;
      const spots: [number, number, RoadPoint][] = [];
      for (const [row, s] of [[0, side], [CHICANE_GAP, -side]]) {
        const p = road[(at + row) % n];
        for (let off = ROAD_HALF - r - 0.3; off > 0.5; off -= r * 2 + 0.4) spots.push([p.x - p.tz * s * off, p.z + p.tx * s * off, p]);
      }
      const run = Array.from({ length: CHICANE_RUN / 2 }, (_, i) => road[(at - CHICANE_RUN / 4 + i + n) % n]);
      if (run.some((p) => gates.some((g) => length(g.x - p.x, g.z - p.z) < GATE_CLEAR) || this.in_town(p.x, p.z, TOWN_CLEAR) || this.zones.hits(p.x, p.z, ROAD_HALF))) continue;
      for (const [x, z, p] of spots) {
        this.items.push({ kind, x, y: this.height(x, z), z, fx: p.tx, fz: p.tz, scale: 1, light: true });
        this.zones.add({ x, z, r });
      }
      made++;
    }
  }

  roadside(road: RoadPoint[]) {
    const n = road.length;
    const start = Math.floor(this.next() * n);
    for (let k = 0; k < n && this.out.ramps.filter((r) => r.kind === "kicker").length < this.caps.total / 2; k += ROADSIDE_STRIDE) {
      const p = road[(start + k) % n];
      const side = this.next() < 0.5 ? -1 : 1;
      const x = p.x - p.tz * side * ROADSIDE_OFFSET;
      const z = p.z + p.tx * side * ROADSIDE_OFFSET;
      const r = this.ramp(KICKER, x, z, p.tx, p.tz);
      if (r) this.accept(r);
    }
  }

  open() {
    for (let i = 0; i < OPEN_KICKERS && this.out.ramps.filter((r) => r.kind === "kicker").length < this.caps.total; i++) {
      const x = (this.next() - 0.5) * (SIZE - 200);
      const z = (this.next() - 0.5) * (SIZE - 200);
      const [fx, fz] = this.dirs[Math.floor(this.next() * 16)];
      const r = this.ramp(KICKER, x, z, fx, fz);
      if (r) this.accept(r);
    }
  }

  hills() {
    const tops: [number, number, number][] = [];
    const ring = this.dirs.filter((_, i) => i % 2 === 0);
    for (let z = ORIGIN + HILL_STEP * 3; z < -ORIGIN - HILL_STEP * 3; z += HILL_STEP)
      for (let x = ORIGIN + HILL_STEP * 3; x < -ORIGIN - HILL_STEP * 3; x += HILL_STEP) {
        const y = this.height(x, z);
        if (y < HILL_MIN || ring.some(([dx, dz]) => this.height(x + dx * HILL_RING, z + dz * HILL_RING) > y)) continue;
        tops.push([y, x, z]);
      }
    tops.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
    let big = 0;
    for (const [, x, z] of tops) {
      if (big >= this.caps.big) break;
      if (this.out.ramps.some((r) => r.kind === "big" && length(r.x - x, r.z - z) < HILL_SPACING)) continue;
      const order = this.dirs.map((d, i) => [this.height(x + d[0] * 40, z + d[1] * 40), i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (const [, i] of order.slice(0, 6)) {
        const [fx, fz] = this.dirs[i];
        const r = this.ramp(BIG, x - fx * BIG.length, z - fz * BIG.length, fx, fz);
        if (!r) continue;
        this.accept(r);
        big++;
        break;
      }
    }
  }

  private item(kind: ItemKind, x: number, z: number, fx: number, fz: number, scale: number, town_ok = false): boolean {
    const shape = ITEMS[kind];
    const r = shape.r * scale;
    if (!this.clear(x, z, r, town_ok)) return false;
    const y = this.height(x, z);
    if (up(this.terrain.heights, x, z) < 0.8) return false;
    if (shape.solid) {
      const s = shape.solid(x, y, z, fx, fz, scale);
      if (s.kind === "box")
        for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const ground = this.height(x + a * s.hw * s.cos + b * s.hd * s.sin, z - a * s.hw * s.sin + b * s.hd * s.cos);
          if (Math.abs(ground - y) > LEVEL) return false;
        }
    }
    this.items.push({ kind, x, y, z, fx, fz, scale, light: shape.light });
    this.zones.add({ x, z, r });
    if (shape.solid) this.out.solids.push(shape.solid(x, y, z, fx, fz, scale));
    return true;
  }

  roadside_items(road: RoadPoint[]) {
    const n = road.length;
    for (let s = Math.floor(this.next() * 40); s < n; s += 40 + Math.floor(this.next() * 60)) {
      const p = road[s];
      const side = this.next() < 0.5 ? -1 : 1;
      const offset = ROAD_HALF + 4.5 + this.next() * 4;
      const roll = this.next();
      const at = (along: number, extra: number): [number, number] => [p.x + p.tx * along - p.tz * side * (offset + extra), p.z + p.tz * along + p.tx * side * (offset + extra)];
      if (roll < 0.35) for (let i = 0; i < 3; i++) this.item("barrier", ...at(i * 3.2, 0), p.tx, p.tz, 1);
      else if (roll < 0.6) for (let i = 0; i < 3; i++) this.item("hay", ...at(i * 1.9, (i % 2) * 0.9), p.tz, -p.tx, 1);
      else if (roll < 0.85) for (let i = 0; i < 4; i++) this.item("barrel", ...at((i % 2) * 1.1, Math.floor(i / 2) * 1.1), p.tx, p.tz, 1);
      else for (let i = 0; i < 5; i++) this.item("cone", ...at(i * 2.2, 0), p.tx, p.tz, 1);
    }
  }

  /** The trail planner's canyon gap: lip and deck as laid, their run-up, flight and landing kept clear. */
  gap(g: GapJump) {
    const id = this.out.ramps.length;
    for (const r of [{ ...g.takeoff, id }, { ...g.deck, id: id + 1 }]) {
      this.out.ramps.push(r);
      const { reach, from, to } = ramp_extent(r);
      for (let v = from - (r.kind === "landing" ? 0 : RUNUP); v <= to + (r.kind === "landing" ? 0 : r.landing); v += 6) {
        const [x, z] = ramp_world(r, 0, v);
        this.zones.add({ x, z, r: reach + 3 });
      }
    }
  }

  keep_off(points: readonly { x: number; z: number }[]) {
    for (let i = 0; i < points.length; i += TRAIL_STRIDE) this.zones.add({ x: points[i].x, z: points[i].z, r: TRAIL_CLEAR });
  }

  lot_items(lots: Lot[]) {
    for (const lot of lots) {
      if (lot.kind !== "empty" || this.next() > LOT_ITEMS) continue;
      const kinds: ItemKind[] = ["barrel", "hay", "cone"];
      const kind = kinds[Math.floor(this.next() * kinds.length)];
      const count = 2 + Math.floor(this.next() * 4);
      for (let i = 0; i < count; i++) {
        const lx = (this.next() - 0.5) * (lot.w - 3);
        const lz = (this.next() - 0.5) * (lot.d - 3);
        this.item(kind, lot.x + lot.fz * lx + lot.fx * lz, lot.z - lot.fx * lx + lot.fz * lz, lot.fx, lot.fz, 1, true);
      }
    }
  }

  /** `kind_at` picks what suits the ground: rocks on dry upland, logs in the forest and on the shore, hay in meadows. */
  open_items(kind_at: (x: number, z: number) => ItemKind | null) {
    for (let i = 0; i < OPEN_ITEMS; i++) {
      const x = (this.next() - 0.5) * (SIZE - 200);
      const z = (this.next() - 0.5) * (SIZE - 200);
      const [fx, fz] = this.dirs[Math.floor(this.next() * 16)];
      const roll = this.next();
      const kind = kind_at(x, z);
      if (kind === "rock") for (let k = 0; k < 1 + Math.floor(roll * 3); k++) this.item("rock", x + fx * k * 2.6 - fz * (k % 2) * 1.8, z + fz * k * 2.6 + fx * (k % 2) * 1.8, fx, fz, 0.7 + this.next() * 0.9);
      else if (kind === "log") this.item("log", x, z, fx, fz, 0.8 + roll * 0.4);
      else if (kind === "hay") for (let k = 0; k < 3; k++) this.item("hay", x + fx * k * 1.9, z + fz * k * 1.9, fz, -fx, 1);
    }
  }
}
