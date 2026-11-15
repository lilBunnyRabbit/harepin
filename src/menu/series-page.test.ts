import "../../scripts/fake-dom";
import { existsSync } from "node:fs";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { empty_progress, event_states, player_of, standings, type SeriesProgress } from "../career/series";
import { SEASON_1, SEASON_4, SEASONS } from "../career/series-seasons";
import { season_lock } from "./series-view";
import { fresh_wallet } from "../career/wallet";
import SeriesEvents from "./SeriesEvents.svelte";
import SeriesFlow from "./SeriesFlow.svelte";
import SeriesTable from "./SeriesTable.svelte";

const season = SEASON_1;
const switcher = { seasons: SEASONS.map((s, i) => ({ name: s.name, open: i < 2, done: i === 0 })), at: 0, onseason: () => {}, lock: null };
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
  const props = { season, progress: won, states, table: standings(season, won), done: false, wallet: fresh_wallet(), onstart: () => {}, onback: () => {}, onreset: () => {}, ...switcher };
  const out = render(SeriesFlow, { props }).body;
  expect(out.match(/class="sc-go/g)?.length).toBe(1);
  expect(out).toContain("Standings");
  expect(out).toContain("data-adjust");
});

test("the coverflow shows the player's credits, the class cap, the replay round and the final's reward", () => {
  const first = empty_progress(season);
  const base = { season, states: event_states(season, first), table: standings(season, first), done: false, onstart: () => {}, onback: () => {}, onreset: () => {}, ...switcher };
  const own = { ...fresh_wallet(), cars: [...fresh_wallet().cars, season.reward.car] };
  expect(render(SeriesFlow, { props: { ...base, progress: first, wallet: fresh_wallet() } }).body).toContain("Sajin + 5,000 cr");
  const kept = render(SeriesFlow, { props: { ...base, progress: first, wallet: own } }).body;
  expect(kept).toContain("sc-reward");
  expect(kept).not.toContain("Sajin + ");
  const progress = { ...empty_progress(season, 1) };
  const props = { season, progress, states: event_states(season, progress), table: standings(season, progress), done: false, onstart: () => {}, onback: () => {}, onreset: () => {}, ...switcher };
  const fresh = render(SeriesFlow, { props: { ...props, wallet: { ...fresh_wallet(), credits: 12500 } } }).body;
  expect(fresh).toContain("12,500 cr");
  expect(fresh).toContain("Class C · your own cars");
  expect(fresh).toContain("Run 2");
  expect(fresh).toContain("Sajin");
  expect(fresh).not.toContain("Sajin + ");
  const owned = render(SeriesFlow, { props: { ...props, wallet: own } }).body;
  expect(owned).not.toContain("sc-reward");
});

test("the switcher names the season shown and steps either way; a shut season locks every card and says why", () => {
  const progress = empty_progress(SEASON_4);
  const shut = season_lock(SEASONS[2]);
  const props = { season: SEASON_4, progress, states: SEASON_4.events.map(() => "locked" as const), table: standings(SEASON_4, progress), done: false, wallet: fresh_wallet(), onstart: () => {}, onback: () => {}, onreset: () => {}, ...switcher, at: 3, lock: shut };
  const out = render(SeriesFlow, { props }).body;
  expect(out).toContain("Mainland series");
  expect(out).toContain("Previous season");
  expect(out.match(/data-state="done"/g)?.length).toBe(1);
  expect(out.match(/Finish the Dunes series to open/g)?.length).toBe(SEASON_4.events.length);
  expect(out).not.toContain("sc-go");
  expect(out).not.toContain("Start over");
});

test("every season's events have their card art", () => {
  for (const season of SEASONS) for (const event of season.events) expect(existsSync(new URL(`../../public/series/${event.id}.webp`, import.meta.url))).toBe(true);
});
