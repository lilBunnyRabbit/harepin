/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { DEFAULT_BUILD, build_spec } from "./build";
import { Car, SteerMode, type Controls, type Ground } from "./car";
import { DEFAULT_SETTINGS } from "../menu/prefs";

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const DT = 1 / 360;
const FRAME_STEPS = 6;
const tmp = new Vector3();

// Mirrors main.ts apply_car_settings and Input.read for keys; Input itself needs a DOM.
function fresh_player(): Car {
  const car = new Car(build_spec(DEFAULT_BUILD));
  const { tcs, abs, assist, auto, steer_mode } = DEFAULT_SETTINGS;
  Object.assign(car, { tcs, abs, assist, auto, steer_mode });
  car.place(0, 0.75, 0, 0);
  return car;
}

const keys = (held: { w?: boolean; s?: boolean; a?: boolean; d?: boolean; space?: boolean }): Controls => ({
  steer: (held.d ? 1 : 0) - (held.a ? 1 : 0),
  throttle: held.w ? 1 : 0,
  brake: held.s ? 1 : 0,
  handbrake: held.space ? 1 : 0,
  analog: false,
  nitro: false,
});

function drive(car: Car, seconds: number, controls: Controls) {
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) for (let i = 0; i < FRAME_STEPS; i++) car.step(DT, controls, flat);
}

const slip_deg = (car: Car) => {
  tmp.copy(car.vel).applyQuaternion(car.quat.clone().invert());
  return (Math.atan2(-tmp.x, tmp.z) * 180) / Math.PI;
};

describe("fresh player on the keyboard", () => {
  test("gets the stock coupe, every aid on and Classic steering", () => {
    expect(DEFAULT_BUILD.car).toBe("coupe");
    expect(DEFAULT_SETTINGS).toMatchObject({ tcs: true, abs: true, assist: true, auto: true, steer_mode: SteerMode.SNAP, precision_key: false });
  });

  // Pinned from the 0.10.0 - 0.13.1 replays, which all match: a change here changes how the game feels on a first drive.
  test("holding D at speed turns inside the grip and lets go cleanly", () => {
    const car = fresh_player();
    drive(car, 1.5, keys({}));
    drive(car, 4, keys({ w: true }));
    expect(car.forward_speed * 3.6).toBeCloseTo(79.1, 0);
    drive(car, 0.5, keys({ w: true, d: true }));
    expect(car.key_steer).toBe(1);
    expect(car.steer).toBeCloseTo(0.092, 2);
    drive(car, 1.5, keys({ w: true, d: true }));
    expect(Math.abs(slip_deg(car))).toBeLessThan(4);
    drive(car, 0.5, keys({ w: true }));
    expect(car.steer).toBe(0);
    expect(Math.abs(slip_deg(car))).toBeLessThan(2);
  });

  test("a handbrake flick at speed is caught, not spun", () => {
    const car = fresh_player();
    drive(car, 1.5, keys({}));
    drive(car, 8, keys({ w: true }));
    drive(car, 0.7, keys({ w: true, d: true, space: true }));
    drive(car, 0.8, keys({ w: true, d: true }));
    drive(car, 2, keys({ w: true }));
    expect(Math.abs(slip_deg(car))).toBeLessThan(2);
    expect(Math.abs(car.ang.y)).toBeLessThan(0.05);
  });
});
