import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { SEASON_1, empty_progress, event_states, player_of, standings, type SeriesProgress } from "../career/series";
import SeriesEvents from "./SeriesEvents.svelte";
import SeriesFlow from "./SeriesFlow.svelte";
import SeriesTable from "./SeriesTable.svelte";

const season = SEASON_1;
const won: SeriesProgress = { season: season.id, round: 0, results: { [season.events[0].id]: { order: [player_of(season), 0, 1, 2, 3, 4, 5], bonus: [] } } };

test("a fresh series offers three races and locks the rest", () => {
  const progress = empty_progress(season);
  const out = render(SeriesEvents, { props: { season, progress, states: event_states(season, progress), onstart: () => {} } }).body;
  expect(out.match(/<button/g)?.length).toBe(3);
  expect(out).toContain("Podium every event");
});

test("the table names the rival, marks the player and says who won each event", () => {
  const out = render(SeriesTable, { props: { season, progress: won, rows: standings(season, won) } }).body;
  expect(out).toContain("Rival");
  expect(out).toContain('data-now="true"');
  expect(out).toContain("Opening race: you win.");
});

test("only the endurance event lists fastest lap as a bonus", () => {
  const progress = empty_progress(season);
  const out = render(SeriesEvents, { props: { season, progress, states: event_states(season, progress), onstart: () => {} } }).body;
  expect(out.match(/fastest lap/g)?.length).toBe(1);
});

test("the series rail ends on a standings card and only the front card races", () => {
  const states = event_states(season, won);
  const props = { season, progress: won, states, table: standings(season, won), done: false, onstart: () => {}, onback: () => {}, onreset: () => {} };
  const out = render(SeriesFlow, { props }).body;
  expect(out.match(/class="sc-go/g)?.length).toBe(1);
  expect(out).toContain("Standings");
  expect(out).toContain("data-adjust");
});
