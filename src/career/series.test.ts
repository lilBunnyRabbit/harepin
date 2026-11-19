import { expect, test } from "bun:test";
import { World } from "../world/world";
import { DEFAULT_BUILD, DEFAULT_PARTS, parse_build, type Build } from "../car/build";
import { PRESETS } from "../car/presets";
import { same_machine, within } from "../car/car-pick";
import { RivalPick, field_builds } from "../ai/field-pick";
import { rating } from "../car/pi";
import { CREDITS_PER_POINT, FINAL_FACTOR } from "./credits";
import { Bonus, OPEN_AT_START, PODIUM, SeriesKind, better, car_fault, empty_progress, loaner_code, stock_build, trophy_of, event_field, event_line, event_result, event_states, grid_slot, next_open, parse_progress, player_of, result_points, season_done, season_round, standings, type EventResult, type Season, type SeriesProgress } from "./series";
import type { SeriesSaves } from "./series-db";
import { series_ticket } from "./series-run";
import { RALLY_TRIAL, SEASON_1, SEASON_4, SEASONS, SERIES_LIST, completed, seasons_open, series_event } from "./series-seasons";
import { build_world, KINDS, plain_map } from "../worldgen/kinds/kinds";
import { field_races } from "../modes/field-route";
import type { WorldKind } from "../worldgen/types";
import { MAX_LAPS } from "../modes/race-laps";
import { Series, series_blocker, series_front, series_list, series_open } from "./series-store";
import { BASE_CAR, Wallet } from "./wallet";
import { car_shelves } from "../car/car-pick";

const season = SEASON_1;
const YOU = player_of(season);
const field = season.field.map((_, i) => i);
const at = (place: number): EventResult => {
  const order = [...field];
  order.splice(place - 1, 0, YOU);
  return { order, bonus: [] };
};
const cup_at = (cup: Season, place: number): EventResult => {
  const order = cup.field.map((_, i) => i);
  order.splice(place - 1, 0, player_of(cup));
  return { order, bonus: [] };
};

// IndexedDB stores a structured clone, so the fake does too.
function memory(): SeriesSaves & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return { data, load: async (id) => structuredClone(data.get(id)), save: async (p) => void data.set(p.season, structuredClone(p)) };
}

const worlds = new Map<string, World>();
function world_of(kind: WorldKind, seed: number): World {
  const key = `${kind}:${seed}`;
  let world = worlds.get(key);
  if (!world) {
    const map = plain_map(kind, seed);
    world = new World(seed, build_world(seed, kind, map.levels).data, undefined, map.levels);
    worlds.set(key, world);
  }
  return world;
}

/** The longest lap a race may run on: past it the game's one lap is the whole race, well over D4's four minutes. */
const PAR_MAX_MS = 450_000;
/** A quick lap as a share of par: series-race's AI fields lap the town loop in about 0.73 of it. */
const FAST_LAP = 0.6;

for (const each of SERIES_LIST) {
  test(`${each.name}: every event's route, and every replay seed's, is closed on its world, a lap within ${PAR_MAX_MS / 1000} s`, () => {
    const routes = new Set(each.events.map((e) => e.route));
    const check = (seed: number, id: string) => {
      const route = world_of(each.world, seed).routes.find((r) => r.id === id);
      expect(route?.closed).toBe(true);
      expect(field_races(route!, world_of(each.world, seed).tiles.streamed, KINDS[each.world].rails)).toBe(true);
      expect(route!.par_ms).toBeLessThanOrEqual(PAR_MAX_MS);
    };
    for (const event of each.events) {
      check(event.seed, event.route);
      // A timed race runs MAX_LAPS: a car lapping well under par must not reach the line before the clock ends it.
      const par = world_of(each.world, event.seed).routes.find((r) => r.id === event.route)!.par_ms;
      if (event.limit_ms) expect(MAX_LAPS * par * FAST_LAP).toBeGreaterThanOrEqual(event.limit_ms);
    }
    for (const seed of each.replays) for (const id of routes) check(seed, id);
  }, 180_000);
}

