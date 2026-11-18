/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { RouteTracker, type RoutePoint } from "./route";
import { CutCheck, LineMeasure, TrackSide, track_side } from "./track-limits";
import { RACE_RULES, Stewards } from "./race-rules";

const HALF = 6;
const ON_ROAD = HALF + 0.5;
const RADIUS = 40;
const DT = 1 / 60;
const CENTRE = { x: RADIUS, z: 100 };

interface Spot {
  x: number;
  z: number;
}

const arc = (r: number, step = 1): Spot[] => {
  const out: Spot[] = [];
  const n = Math.ceil((r * Math.PI) / 2 / step);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * (Math.PI / 2);
    out.push({ x: CENTRE.x + r * Math.cos(a), z: CENTRE.z + r * Math.sin(a) });
  }
  return out;
};

const straight = (from: Spot, to: Spot, step = 1): Spot[] => {
  const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / step));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / n, z: from.z + ((to.z - from.z) * i) / n }));
};

// North for 100 m, a right-hand 90 degree bend of 40 m radius, then east for 100 m.
const APPROACH = straight({ x: 0, z: 0 }, { x: 0, z: 100 });
const EXIT = straight({ x: RADIUS, z: 140 }, { x: 140, z: 140 });
const CENTRE_LINE = [...APPROACH, ...arc(RADIUS).slice(1), ...EXIT.slice(1)];
const LINE: RoutePoint[] = CENTRE_LINE.map((p, i) => {
  const a = CENTRE_LINE[Math.max(0, i - 1)];
  const b = CENTRE_LINE[Math.min(CENTRE_LINE.length - 1, i + 1)];
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: p.x, z: p.z, tx: (b.x - a.x) / d, tz: (b.z - a.z) / d };
});

const GROUND = {
  on_road: (x: number, z: number) => LINE.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < ON_ROAD ** 2),
  on_kerb: () => false,
};

const car = () => ({ pos: new Vector3(), vel: new Vector3(), wheels: [-1, 1].flatMap((side) => [-1.4, 1.4].map(() => ({ contact: true, point: { x: 0, z: 0 }, side }))) });
type TestCar = ReturnType<typeof car>;

function place(c: TestCar, at: Spot, dir: Spot, speed: number) {
  c.pos.set(at.x, 0, at.z);
  c.vel.set(dir.x * speed, 0, dir.z * speed);
  for (const w of c.wheels) w.point = { x: at.x + dir.z * 0.8 * w.side, z: at.z - dir.x * 0.8 * w.side };
}

