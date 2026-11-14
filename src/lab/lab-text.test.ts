import { expect, test } from "bun:test";
import { progress_key, progress_text } from "./lab-text";
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
