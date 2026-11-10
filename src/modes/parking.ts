import type { Solid } from "../world/world";
import { to_local, to_world, type Body, type Pose, type Site } from "./gymkhana";
import { MAX_STARS } from "./track";

const DEG = Math.PI / 180;
export const PARK_ANGLE = 6 * DEG;
export const STRAIGHT_ANGLE = 2 * DEG;
export const PARK_SPEED = 0.1;
export const HOLD_MS = 1000;
const MOVE_SPEED = 0.5;
// The solver pushes a circle out to exactly touching, so a car resting against an obstacle reads as touching it.
const TOUCH_GAP = 0.05;
const TOUCH_CLEAR_MS = 500;
export const CONE_RADIUS = 0.3;
const CONE_HEIGHT = 0.7;
const PARKED = { w: 1.9, l: 4.5, h: 1.4 };
const WALL = { t: 0.2, h: 2.4 };
const BARRIER = { t: 0.3, h: 0.9 };
const AISLE = 3.5;

/** Site-local frame from `gymkhana.ts`: +v ahead of the start, +u to its left; a heading of 0 points along +v. */
export interface ParkBay {
  u: number;
  v: number;
  heading: number;
  w: number;
  l: number;
  either: boolean;
}

export type ObstacleKind = "car" | "cone" | "wall";

export interface ParkObstacle {
  kind: ObstacleKind;
  u: number;
  v: number;
  heading: number;
  w: number;
  l: number;
  h: number;
}

export interface ParkLevel {
  id: string;
  name: string;
  brings: string;
  par_ms: number;
  start: { u: number; v: number; heading: number };
  bay: ParkBay;
  lines: ParkBay[];
  obstacles: ParkObstacle[];
}

const car = (bay: ParkBay, back = 0.3): ParkObstacle => ({
  kind: "car",
  u: bay.u + Math.sin(bay.heading) * back,
  v: bay.v + Math.cos(bay.heading) * back,
  heading: bay.heading,
  w: PARKED.w,
  l: PARKED.l,
  h: PARKED.h,
});

const cone = (u: number, v: number): ParkObstacle => ({ kind: "cone", u, v, heading: 0, w: CONE_RADIUS * 2, l: CONE_RADIUS * 2, h: CONE_HEIGHT });

const wall = (u: number, v: number, heading: number, l: number, t = WALL.t, h = WALL.h): ParkObstacle => ({ kind: "wall", u, v, heading, w: t, l, h });

function row(u: number, v: number, heading: number, w: number, l: number, from: number, to: number): ParkBay[] {
  const bays: ParkBay[] = [];
  for (let i = from; i <= to; i++) bays.push({ u, v: v + i * w, heading, w, l, either: false });
  return bays;
}

function angled_row(edge: number, v: number, lean: number, w: number, l: number, from: number, to: number): ParkBay[] {
  const step = w / Math.cos(lean);
  const bays: ParkBay[] = [];
  for (let i = from; i <= to; i++)
    bays.push({ u: edge + Math.cos(lean) * (l / 2), v: v + i * step + Math.sin(lean) * (l / 2), heading: Math.PI / 2 - lean, w, l, either: false });
  return bays;
}

function parallel(name: string, id: string, brings: string, par_ms: number, l: number, w: number, gap: number): ParkLevel {
  const u = AISLE - 0.2 + w / 2;
  const v = 20;
  const bay: ParkBay = { u, v, heading: 0, w, l, either: false };
  const reach = l / 2 + gap + PARKED.l / 2;
  const kerb = u + w / 2 + BARRIER.t / 2 + 0.1;
  return {
    id,
    name,
    brings,
    par_ms,
    start: { u: -1, v: 0, heading: 0 },
    bay,
    lines: [],
    obstacles: [
      car({ ...bay, v: v - reach }, 0),
      car({ ...bay, v: v + reach }, 0),
      wall(kerb, v, 0, 26, BARRIER.t, BARRIER.h),
    ],
  };
}

