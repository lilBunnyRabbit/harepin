import { writeFileSync } from "node:fs";
import { Car } from "../../src/car/car";
import type { CarSpec } from "../../src/car/cars";
import { at_difficulty, Difficulty } from "../../src/ai/difficulty";
import { Field, grid_spot, personalities } from "../../src/ai/field";
import { ROAD_HALF } from "../../src/worldgen/types";
import { CutCheck, LineMeasure, track_side } from "../../src/modes/track-limits";
import { race_course } from "../../src/modes/races";
import { circuits, FIELD_SLACK } from "../ai-race";
import { DT } from "../autolap";
import { default_jobs, Pool, seed_list } from "./cache";
import { mean, ORACLE_DIR, oracle_laps, solo_run, type SoloRun } from "./pace";
import { run_ab } from "./ab";
import { bar_spec, run_rows, type BarJob, type BarResult, type RaceJob, type RouteInfo, type Rows, type Setup, type SoloJob, type SoloLaps } from "./bar-rows";
import type { WorldKind } from "../../src/worldgen/types";
import { place_of, world_at } from "./worlds";

// bun scripts/ai-ml/bar.ts <out.json> <cars,> [eps,] [seeds] [jobs] [difficulty] [--world kind] [--solo [--flying n] [--oracles dir]] [--ab <checkout> [--min n]]:
// the owner's AI bar on field races on the island (or `--world` kind's circuits), (a) mistakes and (b) ugly failures per car and eps.
// jobs: from free RAM, at most 6 on any box (the PC froze at 10).
// --solo: each car alone instead, a standing lap then `--flying` laps (2), the standing lap as a share of the best oracle
// lap in `--oracles` (ORACLE_DIR) found on this physics and worldgen (PACE_HASH).
// --ab <checkout>: paired pace A/B, A run from that checkout's bar.ts (one with these job types), B from this one; seeds in batches
// until the 99% interval of B - A excludes 0 (at least `--min` seeds, 6) or the seeds run out. Pace only: the full bar stays the gate.
// The player is a seventh car on the field's own line follower, mid-grid, blind to the cars around it: a hard touch counts
// against the AI unless the player ran into the back of a car ahead.

declare const self: Worker;

/** Seconds off the road past which an excursion is ugly, and seconds past the road's edge before it is a run wide. */
const LONG_OFF = 3;
const OFF_ROAD = 7;
const WIDE_MIN = 0.3;
/** A pile-up: PILE_CARS cars under STOPPED m/s within PILE_SPAN metres of road, past the GRID_TIME seconds the grid stands for. */
const STOPPED = 3;
const PILE_SPAN = 30;
const PILE_CARS = 3;
const GRID_TIME = 6;
/** Seconds inside which ugly events are one incident, and a car's mistakes one visible error. */
const MERGE = 10;
const SAMPLE = 18;
/** The player's grid slot, the closing m/s past which a touch on it is hard, and the metres ahead from which the car it touched was run into. */
const PLAYER_SLOT = 3;
const HARD_HIT = 4;
const RUN_INTO = 2;
/** Seconds the player is off the road or stopped before it is put back, and seconds after in which its touches do not count. */
const PLAYER_LOST = 4;
const PLAYER_GRACE = 3;
/** Road points after a mistake's start in which an error counts as the rolled one: its span and the slide after it. */
const ROLLED_SPAN = 90;
const FLYING = 2;
const MIN_PAIRS = 6;
const VALUED = ["--flying", "--ab", "--min", "--oracles", "--world"];

const Kind = { SPIN: "spin", WIDE: "wide", REVERSE: "reverse", RESET: "reset", LONG_OFF: "long_off", PILE: "pile", STUCK: "stuck", PLAYER: "player" } as const;
type Kind = (typeof Kind)[keyof typeof Kind];
const UGLY: readonly Kind[] = [Kind.RESET, Kind.LONG_OFF, Kind.PILE, Kind.STUCK, Kind.PLAYER];

