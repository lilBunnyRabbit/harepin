import { describe, expect, test } from "bun:test";
import { build_spec, parse_build } from "../car/build";
import { axles_of } from "../car/axles";
import { CARS } from "../car/cars";
import { LAB_STATIONS } from "../worldgen/lab";
import { budget, MAX_SECONDS, MAX_TRIALS, over_budget } from "./budget";
import { LAB_CAR, resolve_pack, resolve_trial, type Pack } from "./pack";
import { pack_code, read_code, read_pack } from "./pack-code";
import { PACKS } from "./packs";

const packs = await Promise.all(Object.entries(PACKS).map(async ([id, load]) => [id, (await load()).default] as const));

describe("packs", () => {
  test.each(packs)("%s resolves every trial under its own id", (id, pack) => {
    expect(pack.id).toBe(id);
    const resolved = resolve_pack(pack);
    expect(new Set(pack.trials.map((t) => t.id)).size).toBe(pack.trials.length);
    for (const r of resolved) {
      expect(Number.isFinite(r.pi)).toBe(true);
      expect(r.hash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  test.each(packs)("%s lab cars never take a garage id and have axles", (_, pack) => {
    for (const [key, car] of Object.entries(pack.cars ?? {})) {
      expect(Object.keys(CARS)).not.toContain(key);
      expect(parse_build(`${LAB_CAR}${key}`)).toBeNull();
      expect(axles_of(car.spec).length).toBeGreaterThan(0);
    }
  });

  test.each(packs)("%s round-trips through an inline code", (_, pack) => {
    expect(read_code(pack_code(pack))).toEqual(JSON.parse(JSON.stringify(pack)));
  });
});

// Packs written before the session caps (docs/plan/feel-lab-v2.md 6.1); each must still be over, so the list can't rot.
const OVER_BUDGET: Record<string, string> = {
  "t2-drift": "12 trials, under the time cap: left as is",
};

describe("session budget", () => {
  test.each(packs)("%s fits the trial and time caps", (id, pack) => {
    const b = budget(resolve_pack(pack));
    expect(Number.isFinite(b.total)).toBe(true);
    if (id in OVER_BUDGET) return expect(over_budget(b)).toBe(true);
    expect(b.trials).toBeLessThanOrEqual(MAX_TRIALS);
    expect(b.total).toBeLessThanOrEqual(MAX_SECONDS);
  });

  test("every exempt pack exists", () => {
    for (const id of Object.keys(OVER_BUDGET)) expect(Object.keys(PACKS)).toContain(id);
  });

  test("a lap on low grip takes longer than on asphalt", () => {
    const pad = (lane: string): Pack => ({ ...base, trials: [{ ...base.trials[0], station: "skidpad", lane, goal: { kind: "laps", laps: 2 } }] });
    expect(budget(resolve_pack(pad("ice"))).drive).toBeGreaterThan(budget(resolve_pack(pad("asphalt"))).drive);
  });
});

const base: Pack = { id: "t", rev: 1, title: "t", brief: "t", trials: [{ id: "a", car: "hatch.4.0.2.1.0", station: "hub", goal: { kind: "free" }, try: "", feel: "" }], ask: [] };

describe("resolve", () => {
  test("a trial with no mods drives the build's own spec", () => {
    const r = resolve_trial(base, base.trials[0]);
    expect(r.spec).toEqual(build_spec(r.build));
  });

  test("a mod folds like one more part", () => {
    const plain = resolve_trial(base, base.trials[0]).spec;
    const r = resolve_trial(base, { ...base.trials[0], mods: [{ scale: { mass: 2 }, add: { mass: 1 } }] });
    expect(r.spec.mass).toBe(plain.mass * 2 + 1);
  });

  test("a lab car takes the lab id and its look's body", () => {
    const pack: Pack = { ...base, cars: { proto: { name: "Proto", spec: CARS.kaze, look: "coupe" } }, trials: [{ ...base.trials[0], car: "lab:proto" }] };
    const r = resolve_trial(pack, pack.trials[0]);
    expect(r.spec.id).toBe("lab:proto");
    expect(r.build.car).toBe("coupe");
  });

  test("every station has a lane", () => {
    for (const station of LAB_STATIONS) expect(station.lanes.length).toBeGreaterThan(0);
  });
});

describe("inline packs are untrusted", () => {
  const code = (v: unknown) => () => read_pack(v);
  test("a wrong station, lane, car or field throws", () => {
    expect(code({ ...base, trials: [{ ...base.trials[0], station: "moon" }] })).toThrow(/station/);
    expect(code({ ...base, trials: [{ ...base.trials[0], station: "skidpad", lane: "lava" }] })).toThrow(/lane/);
    expect(code({ ...base, trials: [{ ...base.trials[0], car: "lab:none" }] })).toThrow(/lab car/);
    expect(code({ ...base, trials: [{ ...base.trials[0], mods: [{ scale: { warp: 2 } }] }] })).toThrow(/part field/);
    expect(code({ ...base, trials: [{ ...base.trials[0], mods: [{ scale: { mass: "x" } }] }] })).toThrow(/finite/);
  });

  test("a lab spec is held to the shipped specs' shape", () => {
    const car = (spec: unknown) => ({ ...base, cars: { p: { name: "P", spec, look: "kaze" } } });
    expect(read_pack(car(CARS.kaze)).cars?.p.spec).toEqual(CARS.kaze);
    expect(code(car({ ...CARS.kaze, mass: Number.NaN }))).toThrow(/mass/);
    expect(code(car({ ...CARS.kaze, drive: "warp" }))).toThrow(/drive/);
    expect(code(car({ ...CARS.kaze, rocket: 1 }))).toThrow(/rocket/);
    const { mass: _, ...missing } = CARS.kaze;
    expect(code(car(missing))).toThrow(/mass/);
  });

  test("a code that is not base64 JSON throws", () => {
    expect(() => read_code("~%%%")).toThrow(/decode/);
    expect(() => read_code("demo")).toThrow(/code/);
  });
});
