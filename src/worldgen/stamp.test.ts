/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Grid } from "./field";
import { MAINLAND } from "./recipe";
import { Stamp } from "./stamp";
import { CELL, ORIGIN, type RoadEdge, type Terrain } from "./types";

const MID = -ORIGIN / CELL;
const GRID: Grid = { i0: MID - 40, j0: MID - 10, i1: MID + 40, j1: MID + 10, row: 81 };
const CUT = 12;

function steepest(bank: typeof MAINLAND.road.bank): number {
  const count = 81 * 21;
  const land: Terrain = { seed: 0, size: 0, cell: CELL, n: 0, heights: new Float32Array(count).fill(CUT), road_dist: new Float32Array(count).fill(1e9), surface: new Uint8Array(count) };
  const points = [-200, 200].map((z) => ({ x: 0, y: 0, z, tx: 0, tz: 1 }));
  const edge: RoadEdge = { id: 0, a: 0, b: 1, kind: "local", half: 5, closed: false, points };
  const stamp = new Stamp(land, GRID, false);
  stamp.edge(edge, bank);
  stamp.blend(bank);
  const row = 10 * 81;
  let worst = 0;
  for (let i = 0; i < 80; i++) worst = Math.max(worst, Math.abs(land.heights[row + i + 1] - land.heights[row + i]) / CELL);
  return worst;
}

test("a mainland bank eases a 12 m cut out under 1:2.5, where the island's shoulder stands it as a wall", () => {
  expect(steepest(MAINLAND.road.bank)).toBeLessThan(0.41);
  expect(steepest(null)).toBeGreaterThan(1);
});
