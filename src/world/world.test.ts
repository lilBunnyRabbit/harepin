/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { CARS, COUPE, FORMULA } from "../car/cars";
import { World, type Collider } from "./world";
import { generate } from "../worldgen/index";
import { generate_sky } from "../worldgen/sky";
import { ramp_surface } from "../worldgen/jumps";
import type { Solid } from "../worldgen/types";

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

test("bars meet each car at its own body: the closed bodies keep the shared band, the formula its floor and roll hoop", () => {
  for (const spec of Object.values(CARS)) if (spec !== FORMULA) expect(spec.band).toEqual([0.25, 0.9]);
  const ys = FORMULA.corners.map(([, y]) => y);
  expect(FORMULA.band).toEqual([-Math.min(...ys), Math.max(...ys)]);
  // Clears a bar the shared band would hit, and hits one low under its floor that the shared band would clear.
  const over = world_with(bar(0.85, 2));
  const under = world_with(bar(-1, 0.18));
  const car = (y: number): Collider => ({ ...car_at(y), spec: FORMULA });
  expect(over.collide(car(GROUND))).toBe(0);
  expect(under.collide(car(GROUND + 0.55))).toBe(0);
  expect(under.collide(car(GROUND + 0.45))).toBeGreaterThan(0);
});

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

describe_glide();

function describe_glide() {
  const sky = new World(2, generate_sky(2));
  const island_rail = (x: number): Solid => ({ kind: "box", x, y: GROUND, z: Z, hw: 0.25, hd: 40, cos: 1, sin: 0, height: 1.2, bottom: -0.6 });

  /** Rail centre x that the car's foremost collision circle overlaps by 5 cm. */
  const touching = (heading: number) => X + Math.max(...COUPE.circles.map((c) => c * Math.sin(heading))) + COUPE.radius - 0.05 + 0.25;

  /** A car at `angle` from the rail running along +z, pressed just into it from the -x side; returns its speed after. */
  function hit(world: World, angle: number, speed = 30): { kept: number; into: number; spin: number; impact: number } {
    const pos = new Vector3(X, GROUND + 0.5, Z);
    const vel = new Vector3(Math.sin(angle) * speed, 0, Math.cos(angle) * speed);
    const car: Collider = { pos, vel, ang: new Vector3(), heading: angle, spec: COUPE };
    const restore = world.place([island_rail(touching(angle))]);
    const impact = world.collide(car);
    restore();
    return { kept: Math.hypot(vel.x, vel.z) / speed, into: vel.x, spin: car.ang.y, impact };
  }

  test("a sky rail keeps a car gliding: a hard hit keeps 85-90% of its speed, a graze about 98%, never a stop or a bounce", () => {
    for (const angle of [Math.PI / 2, Math.PI / 3]) {
      const r = hit(sky, angle);
      expect(r.impact).toBeGreaterThan(0);
      expect(r.kept).toBeGreaterThan(0.85);
      expect(r.kept).toBeLessThan(0.9);
      expect(r.into).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(r.spin)).toBeLessThan(Math.abs(angle) * 3 + 1e-9);
    }
    const graze = hit(sky, (8 * Math.PI) / 180);
    expect(graze.kept).toBeGreaterThan(0.98);
    expect(graze.into).toBeLessThanOrEqual(1e-9);
    expect(graze.spin).toBeLessThan(0);
  });

  test("a head-on sky rail hit turns the car along the rail the way its nose points", () => {
    const left = hit(sky, Math.PI / 2 - 0.05);
    const pos = new Vector3(X, GROUND + 0.5, Z);
    const vel = new Vector3(30, 0, 0);
    const car: Collider = { pos, vel, ang: new Vector3(), heading: Math.PI / 2 + 0.05, spec: COUPE };
    const restore = sky.place([island_rail(touching(Math.PI / 2 + 0.05))]);
    sky.collide(car);
    restore();
    expect(vel.z).toBeLessThan(-20);
    expect(left.kept).toBeGreaterThan(0.85);
  });

  test("an island wall still bounces the car as before", () => {
    const world = world_with();
    const r = hit(world, Math.PI / 3);
    expect(r.into).toBeLessThan(0);
    expect(r.kept).toBeLessThan(0.85);
  });
}