interface Incident {
  t: number;
  car: number;
  kind: Kind;
  rolled: boolean;
}

export interface BarRace {
  route: string;
  lap: number;
  finished: number;
  contacts: number;
  mistakes: number;
  rolled: number;
  ugly: number;
  /** Track limits cuts by the AI cars, counted only: no penalty yet. */
  cuts: number;
  /** Metres an AI car sat off the path it drives (the line, or `aside` off it): summed, sampled and the most, physics only. */
  off_sum?: number;
  off_n?: number;
  off_max?: number;
  counts: Record<Kind, number>;
}

interface Rolls {
  mistake_at: number;
  index: number;
  line: { road: { length: number } };
}

function rolling(driver: unknown): boolean {
  const d = driver as Rolls;
  const n = d.line.road.length;
  return d.mistake_at >= 0 && (((d.index - d.mistake_at) % n) + n) % n < ROLLED_SPAN;
}

function perturbed(car: string, eps: number): CarSpec {
  const base = bar_spec(car);
  const ai = base.ai ?? { slow: 1, fast: 1, brake: 1 };
  const off = 1 + eps;
  return { ...base, ai: { ...ai, slow: ai.slow * off, fast: ai.fast * off, brake: ai.brake * off } };
}

function race(job: RaceJob): BarRace {
  const world = world_at(job.seed, job.world);
  const spec = perturbed(job.car, job.eps);
  const route = circuits(world)[job.route];
  const unplace = world.place(route.closure);
  const field = new Field(world, route, Array.from({ length: 6 }, () => spec), at_difficulty(personalities(job.seed, 6), job.difficulty), job.seed, PLAYER_SLOT);
  const player = new Car(spec);
  const spot = grid_spot(route, PLAYER_SLOT);
  player.park(spot.x, spot.z, spot.heading, world);
  field.rival = player;
  field.drives_rival = true;
  const me = field.racers.length;
  let lost = 0;
  let grace = 0;
  let plan = 0;
  for (let i = 0; i < field.line.step.length; i++) plan += field.line.step[i] / field.line.speed[i];
  const limit = plan * 2 * FIELD_SLACK + 30;
  const rs = field.racers;
  const spacing = route.length / route.points.length;
  const measure = new LineMeasure(race_course(route).line);
  const cuts = rs.map(() => new CutCheck(measure, route.gate_hw));
  const n_points = route.points.length;
  const seen = rs.map(() => ({ spins: 0, resets: 0, reverses: 0, off: 0, wide: 0, long: false }));
  const events: Incident[] = [];
  let piled = false;
  let steps = 0;
  let off_sum = 0;
  let off_n = 0;
  let off_max = 0;
  const done = () => rs.every((r) => r.stats.laps.length >= 2);
  while (field.t < limit && !done()) {
    player.step(DT, field.rival_controls(DT), world);
    world.collide(player);
    field.step(DT, 2);
    if (field.impacts[me] > HARD_HIT && field.t > grace) {
      grace = field.t + PLAYER_GRACE;
      let near = -1;
      let near_d = Infinity;
      rs.forEach((r, k) => {
        const d = Math.hypot(r.car.pos.x - player.pos.x, r.car.pos.z - player.pos.z);
        if (d < near_d) {
          near_d = d;
          near = k;
        }
      });
      if ((rs[near].driver.progress - field.progress[me]) * spacing < RUN_INTO) events.push({ t: field.t, car: near, kind: Kind.PLAYER, rolled: false });
    }
    if (++steps % SAMPLE) continue;
    const dt = DT * SAMPLE;
    const adrift = world.distance_to_road(player.pos.x, player.pos.z) > OFF_ROAD || (field.t > GRID_TIME && Math.hypot(player.vel.x, player.vel.z) < STOPPED);
    lost = adrift ? lost + dt : 0;
    if (lost > PLAYER_LOST) {
      const n = route.points.length;
      const p = route.points[((Math.round(field.progress[me]) % n) + n) % n];
      player.park(p.x, p.z, Math.atan2(p.tx, p.tz), world);
      player.parked = false;
      lost = 0;
      grace = field.t + PLAYER_GRACE;
    }
    let pile = 0;
    rs.forEach((r, k) => {
      const s = seen[k];
      const add = (kind: Kind) => events.push({ t: field.t, car: k, kind, rolled: rolling(r.driver) });
      if (r.stats.spins > s.spins) add(Kind.SPIN);
      if (r.stats.reverses > s.reverses) add(Kind.REVERSE);
      const reset = r.stats.resets > s.resets;
      if (reset) add(Kind.RESET);
      const at = Math.max(0, r.driver.progress);
      const lap = Math.floor(at / n_points);
      if (reset) cuts[k].reset();
      else cuts[k].update(track_side(r.car, world), measure.at(lap, Math.floor(at) - lap * n_points, r.car.pos.x, r.car.pos.z), r.car.pos.x, r.car.pos.z, Math.hypot(r.car.vel.x, r.car.vel.z), dt);
      if (!reset && !field.is_coasting(k) && r.stats.laps.length < 2 && field.t > GRID_TIME) {
        const here = field.line.road[r.driver.index];
        const side = Math.abs((r.car.pos.x - here.x) * here.tz - (r.car.pos.z - here.z) * here.tx - r.driver.lateral_at(r.car, r.driver.index));
        off_sum += side;
        off_n++;
        off_max = Math.max(off_max, side);
      }
      s.spins = r.stats.spins;
      s.reverses = r.stats.reverses;
      s.resets = r.stats.resets;
      const d = world.distance_to_road(r.car.pos.x, r.car.pos.z);
      s.off = d > OFF_ROAD && !reset ? s.off + dt : 0;
      if (s.off > LONG_OFF && !s.long) add(Kind.LONG_OFF);
      s.long = s.off > LONG_OFF;
      const wide = d > ROAD_HALF && !reset ? s.wide + dt : 0;
      if (wide >= WIDE_MIN && s.wide < WIDE_MIN) add(Kind.WIDE);
      s.wide = wide;
      if (field.t < GRID_TIME || r.stats.laps.length >= 2 || Math.hypot(r.car.vel.x, r.car.vel.z) > STOPPED) return;
      let near = 0;
      for (const o of rs) if (o.stats.laps.length < 2 && Math.hypot(o.car.vel.x, o.car.vel.z) <= STOPPED && Math.abs(o.driver.progress - r.driver.progress) * spacing < PILE_SPAN) near++;
      pile = Math.max(pile, near);
    });
    if (pile >= PILE_CARS && !piled) events.push({ t: field.t, car: -1, kind: Kind.PILE, rolled: false });
    piled = pile >= PILE_CARS;
  }
  if (!done()) events.push({ t: field.t, car: -1, kind: Kind.STUCK, rolled: false });
  unplace();
  const counts = Object.fromEntries(Object.values(Kind).map((k) => [k, 0])) as Record<Kind, number>;
  for (const e of events) counts[e.kind]++;
  const bad = events.filter((e) => UGLY.includes(e.kind));
  let ugly = 0;
  let last = -Infinity;
  for (const e of bad) {
    if (e.t - last > MERGE) ugly++;
    last = e.t;
  }
  // A mistake is the car's own and over by itself: one that runs into an ugly event, or sits in a pile-up, is that event.
  const own = events.filter((e) => !UGLY.includes(e.kind) && !bad.some((b) => (b.car === e.car || b.car < 0) && Math.abs(b.t - e.t) <= MERGE));
  let mistakes = 0;
  let rolled = 0;
  const at = rs.map(() => -Infinity);
  for (const e of own) {
    if (e.t - at[e.car] > MERGE) {
      mistakes++;
      if (e.rolled) rolled++;
    }
    at[e.car] = e.t;
  }
  const fin = rs.filter((r) => Number.isFinite(r.stats.finish));
  return {
    route: route.id,
    lap: fin.length ? fin.reduce((s, r) => s + r.stats.finish, 0) / fin.length / 2 : NaN,
    finished: fin.length,
    contacts: rs.reduce((s, r) => s + r.stats.contacts, 0) / 2,
    mistakes,
    rolled,
    ugly,
    cuts: cuts.reduce((sum, c) => sum + c.cuts, 0),
    off_sum,
    off_n,
    off_max,
    counts,
  };
}

