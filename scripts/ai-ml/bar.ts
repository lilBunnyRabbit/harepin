import { writeFileSync } from "node:fs";
import { Car } from "../../src/car/car";
import { car_spec } from "../../src/car/cars";
import { at_difficulty, Difficulty } from "../../src/ai/difficulty";
import { Field, grid_spot, personalities } from "../../src/ai/field";
import { World } from "../../src/world/world";
import { ROAD_HALF } from "../../src/worldgen/types";
import { CutCheck, LineMeasure, track_side } from "../../src/modes/track-limits";
import { race_course } from "../../src/modes/races";
import { circuits, FIELD_SLACK } from "../ai-race";
import { DT } from "../autolap";
import { Pool, seed_list } from "./cache";

// bun scripts/ai-ml/bar.ts <out.json> <cars,> [eps,] [seeds] [jobs] [difficulty]: the owner's AI bar on island field races, (a) mistakes and (b) ugly failures per car and eps
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

const Kind = { SPIN: "spin", WIDE: "wide", REVERSE: "reverse", RESET: "reset", LONG_OFF: "long_off", PILE: "pile", STUCK: "stuck", PLAYER: "player" } as const;
type Kind = (typeof Kind)[keyof typeof Kind];
const UGLY: readonly Kind[] = [Kind.RESET, Kind.LONG_OFF, Kind.PILE, Kind.STUCK, Kind.PLAYER];

interface Incident {
  t: number;
  car: number;
  kind: Kind;
  rolled: boolean;
}

interface BarRace {
  route: string;
  lap: number;
  finished: number;
  contacts: number;
  mistakes: number;
  rolled: number;
  ugly: number;
  /** Track limits cuts by the AI cars, counted only: no penalty yet. */
  cuts: number;
  counts: Record<Kind, number>;
}

interface BarJob {
  id: string;
  seed: number;
  car: string;
  eps: number;
  difficulty: Difficulty;
}

interface BarResult {
  id: string;
  races: BarRace[];
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

function race(job: BarJob): BarRace[] {
  const world = new World(job.seed);
  const base = car_spec(job.car);
  const ai = base.ai ?? { slow: 1, fast: 1, brake: 1 };
  const off = 1 + job.eps;
  const spec = { ...base, ai: { ...ai, slow: ai.slow * off, fast: ai.fast * off, brake: ai.brake * off } };
  const out: BarRace[] = [];
  for (const route of circuits(world)) {
    if (route.excludes?.includes(spec.id)) continue;
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
        else cuts[k].update(track_side(r.car, world), measure.at(lap, Math.floor(at) - lap * n_points, r.car.pos.x, r.car.pos.z), Math.hypot(r.car.vel.x, r.car.vel.z), dt);
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
    out.push({
      route: route.id,
      lap: fin.length ? fin.reduce((s, r) => s + r.stats.finish, 0) / fin.length / 2 : NaN,
      finished: fin.length,
      contacts: rs.reduce((s, r) => s + r.stats.contacts, 0) / 2,
      mistakes,
      rolled,
      ugly,
      cuts: cuts.reduce((sum, c) => sum + c.cuts, 0),
      counts,
    });
  }
  return out;
}

if (!Bun.isMainThread) {
  self.onmessage = (event: MessageEvent<BarJob>) => postMessage({ id: event.data.id, races: race(event.data) } satisfies BarResult);
} else {
  const [out, cars_arg, eps_arg = "1e-7,1e-6,1e-5", seeds_arg = "0-49", jobs_arg = "10", difficulty = Difficulty.NORMAL] = process.argv.slice(2);
  const cars = cars_arg.split(",");
  const epses = (eps_arg || "1e-7,1e-6,1e-5").split(",").map(Number);
  const seeds = seed_list(seeds_arg || "0-49");
  const jobs: BarJob[] = [];
  for (const car of cars) for (const eps of epses) for (const seed of seeds) jobs.push({ id: `${car}/${eps}/${seed}`, seed, car, eps, difficulty: difficulty as Difficulty });
  const pool = new Pool<BarJob, BarResult>(new URL(import.meta.url), Number(jobs_arg));
  pool.start();
  const rows: Record<string, BarRace[]> = {};
  for (const r of await pool.run(jobs)) rows[r.id] = r.races;
  pool.stop();
  writeFileSync(out, JSON.stringify(rows));
  for (const car of cars) {
    let ugly_50 = 0, per_race = 0, laps = 0, hits = 0, rolled_share = 0;
    for (const eps of epses) {
      const counts: Record<string, number> = {};
      let races = 0, mistakes = 0, rolled = 0, ugly = 0, lap = 0, n = 0, contacts = 0, cut = 0;
      const bad: string[] = [];
      for (const seed of seeds) for (const r of rows[`${car}/${eps}/${seed}`]) {
        races++;
        mistakes += r.mistakes;
        rolled += r.rolled;
        ugly += r.ugly;
        contacts += r.contacts;
        cut += r.cuts ?? 0;
        for (const [k, v] of Object.entries(r.counts)) counts[k] = (counts[k] ?? 0) + v;
        if (Number.isFinite(r.lap)) { lap += r.lap * r.finished; n += r.finished; }
        if (r.ugly) bad.push(`s${seed}${r.route === "circuit" ? "" : "r"}:${UGLY.filter((k) => r.counts[k]).map((k) => `${k}${r.counts[k]}`).join("+")}`);
      }
      console.log(`${car} ${eps}: races ${races} lap ${(lap / n).toFixed(3)} contacts ${contacts} cuts ${cut} (${(cut / races).toFixed(2)}/race) | (a) mistakes ${mistakes} (${(mistakes / races).toFixed(2)}/race, rolled ${rolled}; spin ${counts.spin} wide ${counts.wide} reverse ${counts.reverse}) | (b) ugly ${ugly} (${((ugly * 50) / races).toFixed(2)}/50; reset ${counts.reset} long_off ${counts.long_off} pile ${counts.pile} stuck ${counts.stuck} player ${counts.player}) | ${bad.join(" ")}`);
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
