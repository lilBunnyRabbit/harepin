import "../../scripts/fake-dom";
import { existsSync } from "node:fs";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { DEFAULT_BUILD, DEFAULT_PARTS, type Build } from "../car/build";
import { car_fault, empty_progress, event_states, player_of, standings, type SeriesProgress } from "../career/series";
import { CUPS, RALLY_TRIAL, SEASON_1, SEASON_4, SEASONS, SERIES_LIST } from "../career/series-seasons";
import { frame_locks } from "../career/frames";
import { series_list } from "../career/series-store";
import { series_map } from "../career/series-run";
import { Wallet } from "../career/wallet";
import { start_view } from "./events-view";
import { car_line, car_note, season_lock, season_tabs, start_card } from "./series-view";
import { BASE_CAR, fresh_wallet } from "../career/wallet";
import SeriesEvents from "./SeriesEvents.svelte";
import SeriesFlow from "./SeriesFlow.svelte";
import SeriesTable from "./SeriesTable.svelte";

const season = SEASON_1;
const switcher = { seasons: season_tabs(SEASONS, [true, true, false, false], [true, false, false, false]), at: 0, onseason: () => {}, lock: null };
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

test("the series rail ends on a standings card, the front card is the one that races and one card is in front", () => {
  const states = event_states(season, won);
  const props = { season, progress: won, states, table: standings(season, won), done: false, wallet: fresh_wallet(), onstart: () => {}, onreset: () => {}, ...switcher };
  const out = render(SeriesFlow, { props }).body;
  expect(out.match(/aria-label="Race /g)?.length).toBe(1);
  expect(out.match(/data-front="true"/g)?.length).toBe(1);
  expect(out).toContain("Standings");
  expect(out).toContain("data-adjust");
});

test("the strip is the flow's one focus stop and the first one, so left / right turn cards rather than walk the rail", () => {
  const props = { season, progress: won, states: event_states(season, won), table: standings(season, won), done: false, wallet: fresh_wallet(), onstart: () => {}, onreset: () => {}, ...switcher };
  const out = render(SeriesFlow, { props }).body;
  expect(out).toMatch(/<ol class="fl-strip[^"]*"[^>]* autofocus/);
  const rail = out.slice(out.indexOf('aria-label="Season progress"'));
  expect(rail.match(/<button[^>]*>/g)?.every((button) => button.includes('tabindex="-1"'))).toBe(true);
});

test("the coverflow shows the player's credits, the class cap, the replay round and the final's reward", () => {
  const first = empty_progress(season);
  const base = { season, states: event_states(season, first), table: standings(season, first), done: false, onstart: () => {}, onreset: () => {}, ...switcher };
  const first_run = render(SeriesFlow, { props: { ...base, progress: first, wallet: fresh_wallet() } }).body;
  expect(first_run).toContain("sc-reward");
  expect(first_run).toContain("8,000 cr");
  expect(first_run).not.toContain("Sajin");
  const progress = { ...empty_progress(season, 1) };
  const props = { season, progress, states: event_states(season, progress), table: standings(season, progress), done: false, onstart: () => {}, onreset: () => {}, ...switcher };
  const fresh = render(SeriesFlow, { props: { ...props, wallet: { ...fresh_wallet(), credits: 12500 } } }).body;
  expect(fresh).toContain("12,500 cr");
  expect(fresh).toContain("Your own car up to class C vs tuned rivals");
  expect(fresh).toContain("6 events · points by finishing place");
  expect(fresh).toContain("Run 2");
  expect(fresh).not.toContain("sc-reward");
});

test("the switcher names the season shown and steps either way; a shut season locks every card and says why", () => {
  const progress = empty_progress(SEASON_4);
  const shut = season_lock(SEASONS[2]);
  const props = { season: SEASON_4, progress, states: SEASON_4.events.map(() => "locked" as const), table: standings(SEASON_4, progress), done: false, wallet: fresh_wallet(), onstart: () => {}, onreset: () => {}, ...switcher, at: 3, lock: shut };
  const out = render(SeriesFlow, { props }).body;
  expect(out).toContain("Mainland series");
  expect(out).toContain("Previous season");
  expect(out).toContain("Season 4 of 4");
  expect(out.match(/Finish the Dunes series to open/g)?.length).toBe(SEASON_4.events.length);
  expect(out).not.toContain('aria-label="Race ');
  expect(out).not.toContain("Start over");
});

test("the Rally Trial leads the switcher as a beginner's cup: its loaner named, its rounds opened by a finish, the Rally its prize", () => {
  const cup = RALLY_TRIAL;
  const progress = empty_progress(cup);
  const seasons = season_tabs(SERIES_LIST, [...CUPS.map(() => true), true, false, false, false], SERIES_LIST.map(() => false));
  expect(seasons.map((tab) => tab.kicker)).toEqual([...CUPS.map((c) => `One-make cup${c.beginner ? " · start here" : ""}`), "Season 1 of 4", "Season 2 of 4", "Season 3 of 4", "Season 4 of 4"]);
  expect(seasons.filter((tab) => tab.beginner).map((tab) => tab.name)).toEqual(["Rally Trial", "Muscle Cup"]);
  const props = { season: cup, progress, states: event_states(cup, progress), table: standings(cup, progress), done: false, wallet: fresh_wallet(), onstart: () => {}, onreset: () => {}, seasons, at: 0, onseason: () => {}, lock: null };
  const out = render(SeriesFlow, { props }).body;
  expect(out).toContain("Rally Trial");
  expect(out).not.toContain("Rally Trial series");
  expect(out).toContain("data-beginner");
  expect(out).toMatch(/"sh-terms[^"]*">Everyone in a stock Rally, lent to you(<!--[^>]*-->)?<span class="sh-more[^"]*"> · (<!---->)?3 rounds · finish every round to keep the Rally/);
  expect(out.match(/Finish the round before to open/g)?.length).toBe(2);
  expect(out).toContain('<span class="sc-reward');
  expect(out).toContain("Rally + 3,000 cr</span>");
  const won = render(SeriesFlow, { props: { ...props, progress: { ...progress, best: 1 } } }).body;
  expect(won).toContain("Winner's cup");
});

test("a cup's start sheet lends the stock car: no picker, no cap check", () => {
  const list = series_list(null, new Wallet(null));
  const cup = list[0];
  const view = start_view({ kind: "series", series: cup, event: cup.base.events[0] }, series_map(cup.base, cup.base.events[0]));
  expect(view.limit).toBeNull();
  expect(view.lent).toBe("stock Rally");
  expect(view.eyebrow.startsWith("Rally Trial · Round 1 of 3")).toBe(true);
});

test("every season's events have their card art", () => {
  for (const season of SERIES_LIST) for (const event of season.events) expect(existsSync(new URL(`../../public/series/${event.id}.webp`, import.meta.url))).toBe(true);
});

test("a car the series won't take says why, and says nothing when the start would take it", () => {
  const stock: Build = { ...DEFAULT_BUILD, parts: { ...DEFAULT_PARTS } };
  const tuned: Build = { ...stock, parts: { ...stock.parts, engine: 3, tyres: 3, aero: 3, weight: 3 } };
  for (const build of [stock, tuned, { ...stock, car: "coupe" as const }]) expect(car_note(season, build, [BASE_CAR]) === null).toBe(car_fault(season, build, frame_locks([BASE_CAR])) === null);
  const note = car_note(season, tuned, [BASE_CAR]);
  expect(note?.why).toBe("Your Hatch is class B.");
  expect(note?.rule).toBe("This series takes C or below.");
});

test("the flow opens on the next race to run, or the last one run once none is left", () => {
  const first = (n: number): SeriesProgress => ({ season: season.id, round: 0, results: Object.fromEntries(season.events.slice(0, n).map((e) => [e.id, { order: [player_of(season), 0, 1, 2, 3, 4, 5], bonus: [] }])) });
  const at = (progress: SeriesProgress) => start_card(season, progress, event_states(season, progress));
  expect(at(empty_progress(season))).toBe(0);
  expect(at(first(3))).toBe(3);
  expect(at(first(season.events.length))).toBe(season.events.length - 1);
  const slow = { ...first(1), results: { [season.events[0].id]: { order: [0, 1, 2, 3, player_of(season)], bonus: [] } } };
  const opened = event_states(season, slow).filter((s) => s === "open").length;
  const all_run = { ...slow, results: Object.fromEntries(season.events.slice(0, opened).map((e) => [e.id, slow.results[season.events[0].id]])) };
  expect(at(all_run)).toBe(opened - 1);
});

test("the head says what car a season races: a cup lends everyone the same stock car, a season takes the player's own up to its cap", () => {
  expect(car_line(RALLY_TRIAL)).toBe("Everyone in a stock Rally, lent to you");
  expect(car_line(SEASON_1)).toBe("Your own car up to class C vs tuned rivals");
  expect(CUPS.every((cup) => car_line(cup).includes("lent to you"))).toBe(true);
});
