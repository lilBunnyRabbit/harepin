import "./fake-dom";
import { mkdirSync, writeFileSync } from "node:fs";

const { EVENTS, ghost_path, spot_of, tier_of } = await import("../src/career/career");
const { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, SLOT_NAMES, build_code, build_spec, parse_build } = await import("../src/car/build");
const { within } = await import("../src/car/car-pick");
const { CARS } = await import("../src/car/cars");
const { GHOST_EVERY_MS, ghost_frame } = await import("../src/car/ghost");
const { rating } = await import("../src/car/pi");
const { PRESETS } = await import("../src/car/presets");
const { DUEL_LEVELS, DuelRun, DuelStatus, build_route } = await import("../src/modes/duel");
const { RaceRun, RaceStatus, race_course } = await import("../src/modes/races");
const { SILVER_SHARE } = await import("../src/modes/track");
const { mesh_tones } = await import("../src/render/scene");
const { World } = await import("../src/world/world");
const { chunk_of } = await import("../src/worldgen/chunk-grid");
const { build_world, world_key } = await import("../src/worldgen/kinds/kinds");
const { parse_map_code } = await import("../src/worldgen/kinds/map-code");
const { TileMesher } = await import("../src/worldgen/tile-mesher");
const { DT, autolap } = await import("./autolap");
type Build = import("../src/car/build").Build;
type CareerEvent = import("../src/career/career").CareerEvent;
type CarClass = import("../src/car/pi").CarClass;
type World = import("../src/world/world").World;
type RoadPoint = import("../src/world/world").RoadPoint;
type TileMesher = import("../src/worldgen/tile-mesher").TileMesher;

// Tunes race events, and a championship's race and duel stages, from bot runs and records each race event's dev ghost (duels
// and stages ship none: the owner's marks beat any bot) (plan: docs/plan/career.md §1.3, §3, §10.3).
// Race: `three` is the median finish of up to RUNS autolap drives at the class cap (each body tuned up to the cap, and presets
// in it), `two` is three × SILVER_SHARE. Duel, until the owner's run sets its marks: `three` is the best bot finish, `two` three ×
// DUEL_SILVER, or SILVER_SHARE in a tier with a margin, as the owner's marks there use. `three` is eased by the tier's margin: in Elite the bots stand in for the owner's run until Copy my times
// replaces it. The ghost is the slowest drive that still makes three stars, so it shows the pace a 3-star run needs. Prints each event's `stars` and `tuned` to paste into career.ts.
// `bun scripts/career.ts [ids…] [--write]`: --write saves the ghosts to public/career/.
const RUNS = 5;
const DUEL_SILVER = 1.1;
const WRITE = process.argv.includes("--write");
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const STEP_MS = DT * 1000;
/** Seconds a drive may take: the longest race runs near six minutes, and the slowest car in a class takes longer. */
const DRIVE_LIMIT = 600;

interface Drive {
  label: string;
  ms: number | null;
  frames: number[];
}

// Each body tuned as close under the cap as one part swap at a time gets it, so every cap has a field of real cars: a
// body over the cap first sheds its biggest PI part by part until it fits.
function swaps(build: Build): Build[] {
  return SLOT_NAMES.flatMap((slot) => SLOTS[slot].parts.map((_, i) => ({ ...build, parts: { ...build.parts, [slot]: i } })));
}

function capped(stock: Build, cap: CarClass): Build | null {
  let best = stock;
  while (!within(rating(best).class, cap)) {
    const slower = swaps(best).reduce((low, b) => (rating(b).pi < rating(low).pi ? b : low), best);
    if (slower === best) return null;
    best = slower;
  }
  for (;;) {
    const faster = swaps(best).filter((b) => within(rating(b).class, cap)).reduce((top, b) => (rating(b).pi > rating(top).pi ? b : top), best);
    if (faster === best) return best;
    best = faster;
  }
}

function cars_for(event: CareerEvent): { label: string; build: Build }[] {
  const { car } = event;
  if ("preset" in car) {
    const build = parse_build(PRESETS.find((p) => p.name === car.preset)?.code);
    return build ? [{ label: car.preset, build }] : [];
  }
  const bodies = Object.keys(CARS).flatMap((id) => {
    const build = capped({ ...DEFAULT_BUILD, car: id as Build["car"], parts: { ...DEFAULT_PARTS } }, car.cap);
    return build ? [{ label: `${id} ${rating(build).pi}`, build }] : [];
  });
  const presets = PRESETS.flatMap((p) => {
    const build = parse_build(p.code);
    return build ? [{ label: p.name, build }] : [];
  });
  return [...bodies, ...presets]
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
  }, DRIVE_LIMIT);
  return { label: "", ms: done ? Math.round(clock.elapsed() ?? 0) : null, frames };
}

