import { expect, test } from "bun:test";
import type { TrialResult } from "./lab";
import { resolve_pack, type Pack } from "./pack";
import { Recorder } from "./recorder";
import { read_results, results_json } from "./results-store";

const pack: Pack = {
  id: "t",
  rev: 1,
  title: "t",
  brief: "t",
  trials: [
    { id: "a", car: "hatch.4.0.2.1.0", station: "hub", goal: { kind: "free" }, try: "", feel: "" },
    { id: "b", car: "hatch.4.0.2.1.0", station: "hub", goal: { kind: "free" }, try: "", feel: "" },
    { id: "c", car: "hatch.4.0.2.1.0", station: "hub", goal: { kind: "free" }, try: "", feel: "" },
  ],
  ask: [],
};
const trials = resolve_pack(pack);
const metrics = new Recorder(trials[0].lane, { kind: "free" }).metrics();
const results: TrialResult[] = [
  { status: "done", metrics: { ...metrics, laps: [21.5, 22], top_kmh: 61.6 } },
  { status: "stopped", metrics },
  { status: "new", metrics: null },
];
const stored = () => JSON.parse(results_json(trials, results)) as Record<string, Record<string, unknown>>;

test("numbers survive a reload, never-measured ones as NaN", () => {
  expect(read_results(trials, stored())).toEqual(results);
});

test("numbers driven on another spec, or that do not check out, are dropped", () => {
  const raw = stored();
  raw.a.hash = "00000000";
  (raw.b.metrics as Record<string, unknown>).top_kmh = "fast";
  const back = read_results(trials, raw);
  expect(back.map((r) => r.status)).toEqual(["new", "new", "new"]);
  expect(read_results(trials, "junk").every((r) => r.metrics === null)).toBe(true);
});
