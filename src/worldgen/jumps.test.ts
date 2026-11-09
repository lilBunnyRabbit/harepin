/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { Car, type Ground } from "../car";
import { CARS } from "../cars";
import { seed_of } from "../rng";
import { generate } from "./index";
import { DECK_UNDER } from "./deck";
import { gap_ramp, GAP_FAST, GAP_SLOW, LANDING_GRADE, LANDING_HALF, size_gap } from "./sky";
import { GAP_V_MAX, GAP_V_MIN, gap_jump, type GapJump } from "./gap";
import { apex, face_end, flight, GATE_CLEAR, GATE_RUNOUT, ramp_local, ramp_surface, ROAD_KICKER, RUN_DRIFT } from "./jumps";
import { SPAWN_INDEX, type Ramp } from "./types";

const DT = 1 / 360;
const KICKER: Ramp = { id: 0, kind: "kicker", x: 0, y: 0, z: 0, fx: 0, fz: 1, hw: 2.6, length: 8, rise: 2, grade: 0, landing: 45, speed: 21 };
const BIG: Ramp = { ...KICKER, kind: "big", hw: 3.2, length: 14, rise: 4, landing: 80, speed: 27 };
const ROAD: Ramp = { ...KICKER, ...ROAD_KICKER, road: true };

function ground_with(r: Ramp): Ground {
  return {
    height: (x, z) => Math.max(0, ramp_surface(r, x, z)?.y ?? 0),
    normal: (x, z, out) => {
      const s = ramp_surface(r, x, z);
      return s && s.y > 0 ? out.set(-s.gx, 1, -s.gz).normalize() : out.set(0, 1, 0);
    },
    grip: () => 1,
    roll: () => 1,
  };
}

interface Jump {
  toe: number;
  at_challenge: number;
  sink: number;
  upright: number;
  air: number;
  landed: number;
  /** Peak yaw rate (rad/s) once back on the ground, and how far the heading turned from the toe on. */
  yaw: number;
  heading: number;
  /** Where the car first came back down after a real flight, and how far it had drifted sideways by then. */
  touch: number;
  drift: number;
}

/** A sky-track gap jump along +z: deck to the lip, open air over the gap, then the landing and its sag back to level. */
function ground_gap(): Ground {
  const { gap, landing, sag, rise, drop } = size_gap();
  const lip = gap_ramp().length;
  const land = lip + gap;
  const deck = (z: number): { y: number; g: number } | null => {
    if (z < 0) return { y: 0, g: 0 };
    if (z <= lip) return { y: (rise * z) / lip, g: rise / lip };
    if (z < land) return null;
    const top = rise - drop;
    if (z < land + landing) return { y: top + LANDING_GRADE * (z - land), g: LANDING_GRADE };
    const t = Math.min(z - land - landing, sag);
    const g = LANDING_GRADE * (1 - t / sag);
    return { y: top + LANDING_GRADE * landing + ((LANDING_GRADE + g) / 2) * t, g };
  };
  const at = (x: number, z: number, y?: number) => {
    const d = deck(z);
    return d && (y === undefined || y > d.y - DECK_UNDER) ? d : null;
  };
  return {
    height: (x, z, y) => at(x, z, y)?.y ?? -2000,
    normal: (x, z, out) => out.set(0, 1, -(at(x, z)?.g ?? 0)).normalize(),
    grip: () => 1,
    roll: () => 1,
  };
}