test("seasons run Island, Alpine, Dunes, Mainland: six events each, every first-season kind, the final last", () => {
  expect(SEASONS.map((s) => s.name)).toEqual(["Island", "Alpine", "Dunes", "Mainland"]);
  const ids = SEASONS.flatMap((s) => s.events.map((e) => e.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(SEASONS.map((s) => s.id)).size).toBe(SEASONS.length);
  for (const each of SEASONS) {
    expect(each.events.length).toBe(6);
    expect(each.events.filter((e) => e.final)).toEqual([each.events.at(-1)!]);
    expect(new Set(each.events.map((e) => e.kind))).toEqual(new Set(Object.values(SeriesKind)));
    expect(each.field.length).toBe(6);
    // G2: the field drives presets of the player's class; a cap with none of its own fields cars under it.
    expect(PRESETS.some((preset) => rating(parse_build(preset.code)!).class === each.cap)).toBe(true);
    expect(each.rival).toBeLessThan(each.field.length);
    for (const e of each.events) expect(e.id.startsWith(`${each.id}-`)).toBe(true);
    for (const e of each.events) expect(e.kind === SeriesKind.ENDURANCE).toBe(e.limit_ms !== undefined);
    expect(series_event(each.events[2].id)?.season).toBe(each);
    expect(new Set(season_round(each, 1).events.map((e) => e.seed)).size).toBe(each.events.length);
  }
  expect(SEASON_4.events.some((e) => e.route === "town")).toBe(true);
});

test("each later season races a field at least as sharp, under a cap no lower, its rival from the season before in it", () => {
  const sum = (s: Season) => s.field.reduce((n, d) => n + d.aggression - d.mistakes, 0);
  for (let i = 1; i < SEASONS.length; i++) {
    const [was, now] = [SEASONS[i - 1], SEASONS[i]];
    expect(sum(now)).toBeGreaterThanOrEqual(sum(was));
    expect(within(was.cap, now.cap)).toBe(true);
    expect(now.field.map((d) => d.name)).toContain(was.field[was.rival].name);
    expect(now.reward.credits).toBeGreaterThan(was.reward.credits);
  }
  expect(new Set(SEASONS.map((s) => s.reward.car)).size).toBe(SEASONS.length);
});

test("a season opens once the one before has been completed, and a replay of it under way keeps it open", () => {
  const done = (s: Season): SeriesProgress => ({ season: s.id, round: 0, results: { [s.events.at(-1)!.id]: { order: [player_of(s), 0], bonus: [] } } });
  const fresh = SEASONS.map((s) => completed(s, empty_progress(s)));
  expect(seasons_open(SEASONS, fresh)).toEqual([true, false, false, false]);
  expect(completed(SEASON_1, done(SEASON_1))).toBe(true);
  expect(completed(SEASON_1, empty_progress(SEASON_1, 1))).toBe(true);
  expect(seasons_open(SEASONS, [true, false, false, false])).toEqual([true, true, false, false]);
  expect(seasons_open(SEASONS, [true, true, true, true])).toEqual([true, true, true, true]);
  expect(seasons_open(SEASONS, [false, true, false, false])).toEqual([true, false, true, false]);
  // A cup stands outside the chain: open from the start, and finishing it opens no season.
  expect(seasons_open(SERIES_LIST, [false, false, false, false, false])).toEqual([true, true, false, false, false]);
  expect(seasons_open(SERIES_LIST, [true, false, false, false, false])).toEqual([true, true, false, false, false]);
  expect(seasons_open(SERIES_LIST, [false, true, false, false, false])).toEqual([true, true, true, false, false]);
});

test("events open three at a time, a podium opens the next, the final last", () => {
  const fresh = event_states(season, empty_progress(season));
  expect(fresh.filter((s) => s === "open").length).toBe(OPEN_AT_START);
  expect(fresh.at(-1)).toBe("locked");
  const one: SeriesProgress = { season: season.id, round: 0, results: { [season.events[0].id]: at(PODIUM) } };
  expect(event_states(season, one)).toEqual(["podium", "open", "open", "open", "locked", "locked"]);
  const off: SeriesProgress = { season: season.id, round: 0, results: { [season.events[0].id]: at(PODIUM + 1) } };
  expect(event_states(season, off)[0]).toBe("open");
  const all = Object.fromEntries(season.events.slice(0, -1).map((e) => [e.id, at(1)]));
  expect(event_states(season, { season: season.id, round: 0, results: all }).at(-1)).toBe("open");
  expect(season_done(season, { season: season.id, round: 0, results: all })).toBe(false);
  expect(season_done(season, { season: season.id, round: 0, results: { ...all, [season.events[5].id]: at(2) } })).toBe(true);
});

test("points by place plus the player's bonuses; the table sums every event", () => {
  const win: EventResult = { ...at(1), bonus: [Bonus.CLEAN, Bonus.FROM_BACK] };
  const opener = season.events[0];
  expect(result_points(season, opener, win, YOU)).toBe(10 + 2 + 2);
  expect(result_points(season, opener, win, 0)).toBe(8);
  const table = standings(season, { season: season.id, round: 0, results: { a: win, [season.events[0].id]: win, [season.events[1].id]: at(7) } });
  expect(table.find((row) => row.you)?.points).toBe(14 + 2);
  expect(table[0].points).toBeGreaterThanOrEqual(table[1].points);
});

test("a retry replaces an event's run only when it scores the player more", () => {
  const series = new Series(season, memory(), new Wallet(null));
  const event = season.events[0];
  expect(series.record(event, at(4)).kept).toBe(true);
  expect(series.record(event, at(5)).kept).toBe(false);
  expect(series.record(event, at(2)).kept).toBe(true);
  expect(better(season, event, at(2), at(2))).toBe(false);
});

test("stored progress is checked: junk drops out, good results survive a reload", async () => {
  const store = memory();
  new Series(season, store, new Wallet(null)).record(season.events[0], { order: at(1).order, bonus: [Bonus.LED] });
  const again = new Series(season, store, new Wallet(null));
  expect(again.ready).toBe(false);
  await again.load();
  expect(again.ready).toBe(true);
  expect(again.progress.results[season.events[0].id]?.bonus).toEqual([Bonus.LED]);
  store.data.set(season.id, "not progress");
  const bad = new Series(season, store, new Wallet(null));
  await bad.load();
  expect(bad.progress.results).toEqual({});
  const refused = new Series(season, { load: () => Promise.reject(new Error("blocked")), save: async () => {} }, new Wallet(null));
  await refused.load();
  expect(refused.ready).toBe(true);
  expect(refused.progress.results).toEqual({});
  const junk = { season: season.id, round: 0, results: { [season.events[0].id]: { order: [9, 9] }, [season.events[1].id]: { order: [0, 1] }, [season.events[2].id]: { order: [YOU, 0], bonus: ["nope", Bonus.CLEAN] } } };
  const read = parse_progress(season, junk);
  expect(Object.keys(read.results)).toEqual([season.events[2].id]);
  expect(read.results[season.events[2].id].bonus).toEqual([Bonus.CLEAN]);
  expect(parse_progress(season, { season: "other", results: {} }).results).toEqual({});
});

test("a head to head maps the race's two cars onto the rival and the player", () => {
  const duel = season.events.find((e) => e.kind === SeriesKind.HEAD_TO_HEAD)!;
  const result = event_result(season, duel, [season.rival], { order: [1, 0], clean: true, led: true, fastest: false, from_back: true });
  expect(result.order).toEqual([YOU, season.rival]);
  expect(result.bonus).toEqual([Bonus.CLEAN, Bonus.LED, Bonus.FROM_BACK]);
  const lost = event_result(season, duel, [season.rival], { order: [0, 1], clean: false, led: false, fastest: true, from_back: true });
  expect(lost.bonus).toEqual([]);
  expect(event_line(season, duel, lost)).toContain("the rival");
});

test("the rival duel opens the next event only on a win, and its loss scores 4", () => {
  const duel = season.events.find((e) => e.kind === SeriesKind.HEAD_TO_HEAD)!;
  const lost: EventResult = { order: [season.rival, YOU], bonus: [] };
  const won: EventResult = { order: [YOU, season.rival], bonus: [] };
  expect(result_points(season, duel, lost, YOU)).toBe(4);
  expect(result_points(season, duel, lost, season.rival)).toBe(10);
  const i = season.events.indexOf(duel);
  expect(event_states(season, { season: season.id, round: 0, results: { [duel.id]: lost } })[i]).not.toBe("podium");
  expect(event_states(season, { season: season.id, round: 0, results: { [duel.id]: won } })[i]).toBe("podium");
});

test("fastest lap pays only in endurance, the one event of more than a lap", () => {
  const outcome = { order: [6, 0, 1, 2, 3, 4, 5], clean: false, led: false, fastest: true, from_back: false };
  for (const event of season.events) expect(event_result(season, event, event_field(season, event, empty_progress(season)), outcome).bonus.includes(Bonus.FASTEST)).toBe(event.kind === SeriesKind.ENDURANCE);
});

test("the player grids by the table: last on a fresh season, on pole once leading it", () => {
  const opener = season.events[0];
  expect(grid_slot(season, empty_progress(season), opener)).toBe(event_field(season, opener, empty_progress(season)).length);
  const won: SeriesProgress = { season: season.id, round: 0, results: { [opener.id]: at(1) } };
  expect(grid_slot(season, won, season.events[1])).toBe(0);
  const third: SeriesProgress = { season: season.id, round: 0, results: { [opener.id]: at(3) } };
  expect(grid_slot(season, third, season.events[1])).toBe(2);
});

test("the field grids and scores in the table's order", () => {
  const opener = season.events[0];
  const next = season.events[1];
  expect(event_field(season, next, empty_progress(season))).toEqual(season.field.map((_, i) => i));
  const progress: SeriesProgress = { season: season.id, round: 0, results: { [opener.id]: { order: [5, 3, player_of(season), 0, 1, 2, 4], bonus: [] } } };
  const field = event_field(season, next, progress);
  expect(field.slice(0, 2)).toEqual([5, 3]);
  expect(grid_slot(season, progress, next)).toBe(2);
  const result = event_result(season, next, field, { order: [0, 1, 6, 2, 3, 4, 5], clean: false, led: false, fastest: false, from_back: false });
  expect(result.order.slice(0, 2)).toEqual([5, 3]);
});

test("a podium beats a better-scoring run off the podium, so bonuses never cost an event its opening", () => {
  const event = season.events[0];
  const fourth: EventResult = { ...at(PODIUM + 1), bonus: [Bonus.CLEAN, Bonus.LED] };
  expect(result_points(season, event, fourth, YOU)).toBeGreaterThan(result_points(season, event, at(PODIUM), YOU));
  expect(better(season, event, at(PODIUM), fourth)).toBe(true);
  expect(better(season, event, fourth, at(PODIUM))).toBe(false);
});

test("a replay round races new seeds against a sharper field, within the 1-5 levels", () => {
  expect(season_round(season, 0)).toBe(season);
  const one = season_round(season, 1);
  const seeds = one.events.map((e) => e.seed);
  expect(new Set(seeds).size).toBe(seeds.length);
  for (const seed of seeds) expect(season.events.map((e) => e.seed)).not.toContain(seed);
  expect(season_round(season, 2).events.map((e) => e.seed)).not.toEqual(seeds);
  expect(one.events.map((e) => e.id)).toEqual(season.events.map((e) => e.id));
  one.field.forEach((d, i) => {
    expect(d.mistakes).toBe(Math.max(1, season.field[i].mistakes - 1));
    expect(d.aggression).toBe(Math.min(5, season.field[i].aggression + 1));
  });
  for (const d of season_round(season, 9).field) expect([d.aggression, d.mistakes]).toEqual([5, 1]);
});

test("only the player's own cars race, under the season's class cap", () => {
  const stock: Build = { ...DEFAULT_BUILD, parts: { ...DEFAULT_PARTS } };
  expect(rating(stock).class).toBe(season.cap);
  expect(car_fault(season, stock, [BASE_CAR])).toBeNull();
  expect(car_fault(season, { ...stock, car: "coupe" }, [BASE_CAR])).toContain("own cars only");
  const tuned: Build = { ...stock, parts: { ...stock.parts, engine: 3, tyres: 3, aero: 3, weight: 3 } };
  expect(within(rating(tuned).class, season.cap)).toBe(false);
  expect(car_fault(season, tuned, [BASE_CAR])).toContain("Class C or below");
  expect(car_fault(season, { ...stock, car: season.reward.car }, [BASE_CAR, season.reward.car])).toBeNull();
});

test("the series car picker greys what car_fault refuses", () => {
  const series = new Series(season, memory(), new Wallet(null));
  const shelves = car_shelves(DEFAULT_BUILD, [], PRESETS, series.car_limit());
  const cars = shelves.flatMap((shelf) => shelf.choices);
  expect(cars.some((c) => c.blocked === null)).toBe(true);
  for (const car of cars) expect(car.blocked === null).toBe(series.car_fault(car.build) === null);
});

test("every finish pays credits, the final double; completing the season pays its reward once and replays on new seeds", async () => {
  const store = memory();
  const wallet = new Wallet(null);
  const series = new Series(season, store, wallet);
  const [opener, ...rest] = season.events;
  expect(series.record(opener, at(1)).credits).toBe(10 * CREDITS_PER_POINT);
  expect(series.record(opener, at(7)).credits).toBe(2 * CREDITS_PER_POINT);
  expect(wallet.credits).toBe(12 * CREDITS_PER_POINT);
  for (const event of rest.slice(0, -1)) series.record(event, at(1));
  const final = season.events.at(-1)!;
  const lost = series.record(final, at(PODIUM + 1));
  expect(lost.season_credits).toBe(0);
  expect(lost.credits).toBe(5 * CREDITS_PER_POINT * FINAL_FACTOR);
  const before = wallet.credits;
  const won = series.record(final, at(1));
  expect(won).toEqual({ kept: true, credits: 10 * CREDITS_PER_POINT * FINAL_FACTOR, season_credits: season.reward.credits, car: season.reward.car, trophy: "Winner's cup" });
  expect(wallet.credits).toBe(before + won.credits + season.reward.credits);
  expect(wallet.owns(season.reward.car)).toBe(true);
  expect(series.record(final, at(1)).season_credits).toBe(0);
  series.reset();
  expect(series.progress.round).toBe(1);
  expect(series.season.events[0].seed).toBe(season_round(season, 1).events[0].seed);
  const reload = new Series(season, store, new Wallet(null));
  await reload.load();
  expect(reload.progress.round).toBe(1);
  expect(reload.event(opener.id)?.seed).toBe(season.replays[0]);
  for (const event of season.events.slice(0, -1)) series.record(event, at(1));
  expect(series.record(final, at(1))).toEqual({ kept: true, credits: 10 * CREDITS_PER_POINT * FINAL_FACTOR, season_credits: 0, car: null, trophy: null });
  series.reset();
  series.record(opener, at(2));
  series.reset();
  expect(series.progress.round).toBe(2);
  expect(series.progress.results).toEqual({});
});

test("stored rounds are checked: a bad one reads as the first run", () => {
  expect(parse_progress(season, { season: season.id, round: 2, results: {} }).round).toBe(2);
  for (const round of [-1, 1.5, "2", null]) expect(parse_progress(season, { season: season.id, round, results: {} }).round).toBe(0);
  expect(parse_progress(season, { season: season.id, results: {} }).round).toBe(0);
});

test("the seasons share one wallet read; the page opens on the first open season not yet done", async () => {
  const store = memory();
  let reads = 0;
  const wallet = new Wallet({ load: async () => (reads++, undefined), save: async () => {} });
  const list = series_list(store, wallet);
  await Promise.all(list.map((one) => one.load()));
  expect(reads).toBe(1);
  // The Rally Trial leads, open beside the first season; a new player starts on it.
  expect(list.map((one) => one.base)).toEqual([...SERIES_LIST]);
  expect(series_open(list)).toEqual([true, true, false, false, false]);
  expect(series_front(list)).toBe(0);
  for (const event of RALLY_TRIAL.events) list[0].record(event, cup_at(RALLY_TRIAL, 6));
  expect(series_open(list)).toEqual([true, true, false, false, false]);
  expect(series_front(list)).toBe(1);
  for (const event of SEASON_1.events) list[1].record(event, at(1));
  expect(series_open(list)).toEqual([true, true, true, false, false]);
  expect(series_front(list)).toBe(2);
  list[1].reset();
  expect(series_open(list)).toEqual([true, true, true, false, false]);
  expect(series_front(list)).toBe(1);
  expect(series_blocker(list, 0)).toBeNull();
  expect(series_blocker(list, 1)).toBeNull();
  expect(series_blocker(list, 2)).toBe(SEASON_1);
});

test("Next after a result is the first open event after it, then one before it, none once all are run", () => {
  const [first, second, third] = season.events;
  expect(next_open(season, empty_progress(season), first)?.id).toBe(second.id);
  const podiums: SeriesProgress = { ...empty_progress(season), results: { [second.id]: at(1), [third.id]: at(1) } };
  expect(next_open(season, podiums, first)?.id).toBe(season.events[3].id);
  const all: SeriesProgress = { ...empty_progress(season), results: Object.fromEntries(season.events.map((e) => [e.id, at(1)])) };
  expect(next_open(season, all, first)).toBeNull();
});

test("the Next card names the round and its kind", () => {
  expect(series_ticket(season, season.events[3], { here: true })).toEqual({ eyebrow: "Next · Round 4 of 6", title: "Rival duel", mode: "Head to head", place: { here: true }, kind: season.world });
});

test("the Rally Trial: three rounds in order, any finish opens the next, and running all three keeps the Rally", () => {
  const cup = RALLY_TRIAL;
  expect(cup.events.length).toBe(3);
  expect(cup.events.at(-1)!.final).toBe(true);
  expect(new Set(cup.events.map((e) => e.kind)).size).toBe(3);
  for (const e of cup.events) expect(e.id.startsWith(`${cup.id}-`)).toBe(true);
  const last = cup.field.length + 1;
  const fresh = empty_progress(cup);
  expect(event_states(cup, fresh)).toEqual(["open", "locked", "locked"]);
  const one: SeriesProgress = { ...fresh, results: { [cup.events[0].id]: cup_at(cup, last) } };
  expect(event_states(cup, one)).toEqual(["open", "open", "locked"]);
  expect(season_done(cup, one)).toBe(false);
  const all: SeriesProgress = { ...fresh, results: Object.fromEntries(cup.events.map((e) => [e.id, cup_at(cup, last)])) };
  expect(season_done(cup, all)).toBe(true);
});

test("a cup lends its car: any car in the garage may start it, and the field races the same stock one", () => {
  const tuned: Build = { ...DEFAULT_BUILD, car: "formula", parts: { ...DEFAULT_PARTS, engine: 3 } };
  expect(car_fault(RALLY_TRIAL, tuned, [BASE_CAR])).toBeNull();
  const lent = parse_build(loaner_code(RALLY_TRIAL))!;
  expect(lent).toEqual(stock_build("rally"));
  expect(loaner_code(SEASON_1)).toBeNull();
  const builds = field_builds(lent, rating(lent), 5, [], { pick: RivalPick.ONE_MAKE });
  expect(builds.length).toBe(5);
  for (const build of builds) expect(same_machine(build, lent)).toBe(true);
  expect(new Set(builds.map((b) => b.paint)).size).toBe(5);
});

test("finishing the cup last still keeps the frame; a podium keeps a trophy that outlives a rerun and a reload", async () => {
  const cup = RALLY_TRIAL;
  const store = memory();
  const wallet = new Wallet(null);
  const series = new Series(cup, store, wallet);
  const last = cup.field.length + 1;
  for (const event of cup.events.slice(0, -1)) series.record(event, cup_at(cup, last));
  expect(wallet.owns("rally")).toBe(false);
  const done = series.record(cup.events.at(-1)!, cup_at(cup, last));
  expect(done.car).toBe("rally");
  expect(done.trophy).toBeNull();
  expect(wallet.owns("rally")).toBe(true);
  series.reset();
  for (const event of series.season.events) series.record(event, cup_at(cup, 2));
  expect(series.progress.best).toBe(2);
  expect(trophy_of(series.progress)).toBe("2nd place trophy");
  series.reset();
  expect(series.progress.best).toBe(2);
  const reload = new Series(cup, store, new Wallet(null));
  await reload.load();
  expect(reload.progress.best).toBe(2);
});

test("rerunning rounds of a finished cup can still climb the table into a trophy", () => {
  const cup = RALLY_TRIAL;
  const series = new Series(cup, null, new Wallet(null));
  const last = cup.field.length + 1;
  for (const event of cup.events) series.record(event, cup_at(cup, last));
  expect(series.progress.best).toBe(last);
  const trophies = cup.events.map((event) => series.record(event, cup_at(cup, 1)).trophy);
  expect(trophies.filter((t) => t === "Winner's cup").length).toBe(1);
  expect(series.progress.best).toBe(1);
  expect(series.record(cup.events[0], cup_at(cup, 1)).trophy).toBeNull();
});

test("a stored best place is checked: out of the table it reads as none", () => {
  for (const best of [0, -1, 1.5, "1", RALLY_TRIAL.field.length + 2]) expect(parse_progress(RALLY_TRIAL, { season: RALLY_TRIAL.id, round: 0, results: {}, best }).best).toBeUndefined();
  expect(parse_progress(RALLY_TRIAL, { season: RALLY_TRIAL.id, round: 0, results: {}, best: 3 }).best).toBe(3);
});