function garage(id: string, name: string, brings: string, par_ms: number, inner: number, bay_w: number, bay_l: number, heading: number, either: boolean, neighbours: boolean): ParkLevel {
  const v = 18;
  const depth = bay_l + 0.6;
  const u0 = AISLE + 0.5;
  const bay: ParkBay = { u: u0 + depth / 2, v, heading, w: bay_w, l: bay_l, either };
  const side = inner / 2 + WALL.t / 2;
  const obstacles: ParkObstacle[] = [
    wall(u0 + depth / 2, v - side, Math.PI / 2, depth + WALL.t),
    wall(u0 + depth / 2, v + side, Math.PI / 2, depth + WALL.t),
    wall(u0 + depth + WALL.t / 2, v, 0, inner + WALL.t * 2),
  ];
  if (neighbours) {
    obstacles.push(...row(-(AISLE + 2.9), v, -Math.PI / 2, 2.7, 5.8, -2, 2).map((b) => car(b)));
    obstacles.push(car({ u: AISLE + 2.9, v: v - side - 1.8, heading: Math.PI / 2, w: 2.7, l: 5.8, either: false }));
    obstacles.push(car({ u: AISLE + 2.9, v: v + side + 1.8, heading: Math.PI / 2, w: 2.7, l: 5.8, either: false }));
  }
  return { id, name, brings, par_ms, start: { u: -1.5, v: 0, heading: 0 }, bay, lines: [], obstacles };
}

function wide(): ParkLevel {
  const bay: ParkBay = { u: 0, v: 18, heading: 0, w: 3.6, l: 6.5, either: false };
  const back = bay.v + bay.l / 2 + 0.5;
  return {
    id: "p1",
    name: "Wide bay",
    brings: "One roomy bay dead ahead: drive in nose first and stop.",
    par_ms: 15000,
    start: { u: 0, v: 0, heading: 0 },
    bay,
    lines: [],
    obstacles: [cone(-bay.w / 2, back), cone(bay.w / 2, back), cone(0, back + 0.2)],
  };
}

function side_bay(id: string, name: string, brings: string, par_ms: number, w: number, nose: number, across: boolean): ParkLevel {
  const l = 5.8;
  const v = 16;
  const right = row(AISLE + l / 2, v, Math.PI / 2, w, l, -2, 2);
  const target = right[2];
  const bay: ParkBay = { ...target, heading: nose };
  const obstacles = right.filter((b) => b !== target).map((b) => car(b));
  const lines = [...right];
  if (across) {
    const left = row(-(AISLE + l / 2), v, -Math.PI / 2, w, l, -2, 2);
    obstacles.push(...left.filter((_, i) => i !== 0 && i !== 3).map((b) => car(b)));
    lines.push(...left);
  }
  return { id, name, brings, par_ms, start: { u: -1.5, v: 0, heading: 0 }, bay, lines: lines.filter((b) => b !== target), obstacles };
}

function angled(): ParkLevel {
  const lean = Math.PI / 4;
  const bays = angled_row(AISLE, 12, lean, 2.7, 5.6, -1, 2);
  const bay = bays[1];
  const tail = { u: bay.u + Math.sin(bay.heading) * (bay.l / 2 + 0.4), v: bay.v + Math.cos(bay.heading) * (bay.l / 2 + 0.4) };
  const across = { u: Math.cos(bay.heading) * (bay.w / 2), v: -Math.sin(bay.heading) * (bay.w / 2) };
  return {
    id: "p6",
    name: "Angled",
    brings: "A slanted bay between two cars and a cone line: turn in nose first.",
    par_ms: 25000,
    start: { u: -1.5, v: 0, heading: 0 },
    bay,
    lines: bays.filter((b) => b !== bay),
    obstacles: [car(bays[0]), car(bays[2]), car(bays[3]), cone(tail.u - across.u, tail.v - across.v), cone(tail.u + across.u, tail.v + across.v)],
  };
}