function routes(seed: number, kind?: WorldKind): RouteInfo[] {
  return circuits(world_at(seed, kind)).map((r) => ({ id: r.id, length: r.length, excludes: r.excludes ?? [] }));
}

function solo(job: SoloJob): SoloLaps {
  const world = world_at(job.seed, job.world);
  const route = circuits(world)[job.route];
  const unplace = world.place(route.closure);
  const run = solo_run(world, route, perturbed(job.car, job.eps), job.flying);
  unplace();
  return run;
}

const races_of = (rows: Rows): Record<string, BarRace[]> => Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.filter((r): r is BarRace => "ugly" in r)]));

function solos_of(rows: Rows, oracles: Map<string, number>, kind?: WorldKind): Record<string, SoloRun[]> {
  return Object.fromEntries(
    Object.entries(rows).map(([key, v]) => {
      const [car, , seed] = key.split("/");
      return [key, v.filter((r): r is SoloLaps => "flying" in r).map((r): SoloRun => ({ ...r, oracle: oracles.get(`${place_of(Number(seed), kind)}/${r.route}/${car}`) ?? null }))];
    }),
  );
}

function print_bar(rows: Record<string, BarRace[]>, setup: Setup, seeds: readonly number[]) {
  const { cars, epses } = setup;
  for (const car of cars) {
    let ugly_50 = 0, per_race = 0, laps = 0, hits = 0, rolled_share = 0;
    for (const eps of epses) {
      const counts: Record<string, number> = {};
      let races = 0, mistakes = 0, rolled = 0, ugly = 0, lap = 0, n = 0, contacts = 0, cut = 0, off_sum = 0, off_n = 0, off_max = 0;
      const bad: string[] = [];
      for (const seed of seeds) for (const r of rows[`${car}/${eps}/${seed}`]) {
        races++;
        mistakes += r.mistakes;
        rolled += r.rolled;
        ugly += r.ugly;
        contacts += r.contacts;
        cut += r.cuts ?? 0;
        off_sum += r.off_sum ?? 0;
        off_n += r.off_n ?? 0;
        off_max = Math.max(off_max, r.off_max ?? 0);
        for (const [k, v] of Object.entries(r.counts)) counts[k] = (counts[k] ?? 0) + v;
        if (Number.isFinite(r.lap)) { lap += r.lap * r.finished; n += r.finished; }
        if (r.ugly) bad.push(`s${seed}${r.route === "circuit" ? "" : "r"}:${UGLY.filter((k) => r.counts[k]).map((k) => `${k}${r.counts[k]}`).join("+")}`);
      }
      console.log(`${car} ${eps}: races ${races} lap ${(lap / n).toFixed(3)} contacts ${contacts} cuts ${cut} (${(cut / races).toFixed(2)}/race) off line ${(off_sum / Math.max(1, off_n)).toFixed(3)} max ${off_max.toFixed(2)} m | (a) mistakes ${mistakes} (${(mistakes / races).toFixed(2)}/race, rolled ${rolled}; spin ${counts.spin} wide ${counts.wide} reverse ${counts.reverse}) | (b) ugly ${ugly} (${((ugly * 50) / races).toFixed(2)}/50; reset ${counts.reset} long_off ${counts.long_off} pile ${counts.pile} stuck ${counts.stuck} player ${counts.player}) | ${bad.join(" ")}`);
      ugly_50 += (ugly * 50) / races;
      per_race += mistakes / races;
      rolled_share += mistakes ? rolled / mistakes : 0;
      laps += lap / n;
      hits += contacts;
    }
    const m = epses.length;
    console.log(`MEAN ${car}: (a) mistakes ${(per_race / m).toFixed(2)}/race rolled ${((100 * rolled_share) / m).toFixed(0)}% | (b) ugly ${(ugly_50 / m).toFixed(2)}/50 races | lap ${(laps / m).toFixed(3)} contacts ${(hits / m).toFixed(0)}`);
  }
}

