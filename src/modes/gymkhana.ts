import { mulberry32, sub } from "../rng";
import { ROAD_HALF, type Solid } from "../world";
import { stars_for } from "./track";

export const CONE_RADIUS = 0.3;
export const HIT_MS = 2000;
export const MISS_MS = 5000;
const START_LINE = 4;
const FIRST_CONE = 16;
const SPIN_DONE = (150 / 180) * Math.PI;
const STOP_SPEED = 0.3;
const STOP_HEADING = (25 / 180) * Math.PI;
const LANE_GAP = 7;
const SITE_STEP = 4;
const SITE_MARGIN = 4;
const SITE_MIN_Y = 1;
const SITE_ROAD_CLEAR = ROAD_HALF + 3;
const SEARCH_POINTS = 160;
const SEARCH_STRIDE = 4;
const SEARCH_OFFSETS = [24, 36, 50, 66];

export interface GymLevel {
  id: string;
  name: string;
  brings: string;
  cones: number;
  /** Slalom cone gap, metres. */
  spacing: number;
  /** Spin box side, metres. */
  spin: number;
  stop: { l: number; w: number };
}

export const LEVELS: readonly GymLevel[] = [
  { id: "g1", name: "Warm up", brings: "Three wide cones, a big spin box, a roomy stop box.", cones: 3, spacing: 15, spin: 15, stop: { l: 8.5, w: 4.6 } },
  { id: "g2", name: "Slalom", brings: "Five cones to weave.", cones: 5, spacing: 13, spin: 14, stop: { l: 8, w: 4.4 } },
  { id: "g3", name: "Closer cones", brings: "Six cones, closer together.", cones: 6, spacing: 11.5, spin: 13, stop: { l: 7.4, w: 4.2 } },
  { id: "g4", name: "Spin box", brings: "A tighter spin box: handbrake it round.", cones: 6, spacing: 11, spin: 10.5, stop: { l: 7, w: 4 } },
  { id: "g5", name: "Long weave", brings: "Eight cones, a shorter stop box.", cones: 8, spacing: 10, spin: 10, stop: { l: 6.4, w: 3.8 } },
  { id: "g6", name: "Precision", brings: "Tight everywhere.", cones: 8, spacing: 9, spin: 9, stop: { l: 5.9, w: 3.5 } },
  { id: "g7", name: "Final", brings: "Ten cones, the smallest boxes.", cones: 10, spacing: 8.5, spin: 8.5, stop: { l: 5.6, w: 3.3 } },
];
export const LEVEL_IDS = LEVELS.map((level) => level.id);

/** Course frame: +v runs down the slalom along (sin, cos) in world x/z, +u along (cos, -sin). */
export interface Site {
  x: number;
  y: number;
  z: number;
  heading: number;
}

export interface Box {
  u: number;
  v: number;
  /** Half extents along u and v. */
  hu: number;
  hv: number;
}

export interface Cone {
  u: number;
  v: number;
}

export interface Course {
  level: GymLevel;
  site: Site;
  /** Slalom cones first, in driving order; the boxes' outline cones after them. */
  cones: Cone[];
  /** Side of each slalom cone to pass on: -1 is -u, 1 is +u. */
  sides: number[];
  spin: Box;
  stop: Box;
  start: { u: number; v: number };
  start_line: number;
  par_ms: number;
}

export interface Ground {
  height(x: number, z: number): number;
  distance_to_road(x: number, z: number): number;
  readonly road: readonly { x: number; z: number; tx: number; tz: number }[];
  readonly solids: readonly Solid[];
}

export function to_local(site: Site, x: number, z: number): { u: number; v: number } {
  const dx = x - site.x;
  const dz = z - site.z;
  const c = Math.cos(site.heading);
  const s = Math.sin(site.heading);
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}

