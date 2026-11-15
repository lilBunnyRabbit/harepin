import { expect, test } from "bun:test";
import { World } from "../world/world";
import { DEFAULT_BUILD, DEFAULT_PARTS, type Build } from "../car/build";
import { within } from "../car/car-pick";
import { rating } from "../car/pi";
import { CREDITS_PER_POINT, FINAL_FACTOR } from "./credits";
import { Bonus, OPEN_AT_START, PODIUM, SEASON_1, SeriesKind, better, car_fault, empty_progress, event_field, event_line, event_result, event_states, grid_slot, parse_progress, player_of, result_points, season_done, season_round, standings, type EventResult, type SeriesProgress } from "./series";
import type { SeriesSaves } from "./series-db";
import { Series } from "./series-store";
import { BASE_CAR, Wallet } from "./wallet";

const season = SEASON_1;
const YOU = player_of(season);
const field = season.field.map((_, i) => i);
const at = (place: number): EventResult => {
  const order = [...field];
  order.splice(place - 1, 0, YOU);
  return { order, bonus: [] };
};

// IndexedDB stores a structured clone, so the fake does too.
function memory(): SeriesSaves & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return { data, load: async (id) => structuredClone(data.get(id)), save: async (p) => void data.set(p.season, structuredClone(p)) };
}

test("season 1 is six island events, the final last, with the first season's kinds", () => {
  expect(season.events.length).toBe(6);
  expect(season.events.at(-1)?.final).toBe(true);
  expect(new Set(season.events.map((e) => e.kind))).toEqual(new Set(Object.values(SeriesKind)));
  expect(season.field.length).toBe(6);
});

test("every event's route is a closed route of its seed's island", () => {
  for (const event of season.events) {
    const route = new World(event.seed).routes.find((r) => r.id === event.route);
    expect(route?.closed).toBe(true);
  }
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

test("every replay seed has each route the season races, closed", () => {
  const routes = new Set(season.events.map((e) => e.route));
  for (const seed of season.replays) {
    const world = new World(seed);
    for (const id of routes) expect(world.routes.find((r) => r.id === id)?.closed).toBe(true);
  }
}, 60_000);

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
  expect(won).toEqual({ kept: true, credits: 10 * CREDITS_PER_POINT * FINAL_FACTOR, season_credits: season.reward.credits, car: season.reward.car });
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
  for (const event of season.events) series.record(event, at(1));
  expect(series.record(final, at(1)).car).toBeNull();
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
