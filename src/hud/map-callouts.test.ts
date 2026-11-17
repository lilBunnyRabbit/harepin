import { expect, test } from "bun:test";
import { callout_anchor, callout_sides, callout_step } from "./map-callouts";

const SPOTS = [
  { id: "ne", x: 40, z: -30 },
  { id: "sw", x: -50, z: 20 },
  { id: "nw", x: -20, z: -40 },
  { id: "se", x: 10, z: 35 },
  { id: "mid", x: -5, z: 0 },
];

test("the western flags take the left side, each side north to south", () => {
  expect(callout_sides(SPOTS)).toEqual({ left: ["nw", "mid", "sw"], right: ["ne", "se"] });
  expect(callout_sides([])).toEqual({ left: [], right: [] });
});

test("a side's callouts meet the map's edge at even steps", () => {
  expect([0, 1].map((row) => callout_anchor(row, 2))).toEqual([0.25, 0.75]);
});

test("arrows walk a side and cross to the nearest row of the other", () => {
  const sides = callout_sides(SPOTS);
  expect(callout_step(sides, "nw", "down")).toBe("mid");
  expect(callout_step(sides, "nw", "up")).toBe("sw");
  expect(callout_step(sides, "sw", "right")).toBe("se");
  expect(callout_step(sides, "nw", "right")).toBe("ne");
  expect(callout_step(sides, "ne", "right")).toBe("ne");
  expect(callout_step(sides, "se", "left")).toBe("sw");
  expect(callout_step(sides, null, "down")).toBe("nw");
});