function print_solo(rows: Record<string, SoloRun[]>, setup: Setup, seeds: readonly number[]) {
  for (const car of setup.cars)
    for (const eps of setup.epses) {
      const runs = seeds.flatMap((seed) => rows[`${car}/${eps}/${seed}`]);
      const done = runs.filter((r) => r.done);
      const shares = runs.flatMap((r) => (r.oracle !== null && Number.isFinite(r.standing) ? [r.oracle / r.standing] : []));
      const stopped = runs.filter((r) => !r.done);
      console.log(
        `${car} ${eps}: solo runs ${runs.length} standing ${mean(done.map((r) => r.standing)).toFixed(3)} flying ${mean(done.flatMap((r) => r.flying)).toFixed(3)} | oracle share ${shares.length ? `${(100 * mean(shares)).toFixed(2)}% on ${shares.length}` : "none on record"} | off-road ${runs.reduce((s, r) => s + r.offroad, 0).toFixed(1)} s | stopped ${stopped.length}${stopped.length ? ` (${stopped.map((r) => r.route).join(" ")})` : ""}`,
      );
    }
}

if (!Bun.isMainThread) {
  self.onmessage = (event: MessageEvent<BarJob>) => {
    const job = event.data;
    if (job.type === "routes") postMessage({ type: "routes", id: job.id, routes: routes(job.seed, job.world) } satisfies BarResult);
    else if (job.type === "solo") postMessage({ type: "solo", id: job.id, run: solo(job) } satisfies BarResult);
    else postMessage({ type: "race", id: job.id, race: race(job) } satisfies BarResult);
  };
} else {
  const argv = process.argv.slice(2);
  const option = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUED.includes(argv[i - 1]));
  const [out, cars_arg, eps_arg = "1e-7,1e-6,1e-5", seeds_arg = "0-49", jobs_arg = "", difficulty = Difficulty.NORMAL] = positional;
  const setup: Setup = {
    cars: cars_arg.split(","),
    epses: (eps_arg || "1e-7,1e-6,1e-5").split(",").map(Number),
    difficulty: difficulty as Difficulty,
    solo: argv.includes("--solo"),
    flying: Number(option("flying") ?? FLYING),
    world: option("world") as WorldKind | undefined,
  };
  const seeds = seed_list(seeds_arg || "0-49");
  const jobs = jobs_arg ? Number(jobs_arg) : default_jobs();
  const other = option("ab");
  const oracles = setup.solo ? oracle_laps(option("oracles") ?? ORACLE_DIR) : new Map<string, number>();
  const shape = (rows: Rows) => (setup.solo ? solos_of(rows, oracles, setup.world) : races_of(rows));
  const print = (rows: Rows, of: readonly number[]) => (setup.solo ? print_solo(solos_of(rows, oracles, setup.world), setup, of) : print_bar(races_of(rows), setup, of));
  if (other) {
    const ab = await run_ab(other, seeds, setup, jobs, Number(option("min") ?? MIN_PAIRS));
    writeFileSync(out, JSON.stringify({ a: shape(ab.a), b: shape(ab.b), seeds: ab.seeds, looks: ab.looks, verdict: ab.verdict }));
    console.log("A:");
    print(ab.a, ab.seeds);
    console.log("B:");
    print(ab.b, ab.seeds);
  } else {
    const pool = new Pool<BarJob, BarResult>(new URL(import.meta.url), jobs);
    pool.start();
    const rows = await run_rows(pool, seeds, setup);
    pool.stop();
    writeFileSync(out, JSON.stringify(shape(rows)));
    print(rows, seeds);
  }
}
