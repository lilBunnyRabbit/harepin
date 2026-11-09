/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { COUPE } from "./cars";
import { World, type Collider } from "./world";
import { generate } from "./worldgen/index";
import { ramp_surface } from "./worldgen/jumps";
import type { Solid } from "./worldgen/types";

const X = 900;
const Z = 900;
const GROUND = 10;

function world_with(...solids: Solid[]): World {
  const data = generate(3);
  data.solids.push(...solids);
  return new World(3, data);
}

function bar(bottom: number, top: number): Solid {
  return { kind: "box", x: X, y: GROUND, z: Z, hw: 4, hd: 0.25, cos: 1, sin: 0, height: top, bottom };
}

function car_at(y: number): Collider {
  return { pos: new Vector3(X, y, Z - 1.4), vel: new Vector3(0, 0, 20), ang: new Vector3(), heading: 0, spec: COUPE };
}

test("a raised bar stops a car at its height and lets one pass beneath or above", () => {
  const world = world_with(bar(3, 3.35));
  const grounded = car_at(GROUND + 0.5);
  expect(world.collide(grounded)).toBe(0);
  expect(grounded.vel.z).toBe(20);
  const level = car_at(GROUND + 3.2);
  expect(world.collide(level)).toBeGreaterThan(0);
  expect(level.vel.z).toBeLessThan(0);
  expect(world.collide(car_at(GROUND + 3.35 + 0.3))).toBe(0);
});

test("a low bar on the ground stops a grounded car and a flying one clears it", () => {
  const world = world_with(bar(-1, 1.2));
  const grounded = car_at(GROUND + 0.5);
  expect(world.collide(grounded)).toBeGreaterThan(0);
  expect(grounded.vel.z).toBeLessThan(0);
  expect(world.collide(car_at(GROUND + 1.6))).toBe(0);
});

test("every circuit reset point is clear of solids and ramps on 20 seeds", () => {
  const CAR_REACH = 2.5;
  for (let seed = 0; seed < 20; seed++) {
    const world = new World(seed);
    const blocked = (index: number) => {
      const p = world.road[index];
      const solid = world.solids.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < (s.kind === "circle" ? s.radius : Math.hypot(s.hw, s.hd)) + CAR_REACH);
      return solid || world.ramps.some((r) => ramp_surface(r, p.x, p.z) !== null);
    };
    for (let i = 0; i < world.road.length; i++)
      for (const step of [1, -1]) expect(blocked(world.clear_spawn(i, step))).toBe(false);
  }
}, 60_000);
