import { expect, test } from "bun:test";
import { Difficulty, RunType, custom } from "./runs";
import { band_text, route_text } from "./run-route";

const ROUTES = [
  { id: "circuit", length: 1300, closed: true },
  { id: "street-1", length: 2400, closed: false },
];

const race = (choice: string | null, laps: number) => custom({ type: RunType.RACE, kind: "island", choice, difficulty: Difficulty.NORMAL, car: null, laps }, 3);

test("a race pick names the route its map resolves to, with its km over every lap", () => {
  expect(route_text(race("medium", 1), ROUTES)).toBe("Town to town · 2.4 km");
  expect(route_text(race("medium", 2), ROUTES)).toBe("Circuit · 1.3 km × 2 = 2.6 km");
  expect(route_text(custom({ type: RunType.TRAP, kind: "island", choice: null, difficulty: Difficulty.NORMAL, car: null, laps: 1 }, 3), ROUTES)).toBe("Speed trap · 1.3 km");
  expect(route_text(custom({ type: RunType.DRIFT, kind: "island", choice: null, difficulty: Difficulty.NORMAL, car: null, laps: 1 }, 3), ROUTES)).toBeNull();
});

test("the length band reads in km, over the whole run when it has laps", () => {
  expect(band_text(race("short", 1))).toBe("Short: under 2.0 km");
  expect(band_text(race("medium", 1))).toBe("Medium: 2.0 km to 3.5 km");
  expect(band_text(race("long", 3))).toBe("Long: over 3.5 km in all");
  expect(band_text(race(null, 1))).toBeNull();
});