// A streamed map's plan holds no tiles: the chunks a drive passes and their neighbours are built as the game streams them.
function stream_in(world: World, mesher: TileMesher | null, line: readonly { x: number; z: number }[]) {
  if (!mesher) return;
  const { ext } = world.tiles;
  const need = new Set<number>();
  for (const p of line) {
    const at = chunk_of(p.x, p.z, ext);
    const ci = at % ext.side;
    const cj = Math.floor(at / ext.side);
    for (let j = Math.max(0, cj - 1); j <= Math.min(ext.side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(ext.side - 1, ci + 1); i++) need.add(j * ext.side + i);
  }
  for (const index of need) {
    if (world.tiles.get(index)) continue;
    const { tile, planted } = mesher.build(index);
    world.tiles.add(index, tile);
    world.plant(index, planted.solids);
  }
}

function race_drive(world: World, mesher: TileMesher | null, level: string, build: Build): Drive | null {
  const route = world.routes.find((r) => r.id === level);
  if (!route) return null;
  const course = race_course(route);
  stream_in(world, mesher, course.line);
  const unplace = world.place(route.closure);
  const run = new RaceRun(course, 0);
  const result = drive(world, build, course.line as RoadPoint[], {
    update: ({ x, z }) => (run.update(STEP_MS, x, z), run.status === RaceStatus.DONE),
    elapsed: () => (run.status === RaceStatus.READY ? null : run.elapsed()),
  });
  unplace();
  return result;
}

function duel_drive(world: World, mesher: TileMesher | null, level: string, build: Build): Drive | null {
  const duel = DUEL_LEVELS.find((l) => l.id === level);
  if (!duel) return null;
  const route = build_route(world.seed, world.road, duel, (index) => world.clear_spawn(index));
  stream_in(world, mesher, route.points);
  const run = new DuelRun(route);
  return drive(world, build, route.points as RoadPoint[], {
    update: ({ x, z }) => (run.update(STEP_MS, x, z), run.status === DuelStatus.DONE),
    elapsed: () => (run.status === DuelStatus.READY ? null : run.elapsed()),
  });
}

const round = (frames: number[]) => frames.map((v, i) => (i % 8 === 0 ? v : i % 8 < 4 ? Math.round(v * 100) / 100 : Math.round(v * 1000) / 1000));
const median = (sorted: number[]) => sorted[Math.floor((sorted.length - 1) / 2)];

const BOT_MODES = ["race", "duel"];

interface Unit {
  name: string;
  mode: string;
  level: string;
  /** Only an event's own race ships a ghost; championship stages run without one. */
  ghost: boolean;
}

// A championship's bots drive each of its race and duel stages on the one map; the rest take the owner's run.
function units(event: CareerEvent): Unit[] {
  if (!event.stages) return [{ name: event.id, mode: event.mode, level: spot_of(event).level, ghost: event.mode === "race" }];
  return event.stages.flatMap((stage, i) => (BOT_MODES.includes(stage.mode) ? [{ name: `${event.id} stage ${i + 1}`, mode: stage.mode, level: stage.level, ghost: false }] : []));
}

let failed = 0;
for (const event of EVENTS) {
  const todo = units(event).filter((unit) => BOT_MODES.includes(unit.mode));
  if (ONLY.length ? !ONLY.includes(event.id) : !todo.length) continue;
  const spot = spot_of(event);
  const read = parse_map_code(spot.map);
  if (!read.ok) throw new Error(`${event.id}: map code ${read.why}`);
  const { seed, kind, levels } = read.map;
  const data = build_world(seed, kind, levels).data;
  const world = new World(seed, data, undefined, levels);
  const mesher = world.tiles.streamed ? new TileMesher(data, world.tiles.ext, mesh_tones()) : null;
  const tuned = world_key(seed, kind, levels);
  for (const unit of todo) {
    const drives: Drive[] = [];
    const wall = performance.now();
    for (const { label, build } of cars_for(event)) {
      const run = unit.mode === "race" ? race_drive(world, mesher, unit.level, build) : unit.mode === "duel" ? duel_drive(world, mesher, unit.level, build) : null;
      if (!run) throw new Error(`${unit.name}: ${unit.mode} ${unit.level} has no bot drive`);
      drives.push({ ...run, label });
      console.error(`  ${unit.name} ${label}: ${run.ms === null ? "DNF" : `${run.ms} ms`} (${((performance.now() - wall) / 1000).toFixed(0)} s wall)`);
    }
    const finished = drives.filter((d) => d.ms !== null).sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
    const runs = drives.map((d) => `${d.label} ${d.ms === null ? "DNF" : `${(d.ms / 1000).toFixed(1)}s`}`).join(", ");
    if (!finished.length) {
      failed++;
      console.log(`${unit.name} ${unit.mode} ${unit.level} on ${spot.map}: no bot finished | ${runs}`);
      continue;
    }
    const race = unit.mode === "race";
    const three = Math.ceil(((race ? median(finished.map((d) => d.ms ?? 0)) : (finished[0].ms ?? 0)) * tier_of(event).margin) / 100) * 100;
    const two = Math.round(three * (race || tier_of(event).margin > 1 ? SILVER_SHARE : DUEL_SILVER));
    const ghost = unit.ghost ? (finished.filter((d) => (d.ms ?? Infinity) <= three).at(-1) ?? null) : null;
    const stars = ` stars: { two: ${two}, three: ${three} },`;
    const ghost_note = unit.ghost ? (ghost ? `, ghost: ${ghost.label} ${(ghost.ms ?? 0) / 1000}s` : ", no 3-star ghost") : "";
    console.log(`${unit.name} ${unit.mode} ${unit.level} on ${spot.map}:${stars} tuned: "${tuned}"${ghost_note} | ${runs}`);
    if (WRITE && ghost) {
      const path = new URL(`../public/${ghost_path({ ...event, tuned })}`, import.meta.url);
      mkdirSync(new URL(".", path), { recursive: true });
      writeFileSync(path, JSON.stringify(round(ghost.frames)));
    }
  }
}
if (failed) process.exitCode = 1;