function jump(r: Ramp, car: Car, speed: number, slip = 0, gas = 0, ground = ground_with(r)): Jump {
  const challenge = r.length + apex(r) * 0.85;
  const up = new Vector3();
  const out: Jump = { toe: 0, at_challenge: NaN, sink: 0, upright: 1, air: 0, landed: 0, yaw: 0, heading: 0, touch: NaN, drift: NaN };
  car.place(0, 1, -60, 0);
  car.vel.set(0, 0, speed);
  let last = car.pos.z;
  for (let i = 0; i < 360 * 8; i++) {
    const throttle = car.pos.z < 0 ? Math.max(0, Math.min(1, (speed - car.forward_speed) * 0.5 + 0.3)) : gas;
    car.step(DT, { steer: 0, throttle, brake: 0, handbrake: 0, analog: false }, ground);
    if (last < 0 && car.pos.z >= 0) {
      out.toe = car.forward_speed;
      car.vel.x += slip;
      out.heading = -car.heading;
    }
    if (last < challenge && car.pos.z >= challenge) out.at_challenge = car.pos.y;
    if (car.pos.z > r.length && car.wheels.every((w) => !w.contact)) {
      out.air += DT;
      out.landed = car.pos.z;
    }
    out.sink = Math.max(out.sink, ground.height(car.pos.x, car.pos.z) - car.pos.y);
    out.upright = Math.min(out.upright, up.set(0, 1, 0).applyQuaternion(car.quat).y);
    if (out.air > 0.2 && car.wheels.some((w) => w.contact)) {
      out.yaw = Math.max(out.yaw, Math.abs(car.ang.y));
      if (Number.isNaN(out.touch)) [out.touch, out.drift] = [car.pos.z, car.pos.x];
    }
    last = car.pos.z;
  }
  out.heading += car.heading;
  return out;
}

describe("ramps at 360 Hz", () => {
  for (const r of [KICKER, BIG, ROAD])
    for (const [id, spec] of Object.entries(CARS))
      test(`${r.road ? "road " : ""}${r.kind}, ${id}: flies the predicted line and lands on its wheels`, () => {
        for (const offset of [-2, 0, 2]) {
          const run = jump(r, new Car(spec), r.speed + offset);
          expect(run.air).toBeGreaterThan(0.8);
          expect(Math.abs(run.at_challenge - flight(r, run.toe, apex(r) * 0.85))).toBeLessThan(0.4);
          expect(run.sink).toBeLessThan(0.05);
          expect(run.upright).toBeGreaterThan(0.75);
        }
      });
  for (const [id, spec] of Object.entries(CARS))
    test(`road kicker, ${id}: lands on its wheels inside the landing at racing pace`, () => {
      const run = jump(ROAD, new Car(spec), 40);
      expect(run.landed).toBeLessThan(ROAD.length + ROAD.landing);
      expect(run.upright).toBeGreaterThan(0.75);
    });
  for (const [id, spec] of Object.entries(CARS))
    test(`road kicker, ${id}: a flat-out landing with a little sideways slip stays straight`, () => {
      for (const speed of [35, 38, 42])
        for (const gas of [0, 1]) {
          const run = jump(ROAD, new Car(spec), speed, 1.5, gas);
          expect(run.yaw).toBeLessThan(0.35);
          expect(Math.abs(run.heading)).toBeLessThan(0.15);
          expect(run.upright).toBeGreaterThan(0.75);
        }
    });
});

describe("sky gap jump at 360 Hz", () => {
  const r = gap_ramp();
  const { gap, landing } = size_gap();
  const ground = ground_gap();
  // The ground runs on sideways forever: on the track the rails hold a drifting car, so only the touchdown has to fit the deck.
  for (const [id, spec] of Object.entries(CARS))
    test(`${id}: clears the gap and lands straight on its wheels from ${GAP_SLOW} to ${GAP_FAST} m/s`, () => {
      for (const speed of [GAP_SLOW, 26, 30, 34, 37, GAP_FAST])
        for (const gas of [0, 1])
          for (const slip of [0, 1.5]) {
            const car = new Car(spec);
            const run = jump(r, car, speed, slip, gas, ground);
            const where = `${speed} m/s (toe ${run.toe.toFixed(1)}), gas ${gas}, slip ${slip}`;
            expect(run.touch, where).toBeGreaterThan(r.length + gap);
            expect(run.touch, where).toBeLessThan(r.length + gap + landing);
            expect(Math.abs(run.drift), where).toBeLessThan(LANDING_HALF - 1);
            expect(car.pos.y - ground.height(car.pos.x, car.pos.z, car.pos.y), where).toBeGreaterThan(0);
            expect(car.pos.y - ground.height(car.pos.x, car.pos.z, car.pos.y), where).toBeLessThan(1.5);
            expect(run.upright, where).toBeGreaterThan(0.75);
            expect(run.sink, where).toBeLessThan(0.05);
            expect(run.yaw, where).toBeLessThan(0.35);
            expect(Math.abs(run.heading), where).toBeLessThan(0.15);
          }
    });
});

