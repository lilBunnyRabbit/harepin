/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world } from "./kinds/kinds";
import { rail_open } from "./sky";
import { DECK_STRIDE, RouteKind, WorldKind } from "./types";

const DEG = Math.PI / 180;
const worlds = sweep(10).map((seed) => generate_world(seed, WorldKind.WALL_RIDE));

function line_of(world: (typeof worlds)[number]): Float64Array {
  const line = world.deck?.line;
  if (!line) throw new Error("wall ride world without a deck");
  return line;
}

test("a wall-ride seed draws its own track, not the velodrome track of the same seed", () => {
  for (const seed of [0, 1]) expect(generate_world(seed, WorldKind.WALL_RIDE).road[5]).not.toEqual(generate_world(seed, WorldKind.VELODROME).road[5]);
  const starts = new Set(worlds.map((w) => `${w.road[40].x.toFixed(3)},${w.road[40].z.toFixed(3)}`));
  expect(starts.size).toBe(worlds.length);
});

test("the wall holds 68-72° for 40 m or more with its high rail off, and nothing on the lap is steeper", () => {
  for (const world of worlds) {
    const line = line_of(world);
    const n = line.length / DECK_STRIDE;
    let most = 0;
    let held = 0;
    for (let i = 0; i < n; i++) {
      const bank = line[i * DECK_STRIDE + 5];
      most = Math.max(most, Math.abs(bank));
      if (Math.abs(bank) >= 68 * DEG - 1e-9 && rail_open(world.deck?.open ?? [], line[i * DECK_STRIDE + 8], Math.sign(bank))) held++;
    }
    expect(most).toBeLessThanOrEqual(72 * DEG + 1e-9);
    expect(held * 2).toBeGreaterThanOrEqual(40);
  }
});

test("every lap has a half-pipe: a straight that banks up each side in turn", () => {
  for (const world of worlds) {
    const line = line_of(world);
    const straights = world.deck?.pieces.filter((p) => p.kind === "straight") ?? [];
    const pipe = straights.some((p) => {
      const banks = Array.from({ length: line.length / DECK_STRIDE }, (_, i) => i).filter((i) => line[i * DECK_STRIDE + 8] > p.s0 && line[i * DECK_STRIDE + 8] < p.s0 + p.length).map((i) => line[i * DECK_STRIDE + 5]);
      return Math.max(...banks) > 25 * DEG && Math.min(...banks) < -25 * DEG;
    });
    expect(pipe).toBe(true);
  }
});

test("a wall ride races a closed circuit, never in the bus", () => {
  for (const world of worlds) {
    expect(world.routes.some((r) => r.kind === RouteKind.CIRCUIT && r.closed)).toBe(true);
    for (const route of world.routes) expect(route.excludes).toEqual(["bus"]);
  }
});
