import { describe, expect, test } from "bun:test";
import { build_spec, parse_build } from "../car/build";
import { axles_of } from "../car/axles";
import { CARS } from "../car/cars";
import { LAB_STATIONS } from "../worldgen/lab";
import { budget, MAX_SECONDS, MAX_TRIALS, over_budget } from "./budget";
import { parse_map_code } from "../worldgen/kinds/map-code";
import { is_race, is_route, LAB_CAR, race_path, resolve_pack, resolve_trial, type Pack, type RaceTrial } from "./pack";
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

  test.each(packs)("%s race trials name a map code that reads", (_, pack) => {
    for (const trial of pack.trials.filter(is_race)) expect(parse_map_code(trial.map).ok).toBe(true);
  });

  test.each(packs)("%s round-trips through an inline code", (_, pack) => {
    expect(read_code(pack_code(pack))).toEqual(JSON.parse(JSON.stringify(pack)));
  });
});

// Packs written before the session caps (docs/plan/feel-lab-v2.md 6.1); each must still be over, so the list can't rot.
const OVER_BUDGET: Record<string, string> = {};

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

const race: RaceTrial = { id: "r", car: "coupe.4.0.0.1.0", map: "1C0000004", field: { cars: [{ aggression: 3, mistakes: 3 }], difficulty: "hard" }, goal: { kind: "race" }, try: "", feel: "" };

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

  test("a race trial runs on its map's route with no station", () => {
    const pack: Pack = { ...base, trials: [race] };
    const r = resolve_trial(pack, race);
    expect(r.station).toBeNull();
    expect(r.lane.name).toBe("circuit");
    expect(resolve_trial(pack, { ...race, route: "circuit-rev" }).lane.name).toBe("circuit-rev");
  });

  test("a race lane's path thins the route to about 10 m and closes the loop", () => {
    const ring = Array.from({ length: 400 }, (_, i) => ({ x: 100 * Math.cos((i / 400) * 2 * Math.PI), z: 100 * Math.sin((i / 400) * 2 * Math.PI) }));
    const path = race_path(ring);
    expect(path.points.length).toBeGreaterThan(55);
    expect(path.points.length).toBeLessThan(70);
    expect(path.points[path.points.length - 1]).toEqual(path.points[0]);
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

  test("a race trial's map, field and goal are checked", () => {
    const with_race = (trial: unknown) => ({ ...base, trials: [trial] });
    expect(read_pack(with_race(race)).trials[0]).toEqual(race);
    expect(code(with_race({ ...race, station: "hub" }))).toThrow(/map, not a station/);
    expect(code(with_race({ ...race, field: { cars: [] } }))).toThrow(/AI cars/);
    expect(code(with_race({ ...race, field: { cars: Array.from({ length: 7 }, () => ({ aggression: 3, mistakes: 3 })) } }))).toThrow(/AI cars/);
    expect(code(with_race({ ...race, field: { cars: [{ aggression: 6, mistakes: 3 }] } }))).toThrow(/aggression/);
    expect(code(with_race({ ...race, field: { ...race.field, difficulty: "brutal" } }))).toThrow(/difficulty/);
    expect(code(with_race({ ...race, goal: { kind: "laps", laps: 2 } }))).toThrow(/race or time/);
    expect(code({ ...base, trials: [{ ...base.trials[0], goal: { kind: "race" } }] })).toThrow(/race goal on a station/);
  });

  test("a map with no field is a route trial, and it drives laps", () => {
    const { field: _, ...alone } = { ...race, goal: { kind: "laps" as const, laps: 3 } };
    const read = read_pack({ ...base, trials: [alone] }).trials[0];
    expect(read).toEqual(alone);
    expect(is_route(read) && !is_race(read)).toBe(true);
    expect(code({ ...base, trials: [{ ...alone, goal: { kind: "time", seconds: 60 } }] })).toThrow(/drives laps/);
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
