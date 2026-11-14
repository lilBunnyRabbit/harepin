import { describe, expect, test } from "bun:test";
import { FLAT, lift_off, power_on, step_steer, trail_brake } from "../../scripts/bench/feel-cases";
import { Car, drop_height, SteerMode, type Controls, type Ground } from "../car/car";
import { CARS, type CarSpec } from "../car/cars";
import type { LabLane } from "../worldgen/lab";
import { Recorder } from "./recorder";

// Each metric is pinned to its headless twin (plan feel-lab-v2 11): the test drives the scenario's own inputs into a
// recorder and reads the same number the scenario prints. A gap over 10% is a bug in one of them.
const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };
const open: LabLane = { name: "asphalt", surface: "asphalt", spawn: { x: 0, z: 0, heading: 0 } };
const SPEC: CarSpec = CARS.coupe;
const rig = { spec: SPEC, mode: SteerMode.SMOOTH, ground: FLAT };

const kmh = (car: Car) => car.forward_speed * 3.6;
const cruise = (car: Car, target: number, extra: Partial<Controls> = {}): Controls => ({ ...idle, ...extra, throttle: Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3)) });

function fresh(setup?: (car: Car) => void, ground: Ground = FLAT): Car {
  const car = new Car(SPEC);
  car.steer_mode = SteerMode.SMOOTH;
  setup?.(car);
  car.place(0, drop_height(SPEC, 0.6), 0, 0);
  for (let t = 0; t < 1.5; t += DT) car.step(DT, idle, ground);
  return car;
}

function drive(car: Car, rec: Recorder, seconds: number, controls: (t: number) => Controls, ground: Ground = FLAT) {
  for (let t = 0; t < seconds; t += DT) {
    const input = controls(t);
    car.step(DT, input, ground);
    rec.step(DT, car, input);
  }
}

function recorded(lane: LabLane = open): { car: Car; rec: Recorder } {
  const car = fresh();
  const rec = new Recorder(lane, { kind: "free" });
  rec.placed(car);
  return { car, rec };
}

const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.abs(want) * 0.1 + 1e-6);

