/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world, KINDS } from "./kinds/kinds";
import { generate_sky, rail_open } from "./sky";
import { DECK_STRIDE, RouteKind, WorldKind } from "./types";

const DEG = Math.PI / 180;
const worlds = sweep(10).map((seed) => generate_world(seed, WorldKind.VELODROME));

function line_of(world: (typeof worlds)[number]): Float64Array {
  const line = world.deck?.line;
  if (!line) throw new Error("velodrome world without a deck");
  return line;
}

function banks(world: (typeof worlds)[number]): number[] {
  const line = line_of(world);
  return Array.from({ length: line.length / DECK_STRIDE }, (_, i) => Math.abs(line[i * DECK_STRIDE + 5]));
}

test("a velodrome seed draws its own track, not the sky track of the same seed", () => {
  for (const seed of [0, 1]) expect(generate_world(seed, WorldKind.VELODROME).road[5]).not.toEqual(generate_sky(seed).road[5]);
  for (const world of worlds) expect(world.kind).toBe(WorldKind.VELODROME);
});

test("every lap has a bowl each way, kicked past 60° and never past 70°", () => {
  for (const world of worlds) {
    const line = line_of(world);
    const steep = banks(world).map((b, i) => (b > 40 * DEG ? Math.sign(line[i * DECK_STRIDE + 5]) : 0));
    expect(steep).toContain(1);
    expect(steep).toContain(-1);
    const most = Math.max(...banks(world));
    expect(most).toBeGreaterThan(60 * DEG);
    expect(most).toBeLessThanOrEqual(70 * DEG + 1e-9);
  }
});

test("the wall holds 60-64° for 30 m or more with its high rail off", () => {
  for (const world of worlds) {
    const line = line_of(world);
    const n = line.length / DECK_STRIDE;
    let held = 0;
    for (let i = 0; i < n; i++) {
      const bank = line[i * DECK_STRIDE + 5];
      if (Math.abs(bank) >= 60 * DEG - 1e-9 && rail_open(world.deck?.open ?? [], line[i * DECK_STRIDE + 8], Math.sign(bank))) held++;
    }
    expect(held * 2).toBeGreaterThanOrEqual(30);
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

const OPTIONS = KINDS.velodrome.options;
const with_level = (name: string, level: number) => OPTIONS.map((o) => (o.name === name ? level : o.normal));

function pipes(world: (typeof worlds)[number]): number {
  const line = line_of(world);
  const at = Array.from({ length: line.length / DECK_STRIDE }, (_, i) => i * DECK_STRIDE);
  return (world.deck?.pieces ?? []).filter((p) => p.kind === "straight" && at.some((o) => line[o + 8] > p.s0 && line[o + 8] < p.s0 + p.length && Math.abs(line[o + 5]) > 25 * DEG)).length;
}

test("the normal levels build the plain velodrome", () => {
  expect(generate_world(2, WorldKind.VELODROME, OPTIONS.map((o) => o.normal)).road).toEqual(generate_world(2, WorldKind.VELODROME).road);
});

test("Half-pipes none lays no pipe, Wall ride off leaves no steep bank without its rail", () => {
  for (const seed of [0, 2, 3]) {
    expect(pipes(generate_world(seed, WorldKind.VELODROME, with_level("Half-pipes", 0)))).toBe(0);
    const world = generate_world(seed, WorldKind.VELODROME, with_level("Wall ride", 0));
    const line = line_of(world);
    for (let o = 0; o < line.length; o += DECK_STRIDE) expect(Math.abs(line[o + 5]) >= 60 * DEG && rail_open(world.deck?.open ?? [], line[o + 8], Math.sign(line[o + 5]))).toBe(false);
  }
});

test("Boost pads and Gaps at none build a track without them", () => {
  for (const seed of [0, 2, 3]) {
    expect(generate_world(seed, WorldKind.VELODROME, with_level("Boost pads", 0)).deck?.pieces.filter((p) => p.kind === "pad")).toEqual([]);
    expect(generate_world(seed, WorldKind.VELODROME, with_level("Gaps", 0)).deck?.pieces.filter((p) => p.kind === "gap")).toEqual([]);
  }
});

test("a velodrome races a closed circuit, never in the bus", () => {
  for (const world of worlds) {
    expect(world.routes.some((r) => r.kind === RouteKind.CIRCUIT && r.closed)).toBe(true);
    for (const route of world.routes) expect(route.excludes).toEqual(["bus"]);
  }
});
