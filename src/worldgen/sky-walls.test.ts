/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world, KINDS } from "./kinds/kinds";
import { parse_map_code } from "./kinds/map-code";
import { generate_sky, rail_open } from "./sky";
import { DECK_STRIDE, RouteKind, WorldKind } from "./types";

const DEG = Math.PI / 180;
const OPTIONS = KINDS.sky.options;
const with_level = (name: string, level: number) => OPTIONS.map((o) => (o.name === name ? level : o.normal));
const WALLS = with_level("Bowls & walls", 1);
const walled = (seed: number, name?: string, level = 0) => generate_world(seed, WorldKind.SKY, name ? WALLS.map((l, i) => (OPTIONS[i].name === name ? level : l)) : WALLS);
const worlds = sweep(10).map((seed) => walled(seed));

function line_of(world: (typeof worlds)[number]): Float64Array {
  const line = world.deck?.line;
  if (!line) throw new Error("sky world without a deck");
  return line;
}

function banks(world: (typeof worlds)[number]): number[] {
  const line = line_of(world);
  return Array.from({ length: line.length / DECK_STRIDE }, (_, i) => Math.abs(line[i * DECK_STRIDE + 5]));
}

test("Bowls & walls draws its own track, not the plain sky track of the same seed", () => {
  for (const seed of [0, 1]) expect(walled(seed).road[5]).not.toEqual(generate_sky(seed).road[5]);
  for (const world of worlds) expect(world.kind).toBe(WorldKind.SKY);
});

test("an old Velodrome code reads as Sky with Bowls & walls, its dropped options ignored", () => {
  expect(parse_map_code("1W0000004")).toEqual({ ok: true, map: { kind: WorldKind.SKY, seed: 4, levels: WALLS } });
  expect(parse_map_code("1W0000004-A0P0R0")).toEqual({ ok: true, map: { kind: WorldKind.SKY, seed: 4, levels: WALLS.map((l, i) => (OPTIONS[i].name === "Gaps" ? 0 : l)) } });
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

function pipes(world: (typeof worlds)[number]): number {
  const line = line_of(world);
  const at = Array.from({ length: line.length / DECK_STRIDE }, (_, i) => i * DECK_STRIDE);
  return (world.deck?.pieces ?? []).filter((p) => p.kind === "straight" && at.some((o) => line[o + 8] > p.s0 && line[o + 8] < p.s0 + p.length && Math.abs(line[o + 5]) > 25 * DEG)).length;
}

test("Boost pads and Gaps at none build a walled track without them", () => {
  for (const seed of [0, 2, 3]) {
    expect(walled(seed, "Boost pads").deck?.pieces.filter((p) => p.kind === "pad")).toEqual([]);
    expect(walled(seed, "Gaps").deck?.pieces.filter((p) => p.kind === "gap")).toEqual([]);
  }
});

test("Bowls & walls races a closed circuit, never in the bus", () => {
  for (const world of worlds) {
    expect(world.routes.some((r) => r.kind === RouteKind.CIRCUIT && r.closed)).toBe(true);
    for (const route of world.routes) expect(route.excludes).toEqual(["bus"]);
  }
});
