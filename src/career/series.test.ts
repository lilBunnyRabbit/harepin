import { expect, test } from "bun:test";
import { World } from "../world/world";
import { Bonus, OPEN_AT_START, PODIUM, SEASON_1, SeriesKind, better, empty_progress, event_line, event_result, event_states, parse_progress, player_of, result_points, season_done, standings, type EventResult, type SeriesProgress } from "./series";
import type { SeriesSaves } from "./series-db";
import { Series } from "./series-store";

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
  const one: SeriesProgress = { season: season.id, results: { [season.events[0].id]: at(PODIUM) } };
  expect(event_states(season, one)).toEqual(["podium", "open", "open", "open", "locked", "locked"]);
  const off: SeriesProgress = { season: season.id, results: { [season.events[0].id]: at(PODIUM + 1) } };
  expect(event_states(season, off)[0]).toBe("open");
  const all = Object.fromEntries(season.events.slice(0, -1).map((e) => [e.id, at(1)]));
  expect(event_states(season, { season: season.id, results: all }).at(-1)).toBe("open");
  expect(season_done(season, { season: season.id, results: all })).toBe(false);
  expect(season_done(season, { season: season.id, results: { ...all, [season.events[5].id]: at(2) } })).toBe(true);
});

test("points by place plus the player's bonuses; the table sums every event", () => {
  const win: EventResult = { ...at(1), bonus: [Bonus.CLEAN, Bonus.FROM_BACK] };
  const opener = season.events[0];
  expect(result_points(season, opener, win, YOU)).toBe(10 + 2 + 2);
  expect(result_points(season, opener, win, 0)).toBe(8);
  const table = standings(season, { season: season.id, results: { a: win, [season.events[0].id]: win, [season.events[1].id]: at(7) } });
  expect(table.find((row) => row.you)?.points).toBe(14 + 2);
  expect(table[0].points).toBeGreaterThanOrEqual(table[1].points);
});

test("a retry replaces an event's run only when it scores the player more", () => {
  const series = new Series(season, memory());
  const event = season.events[0];
  expect(series.record(event, at(4))).toBe(true);
  expect(series.record(event, at(5))).toBe(false);
  expect(series.record(event, at(2))).toBe(true);
  expect(better(season, event, at(2), at(2))).toBe(false);
});

test("stored progress is checked: junk drops out, good results survive a reload", async () => {
  const store = memory();
  new Series(season, store).record(season.events[0], { order: at(1).order, bonus: [Bonus.LED] });
  const again = new Series(season, store);
  expect(again.ready).toBe(false);
  await again.load();
  expect(again.ready).toBe(true);
  expect(again.progress.results[season.events[0].id]?.bonus).toEqual([Bonus.LED]);
  store.data.set(season.id, "not progress");
  const bad = new Series(season, store);
  await bad.load();
  expect(bad.progress.results).toEqual({});
  const refused = new Series(season, { load: () => Promise.reject(new Error("blocked")), save: async () => {} });
  await refused.load();
  expect(refused.ready).toBe(true);
  expect(refused.progress.results).toEqual({});
  const junk = { season: season.id, results: { [season.events[0].id]: { order: [9, 9] }, [season.events[1].id]: { order: [0, 1] }, [season.events[2].id]: { order: [YOU, 0], bonus: ["nope", Bonus.CLEAN] } } };
  const read = parse_progress(season, junk);
  expect(Object.keys(read.results)).toEqual([season.events[2].id]);
  expect(read.results[season.events[2].id].bonus).toEqual([Bonus.CLEAN]);
  expect(parse_progress(season, { season: "other", results: {} }).results).toEqual({});
});

test("a head to head maps the race's two cars onto the rival and the player", () => {
  const duel = season.events.find((e) => e.kind === SeriesKind.HEAD_TO_HEAD)!;
  const result = event_result(season, duel, { order: [1, 0], clean: true, led: true, fastest: false, from_back: true });
  expect(result.order).toEqual([YOU, season.rival]);
  expect(result.bonus).toEqual([Bonus.CLEAN, Bonus.LED, Bonus.FROM_BACK]);
  const lost = event_result(season, duel, { order: [0, 1], clean: false, led: false, fastest: true, from_back: true });
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
  expect(event_states(season, { season: season.id, results: { [duel.id]: lost } })[i]).not.toBe("podium");
  expect(event_states(season, { season: season.id, results: { [duel.id]: won } })[i]).toBe("podium");
});

test("fastest lap pays only in endurance, the one event of more than a lap", () => {
  const outcome = { order: [6, 0, 1, 2, 3, 4, 5], clean: false, led: false, fastest: true, from_back: false };
  for (const event of season.events) expect(event_result(season, event, outcome).bonus.includes(Bonus.FASTEST)).toBe(event.kind === SeriesKind.ENDURANCE);
});
