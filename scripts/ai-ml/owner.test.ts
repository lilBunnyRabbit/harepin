import { describe, expect, test } from "bun:test";
import { Driver } from "../../src/ai/driver";
import { race_line } from "../../src/ai/line";
import { Car, drop_height, type Controls } from "../../src/car/car";
import { build_spec, parse_build } from "../../src/car/build";
import { export_block } from "../../src/lab/export";
import type { TrialResult } from "../../src/lab/lab";
import { race_path, resolve_pack, type Pack } from "../../src/lab/pack";
import { Recorder } from "../../src/lab/recorder";
import { RouteTrace } from "../../src/lab/route-trace";
import { World } from "../../src/world/world";
import type { RoadPoint } from "../../src/worldgen/types";
import { circuits } from "../ai-race";
import { DT } from "../autolap";
import { ai_lap, track_of } from "./drive";
import { lifts, owner_table } from "./owner-gap";
import { owner_laps, read_export } from "./owner-read";

const COUPE = "coupe.4.0.0.1.0";
const pack = (map: string, route: string): Pack => ({
  id: "ai-ref-test",
  rev: 1,
  title: "t",
  brief: "t",
  trials: [{ id: "lap", car: COUPE, map, route, goal: { kind: "laps", laps: 2 }, try: "", feel: "" }],
  ask: [],
});
const copy = (p: Pack, result: TrialResult) => export_block(p, resolve_pack(p), [result], { lap: { note: "kept the line" } }, "0.52.0", { input: "keys", width: 1, height: 1 }, new Date(0), [{ assist: false, stability: true, steer_mode: "smooth" }]);

/** Two 200 m straights and two r30 bends, a road point every 2 m, starting halfway down a straight. */
function stadium(): RoadPoint[] {
  const out: RoadPoint[] = [];
  const STRAIGHT = 200;
  const BEND = 30;
  const length = 2 * STRAIGHT + 2 * Math.PI * BEND;
  for (let s = 0; s < length - 1; s += 2) {
    let x: number, z: number, a: number;
    if (s < STRAIGHT) [x, z, a] = [BEND, s, 0];
    else if (s < STRAIGHT + Math.PI * BEND) {
      a = (s - STRAIGHT) / BEND;
      [x, z] = [BEND * Math.cos(a), STRAIGHT + BEND * Math.sin(a)];
    } else if (s < 2 * STRAIGHT + Math.PI * BEND) [x, z, a] = [-BEND, STRAIGHT - (s - STRAIGHT - Math.PI * BEND), Math.PI];
    else {
      a = Math.PI + (s - 2 * STRAIGHT - Math.PI * BEND) / BEND;
      [x, z] = [BEND * Math.cos(a), BEND * Math.sin(a)];
    }
    out.push({ x, y: 0, z, tx: -Math.sin(a), tz: Math.cos(a) });
  }
  return [...out.slice(STRAIGHT / 4), ...out.slice(0, STRAIGHT / 4)];
}

/** Laps of `road` at `corner` m/s through the bends, braking `brake_m` before them; a placement at `reset` s. */
function synthetic(road: readonly RoadPoint[], laps: number, corner: number, brake_m: number, reset = NaN): RouteTrace {
  const trace = new RouteTrace(road);
  const car = new Car(build_spec(parse_build(COUPE)!));
  const n = road.length;
  const input: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: 0, analog: true };
  trace.placed(0, false);
  let s = 0;
  let t = 0;
  while (s < laps * n * 2 + 4) {
    const i = Math.floor(s / 2) % n;
    const ahead = (k: number) => road[(i + k) % n].tx * road[i].tx + road[(i + k) % n].tz * road[i].tz < 0.9999;
    const in_bend = ahead(1);
    const braking = !in_bend && ahead(Math.round(brake_m / 2));
    const v = in_bend ? corner : braking ? corner + 10 : 40;
    input.throttle = braking ? 0 : 1;
    input.brake = braking ? 0.7 : 0;
    const p = road[i];
    car.pos.set(p.x + p.tz * 1.5, 0, p.z - p.tx * 1.5);
    car.vel.set(p.tx * v, 0, p.tz * v);
    t += DT;
    s += v * DT;
    if (t >= reset && t - DT < reset) trace.placed(t, true);
    trace.step(t, car, input, 0.05);
  }
  return trace;
}