export const PARK_LEVELS: readonly ParkLevel[] = [
  wide(),
  side_bay("p2", "Between cars", "Turn into a bay with a car either side, nose first.", 22000, 3.0, Math.PI / 2, false),
  side_bay("p3", "Reverse bay", "Back into the bay so you can drive straight out.", 32000, 2.8, -Math.PI / 2, true),
  parallel("Parallel", "p4", "Reverse into the gap along the kerb, nose forward.", 35000, 7.4, 2.6, 0.2),
  garage("p5", "Garage", "Off the aisle, through the door, either way round.", 35000, 3.0, 2.6, 5.6, Math.PI / 2, true, false),
  angled(),
  parallel("Tight parallel", "p7", "A shorter gap, a narrower kerb lane.", 45000, 6.6, 2.35, 0.2),
  garage("p8", "Tight garage", "Reverse into a narrow garage across a full aisle.", 50000, 2.7, 2.4, 5.4, -Math.PI / 2, false, true),
];
export const PARK_IDS = PARK_LEVELS.map((level) => level.id);

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function park_solids(site: Site, level: ParkLevel, height: (x: number, z: number) => number): Solid[] {
  return level.obstacles.map((o) => {
    const { x, z } = to_world(site, o.u, o.v);
    const y = height(x, z);
    if (o.kind === "cone") return { kind: "circle", x, y, z, radius: CONE_RADIUS, height: o.h };
    const heading = site.heading + o.heading;
    return { kind: "box", x, y, z, hw: o.w / 2, hd: o.l / 2, cos: Math.cos(heading), sin: Math.sin(heading), height: o.h };
  });
}

export const Verdict = { OUTSIDE: "outside", CROOKED: "crooked", BACKWARDS: "backwards", INSIDE: "inside" } as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export interface Fit {
  verdict: Verdict;
  angle: number;
  offset: number;
}

export function corners(site: Site, pose: Pose, body: Pick<Body, "length" | "width">): { u: number; v: number }[] {
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  const out: { u: number; v: number }[] = [];
  for (const [sl, sw] of [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ]) {
    const x = pose.x + fx * sl * (body.length / 2) + fz * sw * (body.width / 2);
    const z = pose.z + fz * sl * (body.length / 2) - fx * sw * (body.width / 2);
    out.push(to_local(site, x, z));
  }
  return out;
}

export function in_bay(bay: ParkBay, u: number, v: number): boolean {
  const du = u - bay.u;
  const dv = v - bay.v;
  const c = Math.cos(bay.heading);
  const s = Math.sin(bay.heading);
  const across = du * c - dv * s;
  const along = du * s + dv * c;
  return Math.abs(across) <= bay.w / 2 && Math.abs(along) <= bay.l / 2;
}

export function fit(site: Site, bay: ParkBay, pose: Pose, body: Pick<Body, "length" | "width">): Fit {
  const heading = wrap(pose.heading - site.heading);
  const off = Math.abs(wrap(heading - bay.heading));
  const flipped = Math.PI - off;
  const angle = bay.either ? Math.min(off, flipped) : off;
  const centre = to_local(site, pose.x, pose.z);
  const offset = Math.hypot(centre.u - bay.u, centre.v - bay.v);
  if (!corners(site, pose, body).every((p) => in_bay(bay, p.u, p.v))) return { verdict: Verdict.OUTSIDE, angle, offset };
  if (angle <= PARK_ANGLE) return { verdict: Verdict.INSIDE, angle, offset };
  return { verdict: !bay.either && flipped <= PARK_ANGLE ? Verdict.BACKWARDS : Verdict.CROOKED, angle, offset };
}

export interface ParkResult {
  ms: number;
  touches: number;
  angle: number;
  offset: number;
}

/** Parking at all earns one star; three need no touch, a time at or under par and the body within STRAIGHT_ANGLE of the axis. */
export function park_stars(result: Pick<ParkResult, "ms" | "touches" | "angle">, par_ms: number): number {
  let stars = MAX_STARS;
  if (result.touches > 0) stars--;
  if (result.touches > 2) stars--;
  if (result.ms > par_ms) stars--;
  if (result.angle > STRAIGHT_ANGLE) stars--;
  return Math.max(1, stars);
}

