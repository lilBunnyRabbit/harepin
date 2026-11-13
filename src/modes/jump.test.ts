import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { Car } from "../car/car";
import { COUPE } from "../car/cars";
import { event_markers } from "../career/markers";
import { World } from "../world/world";
import { ramp_world } from "../worldgen/jumps";
import { build_world } from "../worldgen/kinds/kinds";
import { SPAWN_INDEX, WorldKind } from "../worldgen/types";
import { JUMP_LEVELS, JumpEvent, JumpRun, SETTLE_MS, TRIES, WINDOW_MS, build_jump, jump_levels, jump_stars, type Jump, type JumpPose } from "./jump";
import { jump_at } from "./jump-mode";
import { airborne } from "./mode";

const world_of = (kind: WorldKind, seed: number) => new World(seed, build_world(seed, kind).data);
const desert = world_of(WorldKind.DESERT, 2);
const [kicker, big, road] = JUMP_LEVELS;

test("levels: one per ramp kind the map has, none on a map without ramps", () => {
  expect(jump_levels(desert.ramps).map((l) => l.id)).toEqual(["j1", "j2", "j3"]);
  expect(jump_levels(world_of(WorldKind.ISLAND, 2).ramps).map((l) => l.id)).toEqual(["j2", "j3"]);
  expect(jump_levels(world_of(WorldKind.SKY, 1).ramps)).toEqual([]);
});

test("a level takes the ramp of its kind nearest the start, run-up behind it", () => {
  const at = { x: 0, z: 0 };
  for (const level of JUMP_LEVELS) {
    const jump = build_jump(desert.ramps, at, desert, level);
    if (!jump) throw new Error(`no ${level.id}`);
    const { ramp } = jump;
    expect(level === road ? ramp.road : !ramp.road).toBe(true);
    expect(ramp.kind).toBe(level === big ? "big" : "kicker");
    for (const other of desert.ramps.filter((r) => r.kind === ramp.kind && !!r.road === !!ramp.road))
      expect(Math.hypot(other.x, other.z)).toBeGreaterThanOrEqual(Math.hypot(ramp.x, ramp.z));
    expect(Math.hypot(jump.start.x - ramp.x, jump.start.z - ramp.z)).toBeCloseTo(30, 5);
    expect(jump.marks.two).toBeGreaterThan(0);
    expect(jump.marks.three).toBeGreaterThan(jump.marks.two);
  }
});

test("stars by metres, higher is better", () => {
  const marks = { two: 20, three: 30 };
  expect([0, 5, 20, 29.9, 30, 50].map((m) => jump_stars(m, marks))).toEqual([0, 1, 2, 2, 3, 3]);
});

function along(jump: Jump, v: number, airborne: boolean, u = 0, speed = 20): JumpPose {
  const [x, z] = ramp_world(jump.ramp, u, v);
  return { x, z, vx: jump.ramp.fx * speed, vz: jump.ramp.fz * speed, airborne };
}

function fly(run: JumpRun, distance: number): JumpEvent[] {
  const { jump } = run;
  const lip = jump.ramp.length;
  const events = [run.update(10, along(jump, lip - 1, false)), run.update(10, along(jump, lip + 1, true))];
  for (let d = 2; d < distance; d += 2) events.push(run.update(10, along(jump, lip + d, true)));
  events.push(run.update(10, along(jump, lip + distance, false)));
  return events;
}

const desert_kicker = () => {
  const jump = build_jump(desert.ramps, { x: 0, z: 0 }, desert, kicker);
  if (!jump) throw new Error("no kicker");
  return jump;
};

test("a try runs from takeoff at the lip to the first wheel down, then resets", () => {
  const run = new JumpRun(desert_kicker());
  const events = fly(run, 24.4);
  expect(events[1]).toBe(JumpEvent.TAKEOFF);
  expect(events[events.length - 1]).toBe(JumpEvent.LANDED);
  expect(run.best?.metres).toBe(24.4);
  expect(run.settling).toBe(run.best);
  expect(run.update(SETTLE_MS, along(run.jump, 0, false))).toBe(JumpEvent.RESET);
  expect(run.settling).toBe(null);
});

test("best of the tries counts, and the last try ends the run", () => {
  const run = new JumpRun(desert_kicker());
  for (const d of [18, 31, 22]) {
    fly(run, d);
    run.update(SETTLE_MS, along(run.jump, 0, false));
  }
  expect(run.tries).toHaveLength(TRIES);
  expect(run.best?.metres).toBe(31);
  expect(run.done).toBe(true);
  expect(run.timed_out).toBe(false);
});

