import { expect, test } from "bun:test";
import type { TrialResult } from "./lab";
import { resolve_pack, type Pack } from "./pack";
import { Recorder } from "./recorder";
import { read_results, results_json } from "./results-store";
import { KeptTrace } from "./route-trace";

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
  { status: "done", metrics: { ...metrics, laps: [21.5, 22], top_kmh: 61.6 }, field: null, trace: null },
  { status: "stopped", metrics, field: null, trace: null },
  { status: "new", metrics: null, field: null, trace: null },
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

test("a race trial's field rows come back with its numbers", () => {
  const race: Pack = { ...pack, trials: [{ id: "r", car: "coupe.4.0.0.1.0", map: "1C0000004", field: { cars: [{ aggression: 3, mistakes: 3 }] }, goal: { kind: "race" }, try: "", feel: "" }] };
  const raced = resolve_pack(race);
  const field = [
    { name: "Kaze 2", you: false, finish: 240.5, gap: 0, ai: { spins: 0, resets: 0, contacts: 1, hardest: 2.5, overtakes: 0 } },
    { name: "You", you: true, finish: Number.NaN, gap: 4.5, ai: null },
  ];
  const result: TrialResult[] = [{ status: "stopped", metrics, field, trace: null }];
  expect(read_results(raced, JSON.parse(results_json(raced, result)))).toEqual(result);
  const bad = JSON.parse(results_json(raced, result)) as Record<string, Record<string, unknown>>;
  bad.r.field = [{ name: "x" }];
  expect(read_results(raced, bad)[0].status).toBe("new");
});

test("a route trial's trace comes back with its numbers, and a broken one drops the trial", () => {
  const route: Pack = { ...pack, trials: [{ id: "s", car: "coupe.4.0.0.1.0", map: "1C0000001", route: "circuit", goal: { kind: "laps", laps: 3 }, try: "", feel: "" }] };
  const traced = resolve_pack(route);
  const lines = [" trace 2 500", " s 0.00 0 1.0 2.0 0.0 1 0 0 0", " s 0.25 1 1.5 2.5 3.1 1 0 0.12 0.03", " r 4.500"];
  const result: TrialResult[] = [{ status: "stopped", metrics, field: null, trace: new KeptTrace(lines) }];
  const back = read_results(traced, JSON.parse(results_json(traced, result)));
  expect(back[0].status).toBe("stopped");
  expect(back[0].trace?.lines()).toEqual(lines);
  const bad = JSON.parse(results_json(traced, result)) as Record<string, Record<string, unknown>>;
  bad.s.trace = [" trace 1 500", "<script>"];
  expect(read_results(traced, bad)[0]).toEqual({ status: "new", metrics: null, field: null, trace: null });
});
