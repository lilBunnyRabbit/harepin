/// <reference types="bun" />
import { expect, test } from "bun:test";
import { count_corners, world_facts } from "./facts";
import { generate_world } from "./kinds/kinds";
import { WorldKind } from "./types";

interface P {
  x: number;
  z: number;
}

function loop(parts: [number, number][], r: number, step = 2): P[] {
  const points: P[] = [];
  let x = 0;
  let z = 0;
  let h = 0;
  for (const [straight, turn] of parts) {
    for (let s = 0; s < straight; s += step) {
      points.push({ x, z });
      x += Math.sin(h) * step;
      z += Math.cos(h) * step;
    }
    const steps = Math.ceil((Math.abs(turn) * r) / step);
    const ds = (Math.abs(turn) * r) / steps;
    for (let k = 0; k < steps; k++) {
      points.push({ x, z });
      x += Math.sin(h + turn / steps / 2) * ds;
      z += Math.cos(h + turn / steps / 2) * ds;
      h += turn / steps;
    }
  }
  return points;
}

test("a rounded square has four corners, a stadium two", () => {
  expect(count_corners(loop([[200, Math.PI / 2], [200, Math.PI / 2], [200, Math.PI / 2], [200, Math.PI / 2]], 25))).toBe(4);
  expect(count_corners(loop([[300, Math.PI], [300, Math.PI]], 40))).toBe(2);
});

test("an S bend is two corners, a wide sweep none", () => {
  const s_bend = loop([[200, Math.PI / 2], [0, -Math.PI / 2], [150, Math.PI], [80, Math.PI], [200, Math.PI / 2], [0, -Math.PI / 2], [150, Math.PI], [80, Math.PI]], 30);
  expect(count_corners(s_bend)).toBeGreaterThanOrEqual(6);
  expect(count_corners(loop([[100, Math.PI], [100, Math.PI]], 400))).toBe(0);
});

test("facts of a real island and sky track read like a race track", () => {
  const island = world_facts(generate_world(12345, WorldKind.ISLAND));
  expect(island.length).toBeGreaterThan(1500);
  expect(island.corners).toBeGreaterThan(3);
  expect(island.towns).toBeGreaterThan(0);
  expect(island.gaps).toBe(0);
  const sky = world_facts(generate_world(12345, WorldKind.SKY));
  expect(sky.length).toBeGreaterThan(500);
  expect(sky.corners).toBeGreaterThan(1);
  expect(sky.towns).toBe(0);
}, 120_000);
