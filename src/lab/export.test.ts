import { expect, test } from "bun:test";
import { export_block } from "./export";
import { resolve_pack, type Pack } from "./pack";
import type { Metrics } from "./recorder";

const pack: Pack = {
  id: "t1",
  rev: 3,
  title: "t",
  brief: "t",
  trials: [
    { id: "pad", car: "hatch.4.0.2.1.0", mods: [{ scale: { mu: 0.95 }, add: { offroad: -0.15, mass: 10 } }], station: "skidpad", lane: "ice", goal: { kind: "laps", laps: 3 }, try: "", feel: "" },
    { id: "run", car: "hatch.4.0.2.1.0", station: "runway", goal: { kind: "run" }, try: "", feel: "" },
  ],
  ask: [
    { kind: "scale", id: "grip", label: "Grip", low: "", high: "" },
    { kind: "scale", id: "pred", label: "Predictability", low: "", high: "" },
    { kind: "text", id: "note", label: "Note" },
  ],
};

const nan = Number.NaN;
const metrics: Metrics = { time: 70.123, laps: [21.84, 22.41], segment: nan, lat_peak: 0.3141, lat_mean: 0.27, ring_kmh: 38.2, slip_peak: 19.4, slip_mean: 11.2, held: 14.2, chain: 6.1, spins: 0, yaw_lag: nan, recovery: 0.84, to_100: nan, stop_m: nan, stop_from: nan, top_kmh: 44.4, wheelspin: 0.12, spin_peak: 1.43, air: 0, landing: nan, bounces: 0, offs: 1, resets: 0, lock: 0.22, throttle: 0.81, handbrake: 0.04, reversals: 0.31, yaw_over: nan, understeer: nan, power_slip: nan, lift_slip: nan, brake_dev: nan, trail_slip: nan, entry: nan, land_pitch: nan, seam_slip: nan, yaw_sd: nan, steer_sd: nan };

test("the export block reads like docs/lab.md says", () => {
  const trials = resolve_pack(pack);
  const block = export_block(pack, trials, [{ status: "done", metrics }, { status: "new", metrics: null }], { pad: { note: "slides early,\n catches fine", pred: 4, grip: 2 } }, "0.41.1", { input: "touch", width: 390, height: 844 }, new Date("2026-11-14T20:12:30Z"));
  const lines = block.split("\n");
  expect(lines[0]).toBe("#lab t1 r3 v0.41.1 2026-11-14T20:12Z touch 390x844");
  expect(lines[1]).toBe(`#trial pad hatch.4.0.2.1.0 +mu*0.95 +offroad-0.15 +mass+10 spec#${trials[0].hash} pi${trials[0].pi}${trials[0].class.toUpperCase()} skidpad/ice laps3 done`);
  expect(lines[2]).toBe(" m time=70.1 lap=21.8,22.4 latg=0.314/0.27 ring=38.2 slip=19.4/11.2 held=14.2 chain=6.1 spins=0 rec=0.84 top=44.4 spin=0.12/1.43 air=0 bounce=0 offs=1 resets=0 lock=0.22 thr=0.81 hb=0.04 rev=0.31");
  expect(lines[3]).toBe(" a grip=2 pred=4");
  expect(lines[4]).toBe(' n "slides early, catches fine"');
  expect(lines[5]).toMatch(/^#trial run hatch\.4\.0\.2\.1\.0 spec#[0-9a-f]{8} pi\d+[A-Z0-9]+ runway\/asphalt run skipped$/);
  expect(lines[6]).toBe("#end 1/2 trials");
});

test("float noise prints as 0", () => {
  const trials = resolve_pack(pack);
  const quiet: Metrics = { ...metrics, lat_peak: 1.66e-16, lat_mean: 5.3e-17, slip_peak: 3.7e-15 };
  const block = export_block(pack, trials, [{ status: "done", metrics: quiet }, { status: "new", metrics: null }], {}, "0.41.1", { input: "keys", width: 1, height: 1 }, new Date(0));
  expect(block).toContain(" latg=0/0 ");
  expect(block).toContain(" slip=0/11.2 ");
});
