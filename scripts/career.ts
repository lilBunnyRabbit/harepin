import "./fake-dom";
import { mkdirSync, writeFileSync } from "node:fs";

const { EVENTS, ghost_path, spot_of } = await import("../src/career/career");
const { DEFAULT_BUILD, DEFAULT_PARTS, build_code, build_spec, parse_build } = await import("../src/car/build");
const { within } = await import("../src/car/car-pick");
const { CARS } = await import("../src/car/cars");
const { GHOST_EVERY_MS, ghost_frame } = await import("../src/car/ghost");
const { rating } = await import("../src/car/pi");
const { PRESETS } = await import("../src/car/presets");
const { DUEL_LEVELS, DuelRun, DuelStatus, build_route } = await import("../src/modes/duel");
const { RaceRun, RaceStatus, race_course } = await import("../src/modes/races");
const { SILVER_SHARE } = await import("../src/modes/track");
const { World } = await import("../src/world/world");
const { build_world, world_key } = await import("../src/worldgen/kinds/kinds");
const { parse_map_code } = await import("../src/worldgen/kinds/map-code");
const { DT, autolap } = await import("./autolap");
type Build = import("../src/car/build").Build;
type CareerEvent = import("../src/career/career").CareerEvent;
type World = import("../src/world/world").World;
type RoadPoint = import("../src/world/world").RoadPoint;

// Tunes race events from bot runs and records each race and duel event's dev ghost (plan: docs/plan/career.md §1.3, §3).
// Race: `three` is the median finish of up to RUNS autolap drives at the class cap (the fastest stock cars and presets
// in it), `two` is three × SILVER_SHARE. Duel keeps its model par. The ghost is the slowest drive that still makes three
// stars, so it shows the pace a 3-star run needs. Prints each event's `stars` and `tuned` to paste into career.ts.
// `bun scripts/career.ts [ids…] [--write]`: --write saves the ghosts to public/career/.
const RUNS = 5;
const WRITE = process.argv.includes("--write");
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const STEP_MS = DT * 1000;

interface Drive {
  label: string;
  ms: number | null;
  frames: number[];
}

function cars_for(event: CareerEvent): { label: string; build: Build }[] {
  const { car } = event;
  if ("preset" in car) {
    const build = parse_build(PRESETS.find((p) => p.name === car.preset)?.code);
    return build ? [{ label: car.preset, build }] : [];
  }
  const stock = Object.keys(CARS).map((id) => ({ label: id, build: { ...DEFAULT_BUILD, car: id as Build["car"], parts: { ...DEFAULT_PARTS } } }));
  const presets = PRESETS.flatMap((p) => {
    const build = parse_build(p.code);
    return build ? [{ label: p.name, build }] : [];
  });
  return [...stock, ...presets]
    .map((entry) => ({ ...entry, pi: rating(entry.build).pi, class: rating(entry.build).class }))
    .filter((entry) => within(entry.class, car.cap))
    .sort((a, b) => b.pi - a.pi)
    .filter((entry, i, all) => all.findIndex((other) => build_code(other.build) === build_code(entry.build)) === i)
    .slice(0, RUNS);
}

// The game's own run clocks the drive, so the time and the ghost line up with what a player sees.
function drive(world: World, build: Build, line: readonly RoadPoint[], clock: { update(car: { x: number; z: number }): boolean; elapsed(): number | null }): Drive {
  const frames: number[] = [];
  let last = -Infinity;
  let done = false;
  autolap(world, build_spec(build), line, false, (car) => {
    done = clock.update({ x: car.pos.x, z: car.pos.z });
    const t = clock.elapsed();
    if (t !== null && t - last >= GHOST_EVERY_MS) {
      ghost_frame(frames, Math.round(t), car);
      last = t;
    }
    return done;
  });
  return { label: "", ms: done ? Math.round(clock.elapsed() ?? 0) : null, frames };
}