describe("owner reference laps", () => {
  test("a synthetic export reads back into its laps and sets against a slower AI corner by corner", () => {
    const road = stadium();
    const p = pack("1C0000002", "circuit");
    const result = (trace: RouteTrace): TrialResult => ({ status: "done", metrics: null, field: null, trace });
    const text = copy(p, result(synthetic(road, 3, 20, 40, 8)));
    expect(text).toContain("#trial lap coupe.4.0.0.1.0");
    const [trial] = read_export(`some chat text\n${text.replaceAll("\n", "\n> ")}\nmore chat`);
    expect(trial).toMatchObject({ pack: "ai-ref-test", rev: 1, id: "lap", car: COUPE, map: "1C0000002", route: "circuit", status: "done", aids: { assist: "off", stability: "on", steer: "smooth" }, points: road.length, full: false });
    expect(trial.resets).toHaveLength(1);
    const laps = owner_laps(trial, road, () => false);
    expect(laps.map((l) => l.lap)).toEqual([0, 1, 2]);
    expect(laps.map((l) => l.why)).toEqual(["reset", "", ""]);
    expect(Math.abs(laps[1].t - laps[2].t)).toBeLessThan(0.05);
    expect(laps[1].offset[50]).toBeCloseTo(1.5, 1);

    const [ai_trial] = read_export(copy(p, result(synthetic(road, 1, 14, 100))));
    const [ai] = owner_laps(ai_trial, road, () => false);
    const line = race_line(road, [], 1);
    const table = owner_table(line, ai.trace, laps[1]);
    expect(table).toMatch(/^corners 2, AI loses \d+\.\d s to you in them/);
    expect(table).toContain("brakes 60 m early");
    expect(table).toContain("apex 6.0 m/s slow");
    expect(lifts(line, ai.trace, laps[1])).toEqual([]);
  });

  test("an off-road stretch or a hole in the trace spoils a lap", () => {
    const road = stadium();
    const [trial] = read_export(copy(pack("1C0000002", "circuit"), { status: "done", metrics: null, field: null, trace: synthetic(road, 1, 20, 40) }));
    expect(owner_laps(trial, road, (x) => x < -29)[0].why).toBe("off");
    const holed = { ...trial, samples: trial.samples.filter((s) => s.rp < 100 || s.rp > 120) };
    expect(owner_laps(holed, road, () => false)[0].why).toBe("gap");
    expect(() => owner_laps(trial, road.slice(1), () => false)).toThrow(/route points/);
  });

  test("the AI driving the lab's recorder on seed 2 reads back as the AI's own lap", () => {
    const world = new World(2);
    const route = circuits(world)[0];
    const tk = track_of(world, route, build_spec(parse_build(COUPE)!));
    const ai = ai_lap(tk, 400);
    const p = pack("1C0000002", route.id);
    const [r] = resolve_pack(p);
    const recorder = new Recorder({ ...r.lane, path: race_path(route.points) }, r.trial.goal, new RouteTrace(route.points));
    const car = new Car(tk.spec);
    const start = route.points[0];
    car.place(start.x, world.height(start.x, start.z) + drop_height(tk.spec, 0.75), start.z, Math.atan2(start.tx, start.tz));
    recorder.placed(car);
    const driver = new Driver(tk.line);
    while (!recorder.done) {
      driver.track(car);
      const controls = driver.drive(car, DT);
      car.step(DT, controls, world);
      world.collide(car);
      recorder.step(DT, car, controls);
      if (recorder.time > 600) throw new Error("no lap");
    }
    const [trial] = read_export(copy(p, { status: "done", metrics: recorder.metrics(), field: null, trace: recorder.route }));
    const laps = owner_laps(trial, route.points, (x, z) => world.distance_to_road(x, z) > 7);
    expect(laps).toHaveLength(2);
    expect(laps.every((l) => l.clean)).toBe(true);
    expect(laps[0].t).toBeCloseTo(recorder.metrics().laps[0], 1);
    expect(Math.abs(laps[0].t - ai.t)).toBeLessThan(1);
    const total = Number(/AI loses (-?\d+\.\d) s/.exec(owner_table(tk.line, ai.trace!, laps[0]))?.[1]);
    expect(Math.abs(total)).toBeLessThan(0.5);
  });
});
