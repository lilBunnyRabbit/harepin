import { describe, expect, test } from "bun:test";
import { Car, drop_height, type Controls, type Ground } from "../car/car";
import { CARS } from "../car/cars";
import type { LabLane } from "../worldgen/lab";
import { Recorder } from "./recorder";

const DT = 1 / 360;
const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const open: LabLane = { name: "asphalt", surface: "asphalt", spawn: { x: 0, z: 0, heading: 0 } };

function settled(): Car {
  const car = new Car(CARS.hatch);
  car.place(0, drop_height(CARS.hatch, 0.6), 0, 0);
  for (let t = 0; t < 1.5; t += DT) car.step(DT, idle, flat);
  return car;
}

describe("recorder", () => {
  test("0-100 and the stop match the telemetry script's way of timing them", () => {
    const car = settled();
    const rec = new Recorder(open, { kind: "stop", from_kmh: 100 });
    rec.placed(car);
    let t = 0;
    const go: Controls = { ...idle, throttle: 1 };
    while (car.forward_speed * 3.6 < 100) {
      car.step(DT, go, flat);
      rec.step(DT, car, go);
      t += DT;
    }
    const from = car.pos.z;
    const stop: Controls = { ...idle, brake: 1 };
    while (car.forward_speed * 3.6 > 0.5) {
      car.step(DT, stop, flat);
      rec.step(DT, car, stop);
    }
    const m = rec.metrics();
    expect(m.to_100).toBeCloseTo(t, 6);
    expect(m.stop_m).toBeCloseTo(car.pos.z - from, 0);
    expect(m.stop_from).toBeGreaterThanOrEqual(100);
    expect(m.top_kmh).toBeGreaterThanOrEqual(100);
    expect(rec.done).toBe(true);
    expect(m.throttle).toBeGreaterThan(0.3);
  });

  test("laps wind round the ring and lateral g is yaw rate times speed", () => {
    const car = settled();
    const r = 30;
    const v = 15;
    const lane: LabLane = { ...open, ring: { x: 0, z: 0, radius: r, band: 6 } };
    const rec = new Recorder(lane, { kind: "laps", laps: 2 });
    const yaw = v / r;
    const at = (a: number) => {
      car.pos.set(r * Math.cos(a), 0.5, r * Math.sin(a));
      car.vel.set(-v * Math.sin(a), 0, v * Math.cos(a));
      car.ang.set(0, yaw, 0);
      car.quat.setFromAxisAngle(car.ang.clone().normalize(), Math.atan2(-Math.sin(a), Math.cos(a)));
    };
    at(0);
    rec.placed(car);
    const lap = (2 * Math.PI * r) / v;
    for (let t = 0; t < 2.2 * lap; t += DT) {
      at((v * t) / r);
      rec.step(DT, car, { ...idle, throttle: 0.3 });
    }
    const m = rec.metrics();
    expect(m.laps.length).toBe(2);
    expect(m.laps[0]).toBeCloseTo(lap, 1);
    expect(m.lat_peak).toBeCloseTo((v * v) / (r * 9.81), 6);
    expect(m.ring_kmh).toBeCloseTo(v * 3.6, 6);
    expect(m.offs).toBe(0);
    expect(rec.done).toBe(true);
  });

  test("a gate pair times the segment and a lane path counts offs", () => {
    const car = settled();
    const lane: LabLane = { ...open, start: { x: 0, z: 10, fx: 0, fz: 1, hw: 5 }, finish: { x: 0, z: 50, fx: 0, fz: 1, hw: 5 }, path: { points: [[0, 0], [0, 100]], half: 5 } };
    const rec = new Recorder(lane, { kind: "run" });
    rec.placed(car);
    for (let t = 0; t < 10; t += DT) {
      car.pos.set(t < 6 ? 0 : 20, 0.5, 10 * t);
      car.vel.set(0, 0, 10);
      rec.step(DT, car, { ...idle, throttle: 1 });
    }
    const m = rec.metrics();
    expect(m.segment).toBeCloseTo(4, 1);
    expect(m.offs).toBe(1);
  });
});