export function to_world(site: Site, u: number, v: number): { x: number; z: number } {
  const c = Math.cos(site.heading);
  const s = Math.sin(site.heading);
  return { x: site.x + u * c + v * s, z: site.z - u * s + v * c };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function outline(box: Box, open_side: "near" | null): Cone[] {
  const cones: Cone[] = [];
  for (const su of [-1, 0, 1])
    for (const sv of [-1, 0, 1]) {
      if (su === 0 && sv === 0) continue;
      if (open_side === "near" && su === 0 && sv === -1) continue;
      if (open_side === null && (su === 0 || sv === 0)) continue;
      cones.push({ u: box.u + su * box.hu, v: box.v + sv * box.hv });
    }
  return cones;
}

export function footprint(levels: readonly GymLevel[] = LEVELS): { u0: number; u1: number; v0: number; v1: number } {
  let v1 = 0;
  let half = 0;
  for (const level of levels) {
    v1 = Math.max(v1, FIRST_CONE + (level.cones - 1) * level.spacing * 1.1 + 6 + level.spin + SITE_MARGIN);
    half = Math.max(half, level.spin / 2);
  }
  return { u0: -half - SITE_MARGIN, u1: LANE_GAP + half + SITE_MARGIN, v0: -6, v1 };
}

function site_score(ground: Ground, site: Site, area: ReturnType<typeof footprint>, solids: readonly Solid[]): number {
  let low = Infinity;
  let high = -Infinity;
  for (let u = area.u0; u <= area.u1; u += SITE_STEP)
    for (let v = area.v0; v <= area.v1; v += SITE_STEP) {
      const { x, z } = to_world(site, u, v);
      const y = ground.height(x, z);
      if (y < SITE_MIN_Y || ground.distance_to_road(x, z) < SITE_ROAD_CLEAR) return Infinity;
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
  for (const solid of solids) {
    const { u, v } = to_local(site, solid.x, solid.z);
    const reach = solid.kind === "circle" ? solid.radius : Math.hypot(solid.hw, solid.hd);
    if (u > area.u0 - reach && u < area.u1 + reach && v > area.v0 - reach && v < area.v1 + reach) return Infinity;
  }
  return high - low;
}

/** The flattest clear patch beside the road near `start`, laid out parallel to it; null when nothing nearby is clear. */
export function find_site(ground: Ground, start: number): Site | null {
  const area = footprint();
  const reach = Math.hypot(area.u1 - area.u0, area.v1 - area.v0) + Math.max(...SEARCH_OFFSETS);
  const from = ground.road[(start + ground.road.length) % ground.road.length];
  const span = SEARCH_POINTS * SEARCH_STRIDE * 6 + reach;
  const near = ground.solids.filter((solid) => Math.abs(solid.x - from.x) < span && Math.abs(solid.z - from.z) < span);
  let best: Site | null = null;
  let best_score = Infinity;
  for (let step = -SEARCH_POINTS; step <= SEARCH_POINTS; step += SEARCH_STRIDE) {
    const p = ground.road[(start + step + ground.road.length * 4) % ground.road.length];
    const heading = Math.atan2(p.tx, p.tz);
    for (const side of [-1, 1])
      for (const offset of SEARCH_OFFSETS) {
        const nx = Math.cos(heading) * side;
        const nz = -Math.sin(heading) * side;
        const shift = side > 0 ? offset : offset + area.u1;
        const site = { x: p.x + nx * shift, y: 0, z: p.z + nz * shift, heading };
        const score = site_score(ground, site, area, near) + Math.abs(step) * 0.002;
        if (score < best_score) {
          best_score = score;
          best = site;
        }
      }
    if (best_score < 0.6) break;
  }
  if (!best) return null;
  return { ...best, y: ground.height(best.x, best.z) };
}

function par_for(level: GymLevel, slalom_end: number, spin: Box, stop: Box): number {
  const out = (slalom_end + spin.hv * 2 + 6) * 1.12;
  const home = spin.v + spin.hv - stop.v;
  const seconds = out / 8.5 + 3.5 + home / 11 + 2.5;
  return Math.round(seconds * 2) * 500;
}

export function build_course(world_seed: number, site: Site, level: GymLevel): Course {
  const rng = mulberry32(sub(world_seed, `gymkhana:${level.id}`));
  const first_side = rng() < 0.5 ? -1 : 1;
  const cones: Cone[] = [];
  const sides: number[] = [];
  let v = FIRST_CONE;
  for (let i = 0; i < level.cones; i++) {
    if (i) v += level.spacing * (0.92 + rng() * 0.16);
    cones.push({ u: (rng() - 0.5) * 0.8, v });
    sides.push(i % 2 ? -first_side : first_side);
  }
  const half = level.spin / 2;
  const spin: Box = { u: 0, v: v + 6 + half, hu: half, hv: half };
  const stop: Box = { u: LANE_GAP, v: START_LINE + 4 + level.stop.l / 2, hu: level.stop.w / 2, hv: level.stop.l / 2 };
  cones.push(...outline(spin, "near"), ...outline(stop, null));
  return { level, site, cones, sides, spin, stop, start: { u: 0, v: 0 }, start_line: START_LINE, par_ms: par_for(level, v, spin, stop) };
}

export const RunStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const Step = { SLALOM: "slalom", SPIN: "spin", STOP: "stop", DONE: "done" } as const;
export type Step = (typeof Step)[keyof typeof Step];

export interface Pose {
  x: number;
  z: number;
  heading: number;
  /** m/s, unsigned. */
  speed: number;
}

export interface Body {
  circles: readonly number[];
  radius: number;
  length: number;
  width: number;
}

export interface Hit {
  cone: number;
  /** Direction the cone gets knocked, world x/z unit vector. */
  dx: number;
  dz: number;
  speed: number;
}

const inside = (box: Box, u: number, v: number) => Math.abs(u - box.u) <= box.hu && Math.abs(v - box.v) <= box.hv;

export class GymRun {
  status: RunStatus = RunStatus.READY;
  started = 0;
  ended = 0;
  hits = 0;
  misses = 0;
  /** Index of the next slalom cone while the step is SLALOM. */
  next = 0;
  spun = 0;
  readonly knocked = new Set<number>();
  private last_v: number | null = null;
  private last_heading: number | null = null;

  constructor(readonly course: Course) {}

  get step(): Step {
    if (this.status === RunStatus.DONE) return Step.DONE;
    if (this.next < this.course.sides.length) return Step.SLALOM;
    return Math.abs(this.spun) >= SPIN_DONE ? Step.STOP : Step.SPIN;
  }

  elapsed(now: number): number {
    if (this.status === RunStatus.READY) return 0;
    return (this.status === RunStatus.DONE ? this.ended : now) - this.started;
  }

  penalty_ms(): number {
    return this.hits * HIT_MS + this.misses * MISS_MS;
  }

  total(now: number): number {
    return this.elapsed(now) + this.penalty_ms();
  }

  stars(): number {
    return stars_for(this.total(this.ended), this.course.par_ms);
  }

  update(now: number, pose: Pose, body: Body): Hit[] {
    if (this.status === RunStatus.DONE) return [];
    const { course } = this;
    const { u, v } = to_local(course.site, pose.x, pose.z);
    const heading = wrap(pose.heading - course.site.heading);
    const last_v = this.last_v;
    this.last_v = v;
    const turn = this.last_heading === null ? 0 : wrap(heading - this.last_heading);
    this.last_heading = heading;

    if (this.status === RunStatus.READY) {
      if (last_v !== null && last_v < course.start_line && v >= course.start_line) {
        this.status = RunStatus.RUNNING;
        this.started = now;
      }
      return this.cone_hits(pose, body);
    }

    const step = this.step;
    if (step === Step.SLALOM && last_v !== null) {
      const cone = course.cones[this.next];
      if (last_v < cone.v && v >= cone.v) {
        if (Math.sign(u - cone.u) !== course.sides[this.next]) this.misses++;
        this.next++;
      }
    } else if (step === Step.SPIN) {
      this.spun = inside(course.spin, u, v) ? this.spun + turn : 0;
    } else if (step === Step.STOP && pose.speed < STOP_SPEED && this.parked(pose, body, heading)) {
      this.status = RunStatus.DONE;
      this.ended = now;
    }
    return this.cone_hits(pose, body);
  }

  private parked(pose: Pose, body: Body, heading: number): boolean {
    if (Math.abs(wrap(heading - Math.PI)) > STOP_HEADING) return false;
    const fx = Math.sin(pose.heading);
    const fz = Math.cos(pose.heading);
    for (const sl of [-1, 1])
      for (const sw of [-1, 1]) {
        const x = pose.x + fx * sl * (body.length / 2) + fz * sw * (body.width / 2);
        const z = pose.z + fz * sl * (body.length / 2) - fx * sw * (body.width / 2);
        const local = to_local(this.course.site, x, z);
        if (!inside(this.course.stop, local.u, local.v)) return false;
      }
    return true;
  }

  private cone_hits(pose: Pose, body: Body): Hit[] {
    const hits: Hit[] = [];
    const fx = Math.sin(pose.heading);
    const fz = Math.cos(pose.heading);
    const reach = body.radius + CONE_RADIUS;
    this.course.cones.forEach((cone, index) => {
      if (this.knocked.has(index)) return;
      const at = to_world(this.course.site, cone.u, cone.v);
      for (const offset of body.circles) {
        const dx = at.x - (pose.x + fx * offset);
        const dz = at.z - (pose.z + fz * offset);
        const d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        this.knocked.add(index);
        if (this.status === RunStatus.RUNNING) this.hits++;
        hits.push({ cone: index, dx: d > 1e-6 ? dx / d : fx, dz: d > 1e-6 ? dz / d : fz, speed: pose.speed });
        return;
      }
    });
    return hits;
  }
}