test("no takeoff away from the lip, too slow, or already in the air", () => {
  const run = new JumpRun(desert_kicker());
  const { jump } = run;
  const lip = jump.ramp.length;
  run.update(10, along(jump, -10, false));
  expect(run.update(10, along(jump, -9, true))).toBe(JumpEvent.NONE);
  run.update(10, along(jump, lip, false, 0, 3));
  expect(run.update(10, along(jump, lip + 1, true, 0, 3))).toBe(JumpEvent.NONE);
  run.update(10, along(jump, lip, false));
  expect(run.update(10, along(jump, lip + 1, true, jump.ramp.hw + 5))).toBe(JumpEvent.NONE);
  expect(run.update(10, along(jump, lip + 1, true))).toBe(JumpEvent.NONE);
  expect(run.flying).toBe(null);
});

test("a reset mid-flight voids the try", () => {
  const run = new JumpRun(desert_kicker());
  run.update(10, along(run.jump, run.jump.ramp.length - 1, false));
  expect(run.update(10, along(run.jump, run.jump.ramp.length + 1, true))).toBe(JumpEvent.TAKEOFF);
  expect(run.update(10, along(run.jump, -60, true))).toBe(JumpEvent.VOID);
  expect(run.flying).toBe(null);
});

test("the window ends the run, but not mid-flight", () => {
  const run = new JumpRun(desert_kicker());
  const { jump } = run;
  run.update(WINDOW_MS - 20, along(jump, jump.ramp.length - 1, false));
  expect(run.update(10, along(jump, jump.ramp.length + 1, true))).toBe(JumpEvent.TAKEOFF);
  expect(run.update(100, along(jump, jump.ramp.length + 4, true))).toBe(JumpEvent.NONE);
  expect(run.update(10, along(jump, jump.ramp.length + 12, false))).toBe(JumpEvent.LANDED);
  expect(run.update(SETTLE_MS, along(jump, 0, false))).toBe(JumpEvent.DONE);
  expect(run.timed_out).toBe(true);
  expect(run.best?.metres).toBe(12);
});

test("a car driven flat out from the start flies off the lip and is measured", () => {
  const jump = jump_at(desert, SPAWN_INDEX, kicker);
  if (!jump) throw new Error("no kicker");
  const car = new Car(COUPE);
  const heading = Math.atan2(jump.start.tx, jump.start.tz);
  car.park(jump.start.x, jump.start.z, heading, desert);
  const run = new JumpRun(jump);
  const DT = 1 / 360;
  let landed = false;
  for (let t = 0; t < 12 && !landed; t += DT) {
    const want = Math.atan2(jump.lip.x + jump.lip.tx * 20 - car.pos.x, jump.lip.z + jump.lip.tz * 20 - car.pos.z);
    const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
    car.step(DT, { steer: airborne(car) ? 0 : Math.max(-1, Math.min(1, -err * 3)), throttle: 1, brake: 0, handbrake: 0, analog: true }, desert);
    landed = run.update(DT * 1000, { x: car.pos.x, z: car.pos.z, vx: car.vel.x, vz: car.vel.z, airborne: airborne(car) }) === JumpEvent.LANDED;
  }
  expect(landed).toBe(true);
  expect(run.best?.metres).toBeGreaterThan(10);
  expect(run.best?.metres).toBeLessThan(jump.marks.three + 20);
});

test("a jump event's marker stands at its run-up", () => {
  const event = { id: "jx", name: "Kicker", mode: "jump", level: "j1", map: "", car: { preset: "Rally" }, tuned: "" };
  const [marker] = event_markers(desert, SPAWN_INDEX, [event], true);
  const jump = jump_at(desert, SPAWN_INDEX, kicker);
  if (!marker || !jump) throw new Error("no marker");
  expect(Math.hypot(marker.x - jump.start.x, marker.z - jump.start.z)).toBeLessThan(12);
});

test("a car beached on the lip, wheels in the air, still ends its try", () => {
  const run = new JumpRun(desert_kicker());
  const { jump } = run;
  const lip = jump.ramp.length;
  run.update(10, along(jump, lip - 1, false));
  expect(run.update(10, along(jump, lip + 1, true))).toBe(JumpEvent.TAKEOFF);
  let event: JumpEvent = JumpEvent.NONE;
  for (let t = 0; t < 2000 && event === JumpEvent.NONE; t += 100) event = run.update(100, along(jump, lip + 1.5, true, 0, 0));
  expect(event).toBe(JumpEvent.LANDED);
  expect(run.best?.metres).toBe(1.5);
});
