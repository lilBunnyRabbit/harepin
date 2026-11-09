/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { Car, type Ground } from "../car";
import { CARS } from "../cars";
import { generate } from "./index";
import { apex, flight, ramp_surface } from "./jumps";
import type { Ramp } from "./types";

const DT = 1 / 360;
const KICKER: Ramp = { id: 0, kind: "kicker", x: 0, y: 0, z: 0, fx: 0, fz: 1, hw: 2.6, length: 8, rise: 2, grade: 0, landing: 45, speed: 21 };
const BIG: Ramp = { ...KICKER, kind: "big", hw: 3.2, length: 14, rise: 4, landing: 80, speed: 27 };

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
}

function jump(r: Ramp, car: Car, speed: number): Jump {
  const ground = ground_with(r);
  const challenge = r.length + apex(r) * 0.85;
  const up = new Vector3();
  const out: Jump = { toe: 0, at_challenge: NaN, sink: 0, upright: 1, air: 0 };
  car.place(0, 1, -60, 0);
  car.vel.set(0, 0, speed);
  let last = car.pos.z;
  for (let i = 0; i < 360 * 8; i++) {
    const throttle = car.pos.z < 0 ? Math.max(0, Math.min(1, (speed - car.forward_speed) * 0.5 + 0.3)) : 0;
    car.step(DT, { steer: 0, throttle, brake: 0, handbrake: 0, analog: false }, ground);
    if (last < 0 && car.pos.z >= 0) out.toe = car.forward_speed;
    if (last < challenge && car.pos.z >= challenge) out.at_challenge = car.pos.y;
    if (car.pos.z > r.length && car.wheels.every((w) => !w.contact)) out.air += DT;
    out.sink = Math.max(out.sink, ground.height(car.pos.x, car.pos.z) - car.pos.y);
    out.upright = Math.min(out.upright, up.set(0, 1, 0).applyQuaternion(car.quat).y);
    last = car.pos.z;
  }
  return out;
}

describe("ramps at 360 Hz", () => {
  for (const r of [KICKER, BIG])
    for (const [id, spec] of Object.entries(CARS))
      test(`${r.kind}, ${id}: flies the predicted line and lands on its wheels`, () => {
        for (const offset of [-2, 0, 2]) {
          const run = jump(r, new Car(spec), r.speed + offset);
          expect(run.air).toBeGreaterThan(0.8);
          expect(Math.abs(run.at_challenge - flight(r, run.toe, apex(r) * 0.85))).toBeLessThan(0.4);
          expect(run.sink).toBeLessThan(0.05);
          expect(run.upright).toBeGreaterThan(0.75);
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
  expect(a.items.some((i) => i.light) && a.items.some((i) => !i.light)).toBe(true);
}, 30_000);
