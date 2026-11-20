/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Route } from "../worldgen/types";
import { Cue, GateCue } from "./gate-cue";
import { GATE_REACH, RaceRun, race_course } from "./races";

const POINTS = Array.from({ length: 400 }, (_, i) => ({ x: i * 2, y: 0, z: 0, tx: 1, tz: 0 }));
const ROUTE: Route = {
  id: "street-1",
  kind: "street",
  closed: false,
  points: POINTS,
  checkpoints: [100, 250, 399].map((i, index) => ({ x: POINTS[i].x, y: 0, z: 0, heading: 0, index })),
  gate_hw: 6,
  road: [{ from: 0, half: 6 }],
  length: 800,
  par_ms: 60_000,
  closure: [],
};

test("cue: a gate passed wide calls the miss once, holds it while the car turns back, clears as the gate is taken", () => {
  const run = new RaceRun(race_course(ROUTE), 0);
  const cue = new GateCue();
  const step = (i: number, off: number, wrong: boolean) => {
    run.update(100, POINTS[i].x, off);
    return cue.update(run.missed, wrong);
  };
  for (let i = 0; i < 95; i++) expect(step(i, 0, false)).toBeNull();
  const struck: number[] = [];
  for (let i = 95; i < 100 + GATE_REACH + 10; i++) {
    step(i, 12, false);
    if (cue.struck) struck.push(i);
  }
  expect(struck).toEqual([100 + GATE_REACH + 1]);
  expect(cue.cue).toBe(Cue.MISSED);
  for (let i = 100 + GATE_REACH + 10; i > 100 + GATE_REACH; i--) {
    expect(step(i, 0, true)).toBe(Cue.MISSED);
    expect(cue.struck).toBe(false);
  }
  expect(step(100 + GATE_REACH, 0, true)).toBe(Cue.WRONG);
  expect(run.next).toBe(1);
  expect(step(101, 0, false)).toBeNull();
});
