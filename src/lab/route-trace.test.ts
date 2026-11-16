import { describe, expect, test } from "bun:test";
import { Car, type Controls } from "../car/car";
import { CARS } from "../car/cars";
import { RouteTrace } from "./route-trace";

const N = 200;
const R = 60;
const ring = Array.from({ length: N }, (_, i) => ({ x: R * Math.cos((2 * Math.PI * i) / N), z: R * Math.sin((2 * Math.PI * i) / N) }));
const input: Controls = { steer: 0.1, throttle: 1, brake: 0, handbrake: 0, analog: true };
const DT = 1 / 360;

function lap_drive(trace: RouteTrace, car: Car, from: number, to: number, t0: number): { t: number; laps: number } {
  let laps = 0;
  let t = t0;
  for (let a = from; a < to; a += 0.002) {
    t += DT;
    car.pos.set(R * Math.cos(a), 0, R * Math.sin(a));
    car.vel.set(-Math.sin(a) * 20, 0, Math.cos(a) * 20);
    if (trace.step(t, car, input, 0.05)) laps++;
  }
  return { t, laps };
}

describe("route trace", () => {
  test("counts a lap at each first pass of the start and samples every route point", () => {
    const trace = new RouteTrace(ring);
    const car = new Car(CARS.coupe);
    trace.placed(0, false);
    const { laps } = lap_drive(trace, car, 0, 2.5 * 2 * Math.PI, 0);
    expect(laps).toBe(2);
    expect(trace.samples).toBeGreaterThanOrEqual(2.5 * N);
    const lines = trace.lines();
    expect(lines[0]).toBe(` trace ${trace.samples} ${N}`);
    expect(lines[1].split(" ").slice(1)).toHaveLength(10);
  });

  test("a rewind back over the start never counts the lap twice, and the placement is kept", () => {
    const trace = new RouteTrace(ring);
    const car = new Car(CARS.coupe);
    trace.placed(0, false);
    const first = lap_drive(trace, car, 0, 2 * Math.PI + 0.3, 0);
    expect(first.laps).toBe(1);
    trace.placed(first.t, true);
    const again = lap_drive(trace, car, 2 * Math.PI - 0.3, 2 * Math.PI + 0.5, first.t);
    expect(again.laps).toBe(0);
    expect(trace.lines().at(-1)).toBe(` r ${first.t.toFixed(3)}`);
  });
});