const CANYON_FLOOR = -10;

/** A canyon gap along +z: the kicker on the near rim at 0, the canyon floor under the gap, the deck on the far rim. */
function ground_canyon(g: GapJump): Ground {
  const lip = g.takeoff.length;
  const start = lip + g.gap;
  const tail = g.deck.y + g.deck.grade * g.deck.length;
  const base = (z: number) => (z <= lip ? 0 : z < start ? CANYON_FLOOR : tail);
  const top = (x: number, z: number) => {
    let best: { y: number; gx: number; gz: number } = { y: base(z), gx: 0, gz: 0 };
    for (const r of [g.takeoff, g.deck]) {
      const s = ramp_surface(r, x, z);
      if (s && s.y > best.y) best = s;
    }
    return best;
  };
  return {
    height: (x, z) => top(x, z).y,
    normal: (x, z, out) => {
      const s = top(x, z);
      return out.set(-s.gx, 1, -s.gz).normalize();
    },
    grip: () => 1,
    roll: () => 1,
  };
}

describe("canyon gap jump at 360 Hz", () => {
  const g = gap_jump(0, 0, 0, 0, 0, 1);
  const ground = ground_canyon(g);
  const start = g.takeoff.length + g.gap;
  test("the gap is a real one and the deck a long one", () => {
    expect(g.gap).toBeGreaterThan(12);
    expect(g.deck.length).toBeGreaterThan(60);
  });
  for (const [id, spec] of Object.entries(CARS))
    test(`${id}: clears the gap and lands straight on the deck from ${GAP_V_MIN} to ${GAP_V_MAX} m/s`, () => {
      for (const speed of [GAP_V_MIN, 26, 30, 35, 40, GAP_V_MAX])
        for (const gas of [0, 1])
          for (const slip of [0, 1.5]) {
            const run = jump(g.takeoff, new Car(spec), speed, slip, gas, ground);
            const where = `${speed} m/s (toe ${run.toe.toFixed(1)}), gas ${gas}, slip ${slip}`;
            expect(run.touch, where).toBeGreaterThan(start);
            expect(run.touch, where).toBeLessThan(start + g.deck.length);
            expect(run.upright, where).toBeGreaterThan(0.75);
            expect(run.sink, where).toBeLessThan(0.05);
            expect(run.yaw, where).toBeLessThan(0.35);
            expect(Math.abs(run.heading), where).toBeLessThan(0.15);
          }
    });
});

test("jumps come out the same for a seed and every world gets some", () => {
  const a = generate(11);
  const b = generate(11);
  expect(a.ramps).toEqual(b.ramps);
  expect(a.challenges).toEqual(b.challenges);
  expect(a.items).toEqual(b.items);
  expect(a.ramps.length).toBeGreaterThan(2);
  expect(a.ramps.some((r) => r.road)).toBe(true);
  expect(a.items.some((i) => i.light) && a.items.some((i) => !i.light)).toBe(true);
}, 30_000);

test("the lobby circuit gets as many road kickers as a typical seed", () => {
  // The switchback takes a stretch of the lap, so a typical seed now gets 1-2 road kickers.
  expect(generate(seed_of("lobby")).ramps.filter((r) => r.road).length).toBeGreaterThanOrEqual(2);
}, 30_000);

test("no checkpoint, junction or spawn sits in a road kicker's run-out", () => {
  for (let seed = 0; seed < 100; seed++) {
    const world = generate(seed);
    const { road } = world;
    const gates = [...world.checkpoints, ...world.graph.nodes.filter((n) => n.kind === "junction"), road[(SPAWN_INDEX + road.length) % road.length]];
    for (const r of world.ramps.filter((r) => r.road)) {
      const end = face_end(r) + r.landing;
      for (const g of gates) {
        const [u, v] = ramp_local(r, g.x, g.z);
        if (Math.abs(u) < RUN_DRIFT + GATE_CLEAR && v > end) expect(v - end).toBeGreaterThan(GATE_RUNOUT + GATE_CLEAR / 2);
      }
    }
  }
}, 120_000);