function circle_gap(solid: Solid, px: number, pz: number): number {
  const ox = px - solid.x;
  const oz = pz - solid.z;
  if (solid.kind === "circle") return Math.hypot(ox, oz) - solid.radius;
  const lx = ox * solid.cos - oz * solid.sin;
  const lz = ox * solid.sin + oz * solid.cos;
  return Math.hypot(Math.max(0, Math.abs(lx) - solid.hw), Math.max(0, Math.abs(lz) - solid.hd));
}

export function touching(solids: readonly Solid[], pose: Pose, body: Pick<Body, "circles" | "radius">): boolean {
  const fx = Math.sin(pose.heading);
  const fz = Math.cos(pose.heading);
  for (const offset of body.circles) {
    const px = pose.x + fx * offset;
    const pz = pose.z + fz * offset;
    for (const solid of solids) if (circle_gap(solid, px, pz) < body.radius + TOUCH_GAP) return true;
  }
  return false;
}

export const ParkStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type ParkStatus = (typeof ParkStatus)[keyof typeof ParkStatus];

export class ParkRun {
  status: ParkStatus = ParkStatus.READY;
  clock = 0;
  started = 0;
  ended = 0;
  touches = 0;
  held = 0;
  last: Fit = { verdict: Verdict.OUTSIDE, angle: Math.PI, offset: Infinity };
  private in_touch = false;
  private clear_ms = Infinity;

  constructor(
    readonly site: Site,
    readonly level: ParkLevel,
    readonly solids: readonly Solid[],
  ) {}

  elapsed(): number {
    if (this.status === ParkStatus.READY) return 0;
    return (this.status === ParkStatus.DONE ? this.ended : this.clock) - this.started;
  }

  result(): ParkResult {
    return { ms: this.elapsed(), touches: this.touches, angle: this.last.angle, offset: this.last.offset };
  }

  stars(): number {
    return park_stars(this.result(), this.level.par_ms);
  }

  /** Returns true on the frame a new touch counts. */
  update(dt_ms: number, pose: Pose, body: Body): boolean {
    if (this.status === ParkStatus.DONE) return false;
    this.clock += dt_ms;
    if (this.status === ParkStatus.READY && pose.speed > MOVE_SPEED) {
      this.status = ParkStatus.RUNNING;
      this.started = this.clock;
    }
    let touched = false;
    const now = touching(this.solids, pose, body);
    if (now) {
      if (!this.in_touch && this.clear_ms >= TOUCH_CLEAR_MS && this.status === ParkStatus.RUNNING) {
        this.touches++;
        touched = true;
      }
      this.clear_ms = 0;
    } else {
      this.clear_ms += dt_ms;
    }
    this.in_touch = now;
    if (this.status !== ParkStatus.RUNNING) return touched;
    this.last = fit(this.site, this.level.bay, pose, body);
    this.held = this.last.verdict === Verdict.INSIDE && pose.speed < PARK_SPEED ? this.held + dt_ms : 0;
    if (this.held >= HOLD_MS) {
      this.status = ParkStatus.DONE;
      this.ended = this.clock;
    }
    return touched;
  }
}

export function park_footprint(levels: readonly ParkLevel[] = PARK_LEVELS): { u0: number; u1: number; v0: number; v1: number } {
  let u0 = -4;
  let u1 = 4;
  let v0 = -6;
  let v1 = 8;
  const grow = (u: number, v: number, reach: number) => {
    u0 = Math.min(u0, u - reach);
    u1 = Math.max(u1, u + reach);
    v0 = Math.min(v0, v - reach);
    v1 = Math.max(v1, v + reach);
  };
  for (const level of levels) {
    for (const o of level.obstacles) grow(o.u, o.v, Math.hypot(o.w, o.l) / 2 + 2);
    for (const bay of [level.bay, ...level.lines]) grow(bay.u, bay.v, Math.hypot(bay.w, bay.l) / 2 + 2);
  }
  return { u0, u1, v0, v1 };
}
