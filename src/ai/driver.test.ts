/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car, drop_height, type Controls, type Ground } from "../car/car";
import { COUPE } from "../car/cars";
import { World } from "../world/world";
import { RouteKind } from "../worldgen/types";
import { Driver, pass_room } from "./driver";
import { race_line } from "./line";
import { ring } from "./test-road";

const DT = 1 / 360;
const STEPS = 360 * 30;
const FLAT: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };

function pose(car: Car): number[] {
  return [car.pos.x, car.pos.y, car.pos.z, car.vel.x, car.vel.y, car.vel.z, car.quat.x, car.quat.y, car.quat.z, car.quat.w, car.ang.x, car.ang.y, car.ang.z];
}

describe("AI driver", () => {
  test("a lone AI car is only an input: its recorded controls replayed on a fresh car end bit-identical", () => {
    const world = new World(0);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error("island seed 0 has no circuit");
    const unplace = world.place(route.closure);
    const start = route.points[0];
    const put = (car: Car) => car.place(start.x, world.height(start.x, start.z) + drop_height(COUPE, 0.75), start.z, Math.atan2(start.tx, start.tz));
    const driver = new Driver(race_line(route.points, world.ramps, COUPE.radius));
    const ai = new Car(COUPE);
    put(ai);
    const tape: Controls[] = [];
    const poses: number[][] = [];
    for (let s = 0; s < STEPS; s++) {
      const c = driver.drive(ai, DT);
      tape.push({ ...c });
      ai.step(DT, c, world);
      world.collide(ai);
      if (s % 360 === 359) poses.push(pose(ai));
    }
    const replay = new Car(COUPE);
    put(replay);
    const again: number[][] = [];
    for (let s = 0; s < STEPS; s++) {
      replay.step(DT, tape[s], world);
      world.collide(replay);
      if (s % 360 === 359) again.push(pose(replay));
    }
    unplace();
    expect(driver.progress).toBeGreaterThan(100);
    expect(again).toEqual(poses);
  });

  test("on a kicker run it never targets over the line, whatever its pace, push or margin", () => {
    const world = new World(44);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error("island seed 44 has no circuit");
    const line = race_line(route.points, world.ramps, COUPE.radius);
    const at = line.ramp.findIndex((r) => r >= 0);
    expect(at).toBeGreaterThanOrEqual(0);
    const driver = new Driver(line, { pace: 1.1, brake_margin: 1.5, aggression: 1, mistakes: 0 });
    driver.push = 1.2;
    driver.place(at);
    const car = new Car(COUPE);
    const p = route.points[at];
    car.place(p.x, world.height(p.x, p.z) + drop_height(COUPE, 0.75), p.z, Math.atan2(p.tx, p.tz));
    driver.drive(car, DT);
    expect(driver.target).toBeLessThanOrEqual(line.speed[driver.index]);
  });

  /** A driver placed at road point `at` of seed 44's circuit, its car parked there, after one step. */
  function placed(at: (line: ReturnType<typeof race_line>) => number, pace: number, cap = Infinity, ahead_speed = Infinity) {
    const world = new World(44);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error("island seed 44 has no circuit");
    const line = race_line(route.points, world.ramps, COUPE.radius);
    const driver = new Driver(line, { pace, brake_margin: 1.5, aggression: 1, mistakes: 0, grip: 0.9 });
    driver.push = 1.2;
    driver.cap = cap;
    driver.ahead_speed = ahead_speed;
    driver.place(at(line));
    const car = new Car(COUPE);
    const p = route.points[driver.index];
    car.place(p.x, world.height(p.x, p.z) + drop_height(COUPE, 0.75), p.z, Math.atan2(p.tx, p.tz));
    driver.drive(car, DT);
    return { driver, line };
  }

  test("pace, push and margin never take a bend over its grip: the target holds under the corner speeds braked at late_brake", () => {
    const tightest = (line: ReturnType<typeof race_line>) => line.bend.reduce((best, b, i) => (Math.abs(b) > Math.abs(line.bend[best]) && line.ramp[i] < 0 ? i : best), 0);
    const { driver, line } = placed(tightest, 1.1);
    expect(driver.target).toBeLessThanOrEqual(line.late[driver.index] * 0.9 + 1e-9);
    expect(line.speed[driver.index] * 1.1 * 1.2).toBeGreaterThan(line.late[driver.index] * 0.9);
  });

  test("on a kicker's pinned run a moving car ahead never holds it under the speed that clears the lip; a stopped one does", () => {
    const pinned = (l: ReturnType<typeof race_line>) => l.ramp.findIndex((r, i) => r >= 0 && l.room[i] === 0);
    // Tucked up behind a car making 16 m/s, the follow cap drops to 3: the floor still holds.
    const { driver, line } = placed(pinned, 1, 3, 16);
    expect(driver.target).toBeGreaterThanOrEqual(Math.min(20, line.speed[driver.index]));
    expect(placed(pinned, 1, 3, 2).driver.target).toBe(3);
  });

  /** A driver on a wide ring road with its car `side` m off the line at `speed` m/s, turned `yaw` rad off the road, holding `aside` m off the line, after one step. */
  function on_ring(side: number, speed: number, yaw: number, aside = 0) {
    const line = race_line(ring(800), [], COUPE.radius);
    const driver = new Driver(line);
    driver.place(100);
    driver.aside = aside;
    const car = new Car(COUPE);
    const p = line.road[100];
    const heading = Math.atan2(p.tx, p.tz);
    car.park(p.x + p.tz * side, p.z - p.tx * side, heading + yaw, FLAT);
    car.step(DT, { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true }, FLAT);
    car.vel.set(Math.sin(heading + yaw) * speed, 0, Math.cos(heading + yaw) * speed);
    const controls = driver.drive(car, DT);
    return { driver, line, car, controls };
  }

  test("wide of its path and turned across the road, the arc back to its aim caps the speed it drives for", () => {
    const { driver, line } = on_ring(3, 20, 1);
    expect(driver.target).toBeLessThan(line.speed[driver.index] * 0.5);
    expect(on_ring(0, 20, 0).driver.target).toBeCloseTo(line.speed[driver.index], 6);
  });

  test("held off the line past the edge of its room, it aims back inside by as much as it is over, not along the edge", () => {
    const room = pass_room(new Car(COUPE), race_line(ring(800), [], COUPE.radius), 100);
    // Fast, so the aim is far ahead and the wheel stays off full lock; on the ring's outside, so its bend steers against.
    const over = on_ring(-room - 2, 60, 0, -room - 2).controls.steer;
    const edge = on_ring(-room, 60, 0, -room).controls.steer;
    const inward = Math.sign(on_ring(-room, 60, 0).controls.steer);
    expect(Math.sign(over)).toBe(inward);
    expect(over * inward).toBeGreaterThan(edge * inward + 0.4);
  });
});
