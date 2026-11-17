/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car, drop_height, type Controls } from "./car";
import { DEFAULT_BUILD, apply_build } from "./build";
import { CARS, COUPE, type CarId, type CarSpec } from "./cars";
import { LIMITER_GAP, ShiftMode, downshift_rpm, shift_band, torque_peak, upshift_rpm } from "./shift-mode";
import { FLAT } from "../../scripts/bench/feel-cases";

const DT = 1 / 360;
const IDLE: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const FULL: Controls = { ...IDLE, throttle: 1 };

function launch(mode: ShiftMode): { t100: number; first_upshift: number } {
  const car = new Car(COUPE);
  car.shift_mode = mode;
  car.place(0, drop_height(COUPE, 0.6), 0, 0);
  for (let t = 0; t < 2; t += DT) car.step(DT, IDLE, FLAT);
  let t100 = NaN;
  let first_upshift = NaN;
  let rpm = car.rpm;
  for (let t = 0; t < 12 && (Number.isNaN(t100) || Number.isNaN(first_upshift)); t += DT) {
    car.step(DT, FULL, FLAT);
    if (Number.isNaN(first_upshift) && car.gear === 2) first_upshift = rpm;
    if (Number.isNaN(t100) && car.forward_speed * 3.6 >= 100) t100 = t;
    rpm = car.rpm;
  }
  return { t100, first_upshift };
}

describe("auto gearbox modes", () => {
  const band = shift_band(COUPE);

  test("the coupe's band runs from its torque peak to its redline", () => {
    expect(torque_peak(COUPE.torque)).toBe(4500);
    expect(band).toBe(2800);
  });

  test("Normal keeps the car's own points", () => {
    expect(upshift_rpm(COUPE, band, ShiftMode.NORMAL)).toBe(COUPE.upshift);
    expect(downshift_rpm(COUPE, band, ShiftMode.NORMAL, 0)).toBe(COUPE.downshift);
    expect(downshift_rpm(COUPE, band, ShiftMode.NORMAL, 1)).toBe(COUPE.downshift);
  });

  test("the coupe's points per mode", () => {
    const points = (mode: ShiftMode) => [upshift_rpm(COUPE, band, mode), downshift_rpm(COUPE, band, mode, 0), downshift_rpm(COUPE, band, mode, 1)].map(Math.round);
    expect(points(ShiftMode.SPORT)).toEqual([7050, 3700, 3700]);
    expect(points(ShiftMode.NORMAL)).toEqual([6900, 3000, 3000]);
    expect(points(ShiftMode.ECO)).toEqual([5220, 2580, 3000]);
  });

  test("no mode upshifts past the limiter gap, on any car or engine", () => {
    for (const [car, spec] of Object.entries(CARS) as [CarId, CarSpec][]) {
      for (const engine of [0, 5]) {
        const built = apply_build(spec, { ...DEFAULT_BUILD, car, parts: { ...DEFAULT_BUILD.parts, engine } });
        const b = shift_band(built);
        for (const mode of Object.values(ShiftMode)) {
          const up = upshift_rpm(built, b, mode);
          expect(up).toBeLessThanOrEqual(built.redline - LIMITER_GAP);
          expect(up).toBeGreaterThan(downshift_rpm(built, b, mode, 1));
        }
      }
    }
  });

  test("Sport launches at least as quick and Eco shifts lower", () => {
    const sport = launch(ShiftMode.SPORT);
    const normal = launch(ShiftMode.NORMAL);
    const eco = launch(ShiftMode.ECO);
    expect(sport.t100).toBeLessThanOrEqual(normal.t100);
    expect(sport.first_upshift).toBeGreaterThan(normal.first_upshift);
    expect(eco.first_upshift).toBeLessThan(normal.first_upshift - 1000);
  });
});
