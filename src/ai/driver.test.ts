/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car, drop_height, type Controls } from "../car/car";
import { COUPE } from "../car/cars";
import { World } from "../world/world";
import { RouteKind } from "../worldgen/types";
import { Driver } from "./driver";
import { race_line } from "./line";

const DT = 1 / 360;
const STEPS = 360 * 30;

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
});
