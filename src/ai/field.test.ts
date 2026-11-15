/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car } from "../car/car";
import { build_spec, parse_build } from "../car/build";
import { COUPE } from "../car/cars";
import { Awareness } from "./awareness";
import { World } from "../world/world";
import { RouteKind } from "../worldgen/types";
import { Field, grid_spot, grip_pace, personalities } from "./field";

describe("AI field personalities", () => {
  test("level 3 is the default field, and the levels move aggression and mistakes apart", () => {
    expect(personalities(7, 6, 3, 3)).toEqual(personalities(7, 6));
    const timid = personalities(7, 20, 1, 1);
    const bold = personalities(7, 20, 5, 5);
    for (const p of timid) {
      expect(p.aggression).toBeLessThanOrEqual(0.6);
      expect(p.mistakes).toBeLessThanOrEqual(0.1);
    }
    for (const p of bold) {
      expect(p.aggression).toBeGreaterThanOrEqual(0.6);
      expect(p.mistakes).toBeGreaterThanOrEqual(0.2);
    }
    expect(personalities(7, 6, 9, 0)).toEqual(personalities(7, 6, 5, 1));
  });
});

describe("AI field coasting", () => {
  const DT = 1 / 360;

  function field_on(seed: number) {
    const world = new World(seed);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error(`island seed ${seed} has no circuit`);
    world.place(route.closure);
    const field = new Field(world, route, Array.from({ length: 4 }, () => COUPE), personalities(seed, 4), seed);
    const rival = new Car(COUPE);
    const spot = grid_spot(route, 4);
    rival.park(spot.x, spot.z, spot.heading, world);
    field.rival = rival;
    return { field, rival, route, world };
  }

  test("cars far off screen coast on the line, keep lapping, and come back on the physics without a reset", () => {
    const { field, rival, world, route } = field_on(0);
    field.seen = 0;
    const held = { steer: 0, throttle: 0, brake: 1, handbrake: 0, analog: true };
    let coasted = 0;
    for (let s = 0; s < 360 * 60; s++) {
      rival.step(DT, held, world);
      field.step(DT, 1);
      if (s % 360 === 0) for (let i = 0; i < 4; i++) coasted += field.is_coasting(i) ? 1 : 0;
    }
    expect(coasted).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) expect(field.progress[i]).toBeGreaterThan(route.points.length * 0.3);
    expect(field.progress[4]).toBeLessThan(0);
    field.seen = -1;
    for (let s = 0; s < 360 * 15; s++) {
      rival.step(DT, held, world);
      field.step(DT, 1);
    }
    for (let i = 0; i < 4; i++) expect(field.is_coasting(i)).toBe(false);
    expect(field.racers.reduce((sum, r) => sum + r.stats.resets + r.stats.spins, 0)).toBe(0);
  });

  test("a car swapped in where the rival stood keeps its place in the race", () => {
    const { field, rival, world } = field_on(0);
    const held = { steer: 0, throttle: 0, brake: 1, handbrake: 0, analog: true };
    for (let s = 0; s < 360; s++) {
      rival.step(DT, held, world);
      field.step(DT, 1);
    }
    const before = field.progress[4];
    const next = new Car(COUPE);
    next.park(rival.pos.x, rival.pos.z, rival.heading, world);
    field.rival = next;
    next.step(DT, held, world);
    field.step(DT, 1);
    expect(field.progress[4]).toBe(before);
    expect(before).toBeLessThan(0);
  });

  test("every car seen, none ever coasts", () => {
    const { field, rival, world } = field_on(0);
    const held = { steer: 0, throttle: 0, brake: 1, handbrake: 0, analog: true };
    for (let s = 0; s < 360 * 30; s++) {
      rival.step(DT, held, world);
      field.step(DT, 1);
      for (let i = 0; i < 4; i++) expect(field.is_coasting(i)).toBe(false);
    }
  });
});

describe("AI field start and pace", () => {
  const DT = 1 / 360;

  test("the line's pace is the stock coupe's; a car on tarmac-poor tyres drives under it, never over", () => {
    expect(grip_pace(COUPE)).toBe(1);
    const rally = parse_build("rally.4.2.0.4.1.0.7.3");
    if (!rally) throw new Error("rally preset no longer parses");
    expect(grip_pace(build_spec(rally))).toBeLessThan(1);
    const formula = parse_build("formula.6.4.4.2.2.0.1.2.2.2.1.2");
    if (!formula) throw new Error("formula preset no longer parses");
    expect(grip_pace(build_spec(formula))).toBe(1);
  });

  test("off the grid every car keeps its slot's side of the road, and none brakes to queue", () => {
    const world = new World(4);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error("island seed 4 has no circuit");
    world.place(route.closure);
    const field = new Field(world, route, Array.from({ length: 6 }, () => COUPE), personalities(4, 6), 4);
    for (let s = 0; s < 360 * 4; s++) {
      field.step(DT, 1);
      if (s % 36) continue;
      for (const { driver } of field.racers) expect(driver.controls.brake).toBe(0);
    }
    field.racers.forEach(({ car, driver }, k) => expect(Math.sign(Awareness.lateral_of(car, driver))).toBe(Math.sign(grid_spot(route, k).side)));
  });
});
