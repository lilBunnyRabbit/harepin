/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { DEFAULT_BUILD, DEFAULT_PARTS, build_spec, stats } from "./build";
import { Car, SteerMode, type Controls, type Ground } from "./car";
import { DEFAULT_SETTINGS } from "../menu/prefs";
import { swerve, tap } from "../../scripts/keys";

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
  test("gets the hatch with a wing, every aid on and Smooth steering", () => {
    expect(DEFAULT_BUILD).toMatchObject({ car: "hatch", parts: { ...DEFAULT_PARTS, aero: 2 } });
    expect(DEFAULT_SETTINGS).toMatchObject({ tcs: true, abs: true, assist: true, auto: true, steer_mode: SteerMode.SMOOTH, precision_key: false });
  });

  // Pinned from the hatch replays: a change here changes how the game feels on a first drive.
  test("holding D at speed turns inside the grip and lets go cleanly", () => {
    const car = fresh_player();
    drive(car, 1.5, keys({}));
    drive(car, 4, keys({ w: true }));
    expect(car.forward_speed * 3.6).toBeCloseTo(57.2, 0);
    drive(car, 0.5, keys({ w: true, d: true }));
    expect(car.key_steer).toBe(1);
    expect(car.steer).toBeCloseTo(0.124, 2);
    drive(car, 1.5, keys({ w: true, d: true }));
    expect(Math.abs(slip_deg(car))).toBeLessThan(2);
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

  test("lifting off mid corner keeps the line", () => {
    const car = fresh_player();
    drive(car, 1.5, keys({}));
    drive(car, 6, keys({ w: true }));
    drive(car, 2.5, keys({ w: true, d: true }));
    let worst = 0;
    for (let frame = 0; frame < 120; frame++) {
      drive(car, 1 / 60, keys({ d: true }));
      worst = Math.max(worst, Math.abs(slip_deg(car)));
    }
    expect(worst).toBeLessThan(6);
  });

  test("a key lane change at 100 km/h ends within 2 degrees of straight, and a 150 ms tap turns far more than a one-frame one", () => {
    const spec = build_spec(DEFAULT_BUILD);
    const { steer_mode } = DEFAULT_SETTINGS;
    expect(Math.abs(swerve(steer_mode, spec).heading)).toBeLessThan(2);
    const [short, long] = [tap(steer_mode, 1 / 60, 100, spec), tap(steer_mode, 0.15, 100, spec)];
    expect(long.heading / short.heading).toBeGreaterThan(20);
    expect(long.slip).toBeLessThan(2);
  });

  test("is well off the pace of the fast cars", () => {
    const car = fresh_player();
    drive(car, 1.5, keys({}));
    drive(car, 8, keys({ w: true }));
    expect(car.forward_speed * 3.6).toBeLessThan(100);
    const top = stats(build_spec(DEFAULT_BUILD)).top_speed;
    expect(top).toBeLessThan(0.75 * stats(build_spec({ ...DEFAULT_BUILD, car: "coupe" })).top_speed);
  });
});
