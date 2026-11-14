import { expect, test } from "bun:test";
import { progress_key, progress_text, shown_metrics } from "./lab-text";
import type { Goal } from "./pack";

const shown = (goal: Goal, laps: number, gates: number, time: number, gate_count = 2) => progress_text(goal, progress_key(goal, laps, gates, time), gate_count);

test("the strip counts toward each goal", () => {
  expect(shown({ kind: "laps", laps: 3 }, 1, 0, 30)).toBe("Lap 2/3");
  expect(shown({ kind: "laps", laps: 3 }, 3, 0, 90)).toBe("Lap 3/3");
  expect(shown({ kind: "time", seconds: 45 }, 0, 0, 4.2)).toBe("41 s left");
  expect(shown({ kind: "run" }, 0, 1, 3)).toBe("Gate 1/2");
  expect(shown({ kind: "free" }, 0, 0, 12.7)).toBe("12 s");
  expect(shown({ kind: "stop", from_kmh: 60 }, 0, 0, 5)).toBe("Brake from 60");
});

test("the card drops numbers that mean nothing at the station or were never measured", () => {
  const pairs: [string, string][] = [["time", "13.7"], ["slip", "0/-"], ["spins", "0"], ["stop", "34@60"], ["thr", "0.91"], ["pitch", "0.374"], ["yawsd", "0/0"], ["top", "221"]];
  expect(shown_metrics(pairs, "runway").map((m) => [m.key, m.value])).toEqual([
    ["time", "13.7 s"],
    ["stop", "34 m from 60 km/h"],
    ["thr", "91%"],
    ["top", "221 km/h"],
  ]);
  expect(shown_metrics([["spins", "0"], ["pitch", "0.374"]], "kicker").map((m) => m.key)).toEqual(["pitch"]);
  expect(shown_metrics([["spins", "0"]], "drift").map((m) => m.value)).toEqual(["0"]);
});
