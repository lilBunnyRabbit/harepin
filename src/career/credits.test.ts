import { expect, test } from "bun:test";
import { CREDITS_PER_POINT, event_pay, round_factor } from "./credits";
import { CUP_CLEAR, ROUND_MAX } from "./prices";
import { player_of, type EventResult, type Season } from "./series";
import { CUPS, SEASON_1, SEASON_2, SEASON_4 } from "./series-seasons";
import { reward_credits } from "./series-store";

const at = (season: Season, place: number): EventResult => {
  const order = season.field.map((_, i) => i);
  order.splice(place - 1, 0, player_of(season));
  return { order, bonus: [] };
};

test("race credits scale by the season's class: C 1.0, B 1.2, A 1.5", () => {
  for (const [season, factor] of [[SEASON_1, 1], [SEASON_2, 1.2], [SEASON_4, 1.5]] as const) {
    expect(event_pay(season, season.events[0], at(season, 1)).credits).toBe(Math.round(10 * CREDITS_PER_POINT * factor));
  }
});

test("a rerun pays half only once the event was podiumed; a retry before that pays full", () => {
  const opener = SEASON_1.events[0];
  expect(event_pay(SEASON_1, opener, at(SEASON_1, 1), false).share).toBe(1);
  expect(event_pay(SEASON_1, opener, at(SEASON_1, 1), true).share).toBe(0.5);
});

test("replay rounds pay a quarter more each, up to double", () => {
  expect([0, 1, 2, 4, 9].map(round_factor)).toEqual([1, 1.25, 1.5, 2, ROUND_MAX]);
});

test("a cup pays its first clear once and its replays nothing; a season pays a quarter of its reward on each replay", () => {
  for (const cup of CUPS) {
    expect(reward_credits(cup, 0)).toBe(CUP_CLEAR);
    expect(reward_credits(cup, 1)).toBe(0);
  }
  expect(reward_credits(SEASON_4, 0)).toBe(20_000);
  expect(reward_credits(SEASON_4, 3)).toBe(5_000);
});
