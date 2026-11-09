/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sample } from "./field";
import { generate } from "./index";
import { ARCH_LEG, seen } from "./landmarks";
import { N, PropKind, ROAD_HALF, type Prop, type RoadPoint } from "./types";

const SEEDS = [1, 475664083];
const worlds = SEEDS.map((seed) => generate(seed));
const marks = (props: Prop[], kind: PropKind) => props.filter((p) => p.kind === kind);

test("each island gets one mast, one lighthouse, a row of turbines and an arch", () => {
  for (const world of worlds) {
    expect(marks(world.props, PropKind.MAST).length).toBe(1);
    expect(marks(world.props, PropKind.LIGHTHOUSE).length).toBe(1);
    expect(marks(world.props, PropKind.TURBINE).length).toBeGreaterThanOrEqual(3);
    expect(marks(world.props, PropKind.TURBINE).length).toBeLessThanOrEqual(5);
    expect(marks(world.props, PropKind.ARCH).length).toBe(1);
  }
});

test("the mast stands near the top of the island and the lighthouse on the shore", () => {
  for (const world of worlds) {
    const top = world.terrain.heights.reduce((a, b) => Math.max(a, b), -Infinity);
    const [mast] = marks(world.props, PropKind.MAST);
    expect(mast.y).toBeGreaterThan(top - 25);
    const [light] = marks(world.props, PropKind.LIGHTHOUSE);
    expect(light.y).toBeGreaterThan(3);
    expect(light.y).toBeLessThan(19);
    const sea = Array.from({ length: 16 }, (_, k) => sample(world.terrain.heights, light.x + Math.sin(k * 0.39) * 140, light.z + Math.cos(k * 0.39) * 140)).filter((h) => h < 0).length;
    expect(sea).toBeGreaterThanOrEqual(6);
  }
});

test("turbines stand apart on high ground, away from the summit mast", () => {
  for (const world of worlds) {
    const turbines = marks(world.props, PropKind.TURBINE);
    const [mast] = marks(world.props, PropKind.MAST);
    for (const t of turbines) {
      expect(t.y).toBeGreaterThan(50);
      expect(Math.hypot(t.x - mast.x, t.z - mast.z)).toBeGreaterThan(300);
      for (const o of turbines) if (o !== t) expect(Math.hypot(t.x - o.x, t.z - o.z)).toBeGreaterThanOrEqual(50);
    }
  }
});

test("the arch spans a spur with both legs clear of every road and its lintel over the car", () => {
  for (const world of worlds) {
    const [arch] = marks(world.props, PropKind.ARCH);
    const fx = Math.sin(arch.angle);
    const fz = Math.cos(arch.angle);
    for (const side of [-1, 1]) {
      const x = arch.x + fz * side * arch.scale;
      const z = arch.z - fx * side * arch.scale;
      expect(sample(world.terrain.road_dist, x, z)).toBeGreaterThan(ROAD_HALF + ARCH_LEG);
    }
    const lintel = world.solids.find((s) => s.kind === "box" && s.bottom !== undefined && s.x === arch.x && s.z === arch.z);
    expect(lintel?.kind === "box" && lintel.bottom).toBeGreaterThan(5);
  }
});

test("landmarks and their solids come out the same for the same seed", () => {
  const again = generate(SEEDS[0]);
  expect(again.props).toEqual(worlds[0].props);
  expect(again.solids.length).toBe(worlds[0].solids.length);
});

test("a ridge between the road and a spot hides it, and a taller spot shows over it", () => {
  const heights = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) heights[j * (N + 1) + i] = Math.abs(i - N / 2) < 3 ? 40 : 0;
  const eye: RoadPoint[] = [{ x: -200, y: 0, z: 0, tx: 1, tz: 0 }];
  expect(seen(heights, eye, 200, 0, 10)).toBe(0);
  expect(seen(heights, eye, 200, 0, 120)).toBe(1);
  expect(seen(heights, eye, -100, 0, 10)).toBe(1);
});