/** Drives `path` at `speed(share of the way, where)` m/s, calling `frame` each step with the car and its nearest line point. */
function drive(path: Spot[], speed: (share: number, at: Spot) => number, frame: (c: TestCar, index: number) => void) {
  const c = car();
  const tracker = new RouteTracker(LINE);
  const along = [0];
  for (let i = 1; i < path.length; i++) along.push(along[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const total = along[along.length - 1];
  let s = 0;
  let k = 0;
  while (s < total) {
    while (k < path.length - 2 && along[k + 1] < s) k++;
    const a = path[k];
    const b = path[k + 1];
    const seg = along[k + 1] - along[k];
    const t = seg > 0 ? (s - along[k]) / seg : 0;
    const at = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    const v = speed(s / total, at);
    place(c, at, { x: (b.x - a.x) / seg, z: (b.z - a.z) / seg }, v);
    frame(c, tracker.update(c.pos.x, c.pos.z));
    s += v * DT;
  }
}

function cuts_on(path: Spot[], speed: (share: number, at: Spot) => number): number {
  const measure = new LineMeasure(LINE);
  const check = new CutCheck(measure, HALF);
  drive(path, speed, (c, index) => check.update(track_side(c, GROUND), measure.at(0, index, c.pos.x, c.pos.z), c.vel.length(), DT));
  return check.cuts;
}

const flat = (v: number) => () => v;
const IN = { x: 0, z: 100 };
const OUT = { x: RADIUS, z: 140 };
const CHORD = [...APPROACH, ...straight(IN, OUT).slice(1), ...EXIT.slice(1)];
const around = (r: number) => [...APPROACH, ...straight(IN, arc(r)[0]).slice(1), ...arc(r).slice(1), ...straight({ x: RADIUS, z: CENTRE.z + r }, OUT).slice(1), ...EXIT.slice(1)];

test("track side: a wheel on the road keeps the car on; all off is off; none touching is air", () => {
  const c = car();
  place(c, { x: 0, z: 50 }, { x: 0, z: 1 }, 20);
  expect(track_side(c, GROUND)).toBe(TrackSide.ON);
  place(c, { x: -20, z: 50 }, { x: 0, z: 1 }, 20);
  expect(track_side(c, GROUND)).toBe(TrackSide.OFF);
  c.wheels[0].point = { x: -6, z: 50 };
  expect(track_side(c, GROUND)).toBe(TrackSide.ON);
  for (const w of c.wheels) w.contact = false;
  expect(track_side(c, GROUND)).toBe(TrackSide.AIR);
});

test("line measure: metres along and the turn between them", () => {
  const measure = new LineMeasure(LINE);
  const arc_m = (RADIUS * Math.PI) / 2;
  expect(measure.length).toBeCloseTo(200 + arc_m, 0);
  expect(measure.at(0, 50, 3, 50)).toBeCloseTo(50, 5);
  expect(measure.at(1, 50, 3, 50)).toBeCloseTo(measure.length + 50, 5);
  expect(measure.turned(0, 95)).toBeCloseTo(0, 5);
  expect(measure.turned(90, 110 + arc_m)).toBeCloseTo(Math.PI / 2, 1);
  expect(measure.turned(10, measure.length + 10)).toBeCloseTo(Math.PI / 2, 1);
});

test("cut: straight across the inside of the bend at speed gains time and counts", () => {
  expect(cuts_on(CHORD, flat(30))).toBe(1);
});

test("cut: the same line through the grass that bogs down loses time and does not count", () => {
  expect(cuts_on(CHORD, (_, at) => (LINE.some((p) => (p.x - at.x) ** 2 + (p.z - at.z) ** 2 < (ON_ROAD + 1) ** 2) ? 30 : 8))).toBe(0);
});

test("cut: running wide round the outside, losing speed, does not count", () => {
  expect(cuts_on(around(RADIUS + 12), (share) => 30 - 10 * share)).toBe(0);
});

test("cut: running wide round the outside on the throttle does not count", () => {
  expect(cuts_on(around(RADIUS + 12), (share) => 20 + 15 * share)).toBe(0);
});

test("cut: all four just off at the apex, at a speed the bend holds, gains nothing worth a call", () => {
  expect(cuts_on(around(RADIUS - 8), flat(20))).toBe(0);
});

test("cut: the centre line has no run off the road at all", () => {
  expect(cuts_on(CENTRE_LINE, flat(30))).toBe(0);
});

test("stewards: two warnings, then each cut costs its penalty", () => {
  const stewards = new Stewards(RACE_RULES, LINE, HALF);
  const calls: string[] = [];
  for (let lap = 0; lap < 4; lap++)
    drive(CHORD, flat(30), (c, index) => {
      const call = stewards.limits(c, GROUND, lap, index, DT);
      if (call) calls.push(call);
    });
  expect(calls).toEqual(["Track limits · warning 1/2", "Track limits · warning 2/2", "Track limits · +2 s", "Track limits · +2 s"]);
  expect(stewards.cuts).toBe(4);
  expect(stewards.penalty_ms).toBe(4000);
});

test("stewards: no limits, no calls", () => {
  const stewards = new Stewards({ limits: null, wrong_way_ms: null }, LINE, HALF);
  let calls = 0;
  drive(CHORD, flat(30), (c, index) => {
    if (stewards.limits(c, GROUND, 0, index, DT)) calls++;
  });
  expect(calls).toBe(0);
  expect(stewards.penalty_ms).toBe(0);
});

test("stewards: the wrong way for its whole limit puts the car back once, and turning round starts it over", () => {
  const stewards = new Stewards(RACE_RULES, LINE, HALF);
  const step = 100;
  let back = 0;
  for (let t = 0; t < 4900; t += step) if (stewards.wrong_way(true, step)) back++;
  expect(back).toBe(0);
  expect(stewards.wrong_way(false, step)).toBe(false);
  for (let t = 0; t < 4900; t += step) if (stewards.wrong_way(true, step)) back++;
  expect(back).toBe(0);
  expect(stewards.wrong_way(true, step)).toBe(true);
  expect(stewards.wrong_way(true, step)).toBe(false);
  expect(new Stewards({ limits: null, wrong_way_ms: null }, LINE, HALF).wrong_way(true, 1e9)).toBe(false);
});
