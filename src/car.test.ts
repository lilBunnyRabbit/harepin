/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car, SteerMode, ride_height, type Controls, type Ground } from "./car";
import { CARS } from "./cars";

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };

function fresh(mode: SteerMode): Car {
  const car = new Car();
  car.steer_mode = mode;
  car.place(0, 0.6, 0, 0);
  run(car, 1.5, () => idle);
  return car;
}

function run(car: Car, seconds: number, controls: () => Controls) {
  for (let t = 0; t < seconds; t += DT) car.step(DT, controls(), flat);
}

const kmh = (car: Car) => car.forward_speed * 3.6;
const cruise = (car: Car, target: number, steer = 0): Controls => ({ ...idle, steer, throttle: Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3)) });

describe("keyboard steer mode", () => {
  test("snap: released at a standstill, the wheel springs back to centre", () => {
    const car = fresh(SteerMode.SNAP);
    run(car, 1, () => ({ ...idle, steer: 1 }));
    expect(car.steer).toBeCloseTo(car.spec.lock, 3);
    run(car, 0.5, () => idle);
    expect(Math.abs(car.steer)).toBeLessThan(1e-3);
  });

  test("hold: released at a standstill, the wheel stays put", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 1, () => ({ ...idle, steer: -1 }));
    expect(car.steer).toBeCloseTo(-car.spec.lock, 3);
    run(car, 3, () => idle);
    expect(car.steer).toBeCloseTo(-car.spec.lock, 3);
  });

  test("hold: a key moves the wheel at a rate, a short tap only part way", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 0.1, () => ({ ...idle, steer: 1 }));
    run(car, 1, () => idle);
    expect(car.key_steer).toBeGreaterThan(0.2);
    expect(car.key_steer).toBeLessThan(0.3);
  });

  test("hold: rolling at parking speed barely centres it", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 1, () => ({ ...idle, steer: 1 }));
    run(car, 1, () => ({ ...idle, throttle: Math.max(0, Math.min(1, 0.08 + (2 - kmh(car)) * 0.3)) }));
    expect(car.key_steer).toBeGreaterThan(0.95);
  });

  test("hold: released at 100 km/h, the wheel centres within 0.6 s", () => {
    const car = fresh(SteerMode.HOLD);
    run(car, 30, () => cruise(car, 100));
    run(car, 0.5, () => cruise(car, 100, 1));
    const held = car.steer;
    expect(held).toBeGreaterThan(0.05);
    run(car, 0.6, () => cruise(car, 100));
    expect(car.key_steer).toBe(0);
    expect(Math.abs(car.steer)).toBeLessThan(held * 0.1);
  });

  test("analog input steers the same in both modes", () => {
    const pad = (car: Car): Controls => ({ ...cruise(car, 60, Math.sin(car.pos.z * 0.05)), analog: true });
    const [snap, hold] = [fresh(SteerMode.SNAP), fresh(SteerMode.HOLD)];
    run(snap, 8, () => pad(snap));
    run(hold, 8, () => pad(hold));
    expect(hold.steer).toBe(snap.steer);
    expect(hold.pos.toArray()).toEqual(snap.pos.toArray());
  });
});

describe("garage swap", () => {
  const hill: Ground = { ...flat, height: (x, z) => 3 + 0.1 * x - 0.05 * z };

  test("20 swaps leave each car on the ground at its ride height, not stacked", () => {
    const specs = Object.values(CARS);
    let car = new Car(specs[0]);
    car.place(4, 10, -6, 0.7);
    const first = new Map<number, number>();
    for (let i = 0; i < 20; i++) {
      const prev = car;
      const index = (i + 1) % specs.length;
      car = new Car(specs[index]);
      car.park(prev.pos.x, prev.pos.z, prev.heading, hill);
      expect(car.pos.y).toBeCloseTo(hill.height(car.pos.x, car.pos.z) + ride_height(car.spec), 6);
      expect(car.heading).toBeCloseTo(0.7, 6);
      expect(car.vel.length()).toBe(0);
      const y = first.get(index) ?? car.pos.y;
      first.set(index, y);
      expect(Math.abs(car.pos.y - y)).toBeLessThan(0.02);
    }
  });

  test("a parked car neither drops nor lifts once the sim runs", () => {
    for (const spec of Object.values(CARS)) {
      const car = new Car(spec);
      car.park(0, 0, 0, flat);
      const parked = car.pos.y;
      run(car, 2, () => idle);
      expect(Math.abs(car.pos.y - parked)).toBeLessThan(0.02);
    }
  });
});

describe("grass drag", () => {
  const grass: Ground = { ...flat, grip: () => 0.72, roll: () => 12 };

  test("flat out in a straight line, no car yaws away or loses speed", () => {
    for (const spec of Object.values(CARS)) {
      const car = new Car(spec);
      car.place(0, 0.6, 0, 0);
      run(car, 1.5, () => idle);
      let peak = 0;
      for (let t = 0; t < 40; t += DT) {
        if (Math.abs(t - 20) < DT / 2) car.ang.y += 0.03;
        car.step(DT, { ...idle, throttle: 1, analog: true }, grass);
        peak = Math.max(peak, kmh(car));
      }
      expect(Math.abs(car.heading)).toBeLessThan(0.05);
      expect(kmh(car)).toBeGreaterThan(peak - 2);
    }
  });
});