function race_drive(world: World, level: string, build: Build): Drive | null {
  const route = world.routes.find((r) => r.id === level);
  if (!route) return null;
  const course = race_course(route);
  const unplace = world.place(route.closure);
  const run = new RaceRun(course, 0);
  const result = drive(world, build, course.line as RoadPoint[], {
    update: ({ x, z }) => (run.update(STEP_MS, x, z), run.status === RaceStatus.DONE),
    elapsed: () => (run.status === RaceStatus.READY ? null : run.elapsed()),
  });
  unplace();
  return result;
}

function duel_drive(world: World, level: string, build: Build): { drive: Drive; par: number } | null {
  const duel = DUEL_LEVELS.find((l) => l.id === level);
  if (!duel) return null;
  const route = build_route(world.seed, world.road, duel, (index) => world.clear_spawn(index));
  const run = new DuelRun(route);
  const result = drive(world, build, route.points as RoadPoint[], {
    update: ({ x, z }) => (run.update(STEP_MS, x, z), run.status === DuelStatus.DONE),
    elapsed: () => (run.status === DuelStatus.READY ? null : run.elapsed()),
  });
  return { drive: result, par: route.par_ms };
}

const round = (frames: number[]) => frames.map((v, i) => (i % 8 === 0 ? v : i % 8 < 4 ? Math.round(v * 100) / 100 : Math.round(v * 1000) / 1000));
const median = (sorted: number[]) => sorted[Math.floor((sorted.length - 1) / 2)];

let failed = 0;
for (const event of EVENTS) {
  if (ONLY.length ? !ONLY.includes(event.id) : event.mode !== "race" && event.mode !== "duel") continue;
  const spot = spot_of(event);
  const read = parse_map_code(spot.map);
  if (!read.ok) throw new Error(`${event.id}: map code ${read.why}`);
  const { seed, kind, levels } = read.map;
  const world = new World(seed, build_world(seed, kind, levels).data, undefined, levels);
  const tuned = world_key(seed, kind, levels);
  const drives: Drive[] = [];
  let par: number | null = null;
  const wall = performance.now();
  for (const { label, build } of cars_for(event)) {
    const run = event.mode === "race" ? race_drive(world, spot.level, build) : event.mode === "duel" ? duel_drive(world, spot.level, build) : null;
    if (!run) throw new Error(`${event.id}: ${event.mode} ${spot.level} has no bot drive`);
    const d = "drive" in run ? run.drive : run;
    if ("par" in run) par = run.par;
    drives.push({ ...d, label });
    console.error(`  ${event.id} ${label}: ${d.ms === null ? "DNF" : `${d.ms} ms`} (${((performance.now() - wall) / 1000).toFixed(0)} s wall)`);
  }
  const finished = drives.filter((d) => d.ms !== null).sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
  const runs = drives.map((d) => `${d.label} ${d.ms === null ? "DNF" : `${(d.ms / 1000).toFixed(1)}s`}`).join(", ");
  if (!finished.length) {
    failed++;
    console.log(`${event.id} ${event.mode} ${spot.level} on ${spot.map}: no bot finished | ${runs}`);
    continue;
  }
  const three = event.mode === "race" ? Math.ceil(median(finished.map((d) => d.ms ?? 0)) / 100) * 100 : (par ?? 0);
  const two = Math.round(three * SILVER_SHARE);
  const ghost = finished.filter((d) => (d.ms ?? Infinity) <= three).at(-1) ?? null;
  const stars = event.mode === "race" ? ` stars: { two: ${two}, three: ${three} },` : "";
  console.log(`${event.id} ${event.mode} ${spot.level} on ${spot.map}:${stars} tuned: "${tuned}"${ghost ? `, ghost: ${ghost.label} ${(ghost.ms ?? 0) / 1000}s` : ", no 3-star ghost"} | ${runs}`);
  if (WRITE && ghost) {
    const path = new URL(`../public/${ghost_path({ ...event, tuned })}`, import.meta.url);
    mkdirSync(new URL(".", path), { recursive: true });
    writeFileSync(path, JSON.stringify(round(ghost.frames)));
  }
}
if (failed) process.exitCode = 1;