describe("trait metrics against the headless scenarios", () => {
  test("lift: feel's lift-off mid corner, assists on", () => {
    const car = fresh((c) => Object.assign(c, { assist: true, stability: true }));
    const rec = new Recorder(open, { kind: "free" });
    rec.placed(car);
    drive(car, rec, 30, () => cruise(car, 90));
    drive(car, rec, 2.5, () => cruise(car, 90, { steer: 0.8 }));
    drive(car, rec, 2, () => ({ ...idle, steer: 0.8 }));
    near(rec.metrics().lift_slip, lift_off(rig, true));
  });

  test("pwr: feel's power on mid corner in 2nd, TCS off", () => {
    const car = fresh((c) => Object.assign(c, { tcs: false, auto: false }));
    car.gear = 2;
    const rec = new Recorder(open, { kind: "free" });
    rec.placed(car);
    drive(car, rec, 30, () => cruise(car, 55));
    drive(car, rec, 1.5, () => cruise(car, 55, { steer: 0.7 }));
    drive(car, rec, 2, () => ({ ...idle, throttle: 1, steer: 0.7 }));
    near(rec.metrics().power_slip, power_on(rig, false).slip);
  });

  test("trail: feel's trail brake from 120", () => {
    const { car, rec } = recorded();
    drive(car, rec, 30, () => cruise(car, 120));
    let stopped = false;
    drive(car, rec, 4, () => {
      stopped ||= kmh(car) < 1;
      return stopped ? idle : { ...idle, brake: 1, steer: 0.4 };
    });
    near(rec.metrics().trail_slip, trail_brake(rig).slip);
  });

  test("yawover: feel's step steer overshoot at 100", () => {
    const { car, rec } = recorded();
    drive(car, rec, 30, () => cruise(car, 100));
    drive(car, rec, 3, () => cruise(car, 100, { steer: 1 }));
    expect(Math.abs(rec.metrics().yaw_over - step_steer(rig).overshoot)).toBeLessThan(0.05);
  });

  test("us: near 1 at walking pace, where the car turns on its kinematic radius", () => {
    const car = fresh();
    const spin_up = new Recorder(open, { kind: "free" });
    drive(car, spin_up, 8, () => cruise(car, 22, { steer: 0.3 }));
    const radius = car.vel.length() / Math.abs(car.ang.y);
    const rec = new Recorder({ ...open, ring: { x: 0, z: 0, radius, band: 1e9 } }, { kind: "free" });
    rec.placed(car);
    drive(car, rec, 3, () => cruise(car, 22, { steer: 0.3 }));
    const us = rec.metrics().understeer;
    expect(us).toBeGreaterThan(0.9);
    expect(us).toBeLessThan(1.15);
  });

  test("bdev: a straight ABS stop holds its heading", () => {
    const { car, rec } = recorded();
    drive(car, rec, 30, () => cruise(car, 100));
    drive(car, rec, 6, () => ({ ...idle, brake: 1 }));
    const m = rec.metrics();
    expect(m.brake_dev).toBeGreaterThanOrEqual(0);
    expect(m.brake_dev).toBeLessThan(0.5);
  });

  test("xslip: a sealed-to-loose seam is seen, and a straight run across it stays straight", () => {
    const seam: Ground = { ...FLAT, loose: (_x, z) => (z > 40 ? 1 : 0) };
    const car = fresh(undefined, seam);
    const rec = new Recorder(open, { kind: "free" });
    rec.placed(car);
    drive(car, rec, 8, () => ({ ...idle, throttle: 1 }), seam);
    const m = rec.metrics();
    expect(car.pos.z).toBeGreaterThan(40);
    expect(m.seam_slip).toBeGreaterThanOrEqual(0);
    expect(m.seam_slip).toBeLessThan(2);
  });

  test("pitch: a drop onto flat ground records a touchdown", () => {
    const car = new Car(SPEC);
    car.place(0, 2.5, 0, 0);
    const rec = new Recorder(open, { kind: "free" });
    rec.placed(car);
    drive(car, rec, 2, () => ({ ...idle, throttle: 0.01 }));
    const m = rec.metrics();
    expect(m.air).toBeGreaterThan(0.2);
    expect(Number.isFinite(m.land_pitch)).toBe(true);
  });
});

describe("trait metrics on set states", () => {
  // Heading 0 drives +z: a velocity swung by `a` off the nose is `a` of body slip.
  function slide(rec: Recorder, car: Car, seconds: number, slip_at: (t: number) => number, speed = 10, yaw: (t: number) => number = () => 0) {
    for (let t = 0; t < seconds; t += DT) {
      const a = slip_at(t);
      car.pos.set(0, 0.5, 0);
      car.vel.set(-speed * Math.sin(a), 0, speed * Math.cos(a));
      car.quat.identity();
      car.ang.set(0, yaw(t), 0);
      rec.step(DT, car, { ...idle, throttle: 0.5 });
    }
  }

  test("entry: seconds from 10 to 25 degrees of slip", () => {
    const car = new Car(SPEC);
    const rec = new Recorder(open, { kind: "free" });
    rec.placed(car);
    slide(rec, car, 1.5, (t) => (Math.min(t, 1) * 30 * Math.PI) / 180);
    expect(rec.metrics().entry).toBeCloseTo(0.5, 2);
  });

  test("yawsd: yaw-rate RMS only above 200 km/h", () => {
    const car = new Car(SPEC);
    const rec = new Recorder(open, { kind: "free" });
    rec.placed(car);
    slide(rec, car, 2, () => 0, 150 / 3.6, () => 0.5);
    slide(rec, car, 4, () => 0, 250 / 3.6, (t) => 0.1 * Math.sin(2 * Math.PI * t));
    const m = rec.metrics();
    expect(m.yaw_sd).toBeCloseTo(0.1 / Math.SQRT2, 3);
    expect(m.steer_sd).toBe(0);
  });
});
