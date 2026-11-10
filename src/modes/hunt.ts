import { mulberry32, sub } from "../rng";
import { ROAD_HALF, SIZE, type Solid } from "../world/world";
import { stars_for } from "./track";

export const GATE_RADIUS = 8;
const ROAD_STRIDE = 5;
const MIN_Y = 1.5;
const OFF_ROAD_CLEAR = ROAD_HALF + 8;
const SOLID_CLEAR = 6;
const SLOPE_STEP = 3;
const MAX_RISE = 2.5;
const EDGE = 40;
const NEAR_START = 50;
const TRIES = 400;
const DETOUR = 1.3;
const PAR_SPEED = 16;
const PER_GATE_MS = 1000;
const MOVE_SPEED = 0.5;

export interface HuntLevel {
  id: string;
  name: string;
  brings: string;
  gates: number;
  /** Radius around the start the gates fall in, metres. */
  spread: number;
  /** Share of gates off the road, 0 to 1. */
  wild: number;
}

export const HUNT_LEVELS: readonly HuntLevel[] = [
  { id: "h1", name: "Close by", brings: "Four gates on the roads near the start.", gates: 4, spread: 260, wild: 0 },
  { id: "h2", name: "Side streets", brings: "Five gates, one of them off the tarmac.", gates: 5, spread: 360, wild: 0.2 },
  { id: "h3", name: "Cross country", brings: "Six gates, a third of them in the fields.", gates: 6, spread: 460, wild: 0.34 },
  { id: "h4", name: "Wide search", brings: "Eight gates spread further out.", gates: 8, spread: 620, wild: 0.4 },
  { id: "h5", name: "Island sweep", brings: "Ten gates across the island, half off road.", gates: 10, spread: 820, wild: 0.5 },
];
export const HUNT_IDS = HUNT_LEVELS.map((level) => level.id);

export interface Point {
  x: number;
  z: number;
}

export interface HuntGround {
  height(x: number, z: number): number;
  distance_to_road(x: number, z: number): number;
  /** The circuit, whose edges in `graph` are listed in `circuit`. */
  readonly road: readonly Point[];
  readonly circuit: readonly number[];
  readonly graph: { readonly edges: readonly { readonly id: number; readonly points: readonly Point[] }[] };
  readonly solids: readonly Solid[];
}

export interface Hunt {
  level: HuntLevel;
  start: Point;
  gates: Point[];
  par_ms: number;
}

const far = (a: Point, b: Point, gap: number) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 >= gap * gap;

function clear_of(solids: readonly Solid[], p: Point, gap: number): boolean {
  for (const s of solids) {
    const reach = (s.kind === "circle" ? s.radius : Math.hypot(s.hw, s.hd)) + gap;
    if (Math.abs(s.x - p.x) < reach && Math.abs(s.z - p.z) < reach && Math.hypot(s.x - p.x, s.z - p.z) < reach) return false;
  }
  return true;
}

function drivable(ground: HuntGround, p: Point): boolean {
  if (Math.abs(p.x) > SIZE / 2 - EDGE || Math.abs(p.z) > SIZE / 2 - EDGE) return false;
  const y = ground.height(p.x, p.z);
  if (y < MIN_Y) return false;
  for (const [dx, dz] of [
    [SLOPE_STEP, 0],
    [0, SLOPE_STEP],
  ])
    if (Math.abs(ground.height(p.x + dx, p.z + dz) - ground.height(p.x - dx, p.z - dz)) > MAX_RISE) return false;
  return true;
}

export function tour(start: Point, gates: readonly Point[]): number {
  let at = start;
  let total = 0;
  const left = [...gates];
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (Math.hypot(left[i].x - at.x, left[i].z - at.z) < Math.hypot(left[best].x - at.x, left[best].z - at.z)) best = i;
    total += Math.hypot(left[best].x - at.x, left[best].z - at.z);
    at = left[best];
    left.splice(best, 1);
  }
  return total;
}

export function hunt_par(start: Point, gates: readonly Point[]): number {
  const seconds = (tour(start, gates) * DETOUR) / PAR_SPEED + (gates.length * PER_GATE_MS) / 1000;
  return Math.round(seconds * 2) * 500;
}

export function build_hunt(seed: number, ground: HuntGround, start: Point, level: HuntLevel): Hunt {
  const rng = mulberry32(sub(seed, `hunt:${level.id}`));
  const within = (p: Point) => !far(p, start, level.spread) && far(p, start, NEAR_START);
  const solids = ground.solids.filter((s) => !far(s, start, level.spread + SOLID_CLEAR * 4));
  const roads: Point[] = [];
  const lines = [ground.road, ...ground.graph.edges.filter((e) => !ground.circuit.includes(e.id)).map((e) => e.points)];
  for (const points of lines)
    for (let i = 0; i < points.length; i += ROAD_STRIDE) {
      const p = points[i];
      if (within(p) && drivable(ground, p)) roads.push({ x: p.x, z: p.z });
    }
  const wild_count = Math.round(level.gates * level.wild);
  const gates: Point[] = [];
  let gap = level.spread * 0.45;
  for (let tries = 0; gates.length < level.gates; tries++) {
    if (tries > 0 && tries % TRIES === 0) gap *= 0.75;
    if (tries > TRIES * 12) break;
    const wild = gates.length < wild_count;
    let p: Point;
    if (wild) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * level.spread;
      p = { x: start.x + Math.sin(a) * r, z: start.z + Math.cos(a) * r };
      if (!within(p) || ground.distance_to_road(p.x, p.z) < OFF_ROAD_CLEAR || !drivable(ground, p) || !clear_of(solids, p, SOLID_CLEAR)) continue;
    } else {
      if (!roads.length) continue;
      p = roads[Math.floor(rng() * roads.length)];
    }
    if (gates.every((g) => far(g, p, gap))) gates.push(p);
  }
  return { level, start, gates, par_ms: hunt_par(start, gates) };
}

export const HuntStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type HuntStatus = (typeof HuntStatus)[keyof typeof HuntStatus];

export class HuntRun {
  status: HuntStatus = HuntStatus.READY;
  clock = 0;
  started = 0;
  ended = 0;
  readonly found = new Set<number>();

  constructor(readonly hunt: Hunt) {}

  elapsed(): number {
    if (this.status === HuntStatus.READY) return 0;
    return (this.status === HuntStatus.DONE ? this.ended : this.clock) - this.started;
  }

  stars(): number {
    return stars_for(this.elapsed(), this.hunt.par_ms);
  }

  nearest(x: number, z: number): number {
    let best = -1;
    let best_d = Infinity;
    this.hunt.gates.forEach((g, i) => {
      if (this.found.has(i)) return;
      const d = (g.x - x) ** 2 + (g.z - z) ** 2;
      if (d < best_d) {
        best_d = d;
        best = i;
      }
    });
    return best;
  }

  update(dt_ms: number, x: number, z: number, speed: number): number {
    if (this.status === HuntStatus.DONE) return -1;
    this.clock += dt_ms;
    if (this.status === HuntStatus.READY) {
      if (speed <= MOVE_SPEED) return -1;
      this.status = HuntStatus.RUNNING;
      this.started = this.clock;
    }
    const hit = this.hunt.gates.findIndex((g, i) => !this.found.has(i) && !far(g, { x, z }, GATE_RADIUS));
    if (hit < 0) return -1;
    this.found.add(hit);
    if (this.found.size === this.hunt.gates.length) {
      this.status = HuntStatus.DONE;
      this.ended = this.clock;
    }
    return hit;
  }
}
