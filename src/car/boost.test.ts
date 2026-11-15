/// <reference types="bun" />
import { expect, test } from "bun:test";
import { boost_at, boosted } from "./boost";
import { curve_at } from "./curve";

const TORQUE: [number, number][] = [
  [0, 100],
  [3000, 200],
  [6000, 180],
];
const TWIN = { peak: 2, lag: 2000, spool: 4000 };

test("no boost below the lag, the peak from the spool on, a rising ramp between", () => {
  expect(boost_at(TWIN, 1500)).toBe(1);
  expect(boost_at(TWIN, 4000)).toBe(2);
  expect(boost_at(TWIN, 5500)).toBe(2);
  for (let rpm = 2000; rpm < 4000; rpm += 250) expect(boost_at(TWIN, rpm + 250)).toBeGreaterThan(boost_at(TWIN, rpm));
});

test("the boosted table keeps the curve's span and multiplies every point by the boost there", () => {
  const table = boosted(TORQUE, TWIN);
  expect(table[0]).toEqual([0, 100]);
  expect(table.at(-1)).toEqual([6000, 360]);
  for (const [rpm, nm] of table) expect(nm).toBe(Math.round(curve_at(TORQUE, rpm) * boost_at(TWIN, rpm)));
});
