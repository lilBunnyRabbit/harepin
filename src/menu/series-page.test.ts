import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { SEASON_1, empty_progress, event_states, player_of, standings, type SeriesProgress } from "../career/series";
import { fresh_wallet } from "../career/wallet";
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
  const props = { season, progress: won, states, table: standings(season, won), done: false, wallet: fresh_wallet(), onstart: () => {}, onback: () => {}, onreset: () => {} };
  const out = render(SeriesFlow, { props }).body;
  expect(out.match(/class="sc-go/g)?.length).toBe(1);
  expect(out).toContain("Standings");
  expect(out).toContain("data-adjust");
});

test("the coverflow shows the player's credits, the class cap, the replay round and the final's reward", () => {
  const first = empty_progress(season);
  const base = { season, states: event_states(season, first), table: standings(season, first), done: false, onstart: () => {}, onback: () => {}, onreset: () => {} };
  const own = { ...fresh_wallet(), cars: [...fresh_wallet().cars, season.reward.car] };
  expect(render(SeriesFlow, { props: { ...base, progress: first, wallet: fresh_wallet() } }).body).toContain("Sajin + 5,000 cr");
  const kept = render(SeriesFlow, { props: { ...base, progress: first, wallet: own } }).body;
  expect(kept).toContain("sc-reward");
  expect(kept).not.toContain("Sajin + ");
  const progress = { ...empty_progress(season, 1) };
  const props = { season, progress, states: event_states(season, progress), table: standings(season, progress), done: false, onstart: () => {}, onback: () => {}, onreset: () => {} };
  const fresh = render(SeriesFlow, { props: { ...props, wallet: { ...fresh_wallet(), credits: 12500 } } }).body;
  expect(fresh).toContain("12,500 cr");
  expect(fresh).toContain("Class C · your own cars");
  expect(fresh).toContain("Run 2");
  expect(fresh).toContain("Sajin");
  expect(fresh).not.toContain("Sajin + ");
  const owned = render(SeriesFlow, { props: { ...props, wallet: own } }).body;
  expect(owned).not.toContain("sc-reward");
});
