import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { DEFAULT_BUILD } from "../car/build";
import { TIERS, event_of } from "../career/career";
import { event_map } from "../career/career-store";
import { empty_progress } from "../career/series";
import { series_map } from "../career/series-run";
import { SEASON_1 } from "../career/series-seasons";
import { daily } from "../runs/runs";
import { map_code } from "../worldgen/kinds/map-code";
import { career_pick, roam_pick, run_pick, series_pick } from "./drive-picks";

const island = event_map(event_of("r1")!);
const rookie = TIERS[0].events;

test("a fresh season's pick is its first round, and the button names it", () => {
  const first = SEASON_1.events[0];
  const pick = series_pick(SEASON_1, empty_progress(SEASON_1), DEFAULT_BUILD, [DEFAULT_BUILD.car], series_map(SEASON_1, first))!;
  expect(pick.target).toBe(first.id);
  expect(pick.title).toBe(`Round 1 of ${SEASON_1.events.length} · ${first.name}`);
  expect(pick.verb).toBe("Race Round 1");
  expect(pick.place).toEqual({ here: true });
  expect(pick.note).toBe("");
});

test("a series round on another map says what the button loads", () => {
  const pick = series_pick(SEASON_1, empty_progress(SEASON_1), DEFAULT_BUILD, [DEFAULT_BUILD.car], { ...island, seed: island.seed + 1 })!;
  expect(pick.place.here).toBe(false);
  expect(pick.note).toStartWith("Loads ");
});

test("a car the season refuses is the reason shown, not a fit", () => {
  const pick = series_pick(SEASON_1, empty_progress(SEASON_1), DEFAULT_BUILD, [], island)!;
  expect(pick.reasons.some((line) => line.includes("isn't yours"))).toBe(true);
});

test("a fresh profile's career pick is on this map and names its place in the tier", () => {
  const pick = career_pick({}, island)!;
  expect(pick.place).toEqual({ here: true });
  expect(pick.verb).toBe(`Race ${pick.title}`);
  expect(pick.reasons[0]).toStartWith(`${TIERS[0].name} `);
});

test("with this map done the career pick travels", () => {
  const done = Object.fromEntries(rookie.filter((e) => map_code(event_map(e)) === map_code(island)).map((e) => [e.id, 3]));
  const pick = career_pick(done, island)!;
  expect(pick.place.here).toBe(false);
  expect(pick.note).toStartWith("Loads ");
});

test("today's run shows the stars still open", () => {
  const pick = daily("2026-11-16");
  expect(run_pick(pick, 1, island).gain).toBe("+2★");
  expect(run_pick(pick, 3, island).gain).toBeUndefined();
});

test("free roam drives the map by its first name; a paused run only resumes", () => {
  expect(roam_pick(island, "Island · Harwar", null).verb).toBe("Drive Island");
  expect(roam_pick(island, "Island · Harwar", "Sand trail").verb).toBe("Resume Sand trail");
});
