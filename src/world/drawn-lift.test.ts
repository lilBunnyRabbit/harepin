/// <reference types="bun" />
import { expect, test } from "bun:test";
import { paved_lots, paving_lift } from "./drawn-lift";
import { LIFT } from "../worldgen/lifts";
import type { Lot } from "../worldgen/types";

const turn = Math.PI / 6;
const lot = (ground: Lot["ground"]): Lot => ({ id: 0, town: 0, edge: 0, side: 1, x: 100, y: 0, z: 50, w: 20, d: 20, fx: Math.sin(turn), fz: Math.cos(turn), angle: turn, kind: "plaza", ground });

test("a plaza lifts its paving and more its square, in the lot's turned frame, and nothing past it", () => {
  const lots = paved_lots([lot("plaza")], []);
  // Local (8, 8) is on the border paving, outside the square that starts 3 m in.
  const at = (lx: number, lz: number) => paving_lift(lots, 100 + Math.cos(turn) * lx + Math.sin(turn) * lz, 50 - Math.sin(turn) * lx + Math.cos(turn) * lz);
  expect([at(0, 0), at(8, 8), at(12, 0), at(0, -11)]).toEqual([LIFT.plaza, LIFT.pad, 0, 0]);
});
