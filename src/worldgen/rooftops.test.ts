/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world } from "./kinds/kinds";
import { STREET_BELOW } from "./rooftops";
import { generate_sky } from "./sky";
import { DECK_STRIDE, DECK_THICK, WorldKind } from "./types";

const worlds = sweep(12).map((seed) => generate_world(seed, WorldKind.ROOFTOPS));

function line_of(world: (typeof worlds)[number]): Float64Array {
  if (!world.deck) throw new Error("rooftops world without a deck");
  return world.deck.line;
}

test("a rooftops seed draws its own track, not the sky track of the same seed", () => {
  for (const seed of [0, 1]) expect(generate_world(seed, WorldKind.ROOFTOPS).road[5]).not.toEqual(generate_sky(seed).road[5]);
  for (const world of worlds) expect(world.kind).toBe(WorldKind.ROOFTOPS);
});

test("the terraced profile holds level on roof runs and climbs only on long car-park ramps", () => {
  for (const world of worlds) {
    const line = line_of(world);
    const n = line.length / DECK_STRIDE;
    let flat = 0;
    let climb = 0;
    let climbs = 0;
    for (let i = 0; i + 1 < n; i++) {
      const a = i * DECK_STRIDE;
      const b = a + DECK_STRIDE;
      const ds = line[b + 8] - line[a + 8];
      const dy = line[b + 1] - line[a + 1];
      if (dy === 0) flat += ds;
      const kicker = (world.deck?.pieces ?? []).some((p) => p.kind === "kicker" && line[a + 8] >= p.s0 - 2.5 && line[a + 8] <= p.s0 + p.length + 2.5);
      if (dy > 0 && !kicker) climb += ds;
      else if (climb) {
        climbs++;
        climb = 0;
      }
    }
    expect(flat / line[(n - 1) * DECK_STRIDE + 8]).toBeGreaterThan(0.3);
    expect(world.deck?.open).toEqual([]);
    expect(climbs).toBeLessThan(12);
  }
});

test("every building stands on one street, its roof under the deck it carries, and no other pass runs through it", () => {
  for (const world of worlds) {
    const line = line_of(world);
    const n = line.length / DECK_STRIDE;
    let low = Infinity;
    for (let i = 0; i < n; i++) low = Math.min(low, line[i * DECK_STRIDE + 1]);
    expect(world.buildings.length).toBeGreaterThan(10);
    expect(world.lots.length).toBe(world.buildings.length);
    for (const b of world.buildings) {
      expect(b.y).toBe(low - STREET_BELOW);
      expect(world.lots[b.lot].x).toBe(b.x);
      const top = b.y + b.height;
      let carried = 0;
      for (let i = 0; i < n; i++) {
        const k = i * DECK_STRIDE;
        const dx = line[k] - b.x;
        const dz = line[k + 2] - b.z;
        if (Math.abs(dx * b.fx + dz * b.fz) > b.hd || Math.abs(dx * b.fz - dz * b.fx) > b.hw) continue;
        expect(line[k + 1] - DECK_THICK).toBeGreaterThan(top);
        if (line[k + 1] - top < 4) carried++;
      }
      expect(carried).toBeGreaterThan(0);
    }
  }
});
