/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { Car, type Controls, type Ground } from "./car";
import { BUS, COUPE } from "./cars";
import { collide_cars } from "./contact";
import type { Collider } from "../world/world";

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const DT = 1 / 360;
const go: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: 0, analog: true };

function body(spec: Collider["spec"], x: number, z: number, heading: number, vx: number, vz: number, yaw = 0): Collider {
  return { pos: new Vector3(x, 0.5, z), vel: new Vector3(vx, 0, vz), ang: new Vector3(0, yaw, 0), heading, spec };
}

function momentum(field: readonly Collider[]) {
  let px = 0, pz = 0, l = 0;
  for (const c of field) {
    px += c.spec.mass * c.vel.x;
    pz += c.spec.mass * c.vel.z;
    l += c.spec.mass * (c.pos.z * c.vel.x - c.pos.x * c.vel.z) + c.spec.inertia[1] * c.ang.y;
  }
  return { px, pz, l };
}

function state(car: Car): number[] {
  return [...car.pos.toArray(), ...car.vel.toArray(), ...car.ang.toArray(), ...car.quat.toArray()];
}

function pair_with_old_velocities(field: Collider[], before: Collider[]) {
  return field.map((c, i) => ({ ...c, vel: before[i].vel, ang: before[i].ang }));
}

describe("car contact", () => {
  test("cars apart are never touched: stepping with the pass is bit-identical to stepping without", () => {
    const drive = (pass: boolean) => {
      const field = [new Car(COUPE), new Car(COUPE)];
      field[0].place(0, 0.6, 0, 0);
      field[1].place(10, 0.6, 0, 0);
      const impacts = new Float64Array(2);
      for (let s = 0; s < 1800; s++) {
        for (const car of field) car.step(DT, go, flat);
        if (pass) expect(collide_cars(field, impacts)).toBe(0);
      }
      return field.flatMap(state);
    };
    expect(drive(true)).toEqual(drive(false));
  });

  test("a field of one car is left alone", () => {
    const one = body(COUPE, 0, 0, 0, 3, 4, 0.2);
    const impacts = new Float64Array(1);
    expect(collide_cars([one], impacts)).toBe(0);
    expect([...one.pos.toArray(), ...one.vel.toArray(), ...one.ang.toArray()]).toEqual([0, 0.5, 0, 3, 0, 4, 0, 0.2, 0]);
  });

  for (const [name, a, b] of [
    ["head-on", body(COUPE, 0, 0, 0, 0, 10), body(COUPE, 0, 4.5, Math.PI, 0, -10)],
    ["T-bone", body(COUPE, 0, 0, 0, 0, 15), body(BUS, 0.4, 3.2, Math.PI / 2, 0, 0)],
    ["side-swipe", body(COUPE, 0, 0, 0, 1, 30, 0.3), body(COUPE, 2, 1, 0.1, -1, 25)],
  ] as const)
    test(`${name}: momentum and angular momentum hold through the impulse, and the pair parts`, () => {
      const field = [a, b];
      const before = field.map((c) => ({ ...c, vel: c.vel.clone(), ang: c.ang.clone() }));
      const impacts = new Float64Array(2);
      expect(collide_cars(field, impacts)).toBe(1);
      expect(impacts[0]).toBeGreaterThan(0);
      expect(impacts[0]).toBe(impacts[1]);
      const was = momentum(pair_with_old_velocities(field, before));
      const now = momentum(field);
      const scale = Math.abs(was.px) + Math.abs(was.pz) + COUPE.mass;
      expect(Math.abs(now.px - was.px) / scale).toBeLessThan(1e-12);
      expect(Math.abs(now.pz - was.pz) / scale).toBeLessThan(1e-12);
      expect(Math.abs(now.l - was.l) / (Math.abs(was.l) + scale)).toBeLessThan(1e-12);
      const again = new Float64Array(2);
      collide_cars(field, again);
      expect(again[0]).toBe(0);
    });

  test("a car above the other's body passes over it", () => {
    const low = body(COUPE, 0, 0, 0, 0, 10);
    const high = body(COUPE, 0, 2, 0, 0, 0);
    high.pos.y = 4;
    expect(collide_cars([low, high], new Float64Array(2))).toBe(0);
  });

  test("two cars driven into each other: the hit holds momentum and pushes them apart", () => {
    const field = [new Car(COUPE), new Car(COUPE)];
    field[0].place(0, 0.6, 0, 0);
    field[1].place(0, 0.6, 30, Math.PI);
    const impacts = new Float64Array(2);
    let hits = 0;
    for (let s = 0; s < 3600 && hits === 0; s++) {
      for (const car of field) car.step(DT, go, flat);
      const before = field.map((c) => ({ pos: c.pos, vel: c.vel.clone(), ang: c.ang.clone(), heading: c.heading, spec: c.spec }));
      if (collide_cars(field, impacts) === 0) continue;
      hits++;
      const was = momentum(before);
      const now = momentum(field);
      expect(Math.abs(now.pz - was.pz)).toBeLessThan(1e-9 * COUPE.mass);
      expect(Math.abs(now.l - was.l)).toBeLessThan(1e-6 * COUPE.mass);
      expect(impacts[0]).toBeGreaterThan(5);
    }
    expect(hits).toBe(1);
    expect(field[0].vel.z).toBeLessThan(0);
    expect(field[1].vel.z).toBeGreaterThan(0);
  });
});
