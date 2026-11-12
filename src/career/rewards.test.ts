import { expect, test } from "bun:test";
import { DECALS, MAX_PAINT, REWARD_PAINTS } from "../car/build";
import { TIERS, type Stars } from "./career";
import { NO_UNLOCKS, PAINT_STARS, REWARD_DECALS, badge_text, earned, unlocks } from "./rewards";

const [rookie, club] = TIERS;
const with_stars = (...picks: [string, number][]): Stars => Object.fromEntries(picks);
const all_of = (tier: (typeof TIERS)[number], stars: number) => tier.events.map((event): [string, number] => [event.id, stars]);

test("each tier hands out its own paint past MAX_PAINT and its own appended decal", () => {
  expect(TIERS.map((tier) => tier.rewards.paint)).toEqual(Array.from({ length: REWARD_PAINTS }, (_, i) => MAX_PAINT + 1 + i));
  expect(TIERS.map((tier) => tier.rewards.decal)).toEqual(["sky", "volcano", "ice"]);
  expect(REWARD_DECALS).toEqual([9, 10, 11]);
});

test("nothing is earned from no stars", () => {
  expect(unlocks({})).toEqual(NO_UNLOCKS);
});

test("paint at 10 stars in the tier, decal at 21 of 21", () => {
  const nine = with_stars(...all_of(rookie, 1).slice(0, 6), ["r7", 3]);
  expect(unlocks(nine).paints).toEqual([]);
  const ten = with_stars(...all_of(rookie, 1).slice(0, 6), ["r7", 3], ["r1", 2]);
  expect(Object.values(ten).reduce((a, b) => a + b, 0)).toBe(PAINT_STARS);
  expect(unlocks(ten).paints).toEqual([rookie.rewards.paint]);
  expect(unlocks(ten).decals).toEqual([]);
  const twenty = with_stars(...all_of(rookie, 3), ["r1", 2]);
  expect(unlocks(twenty).decals).toEqual([]);
  expect(unlocks(with_stars(...all_of(rookie, 3))).decals).toEqual([DECALS.indexOf("sky")]);
});

test("the badge is the highest tier whose final is finished", () => {
  expect(unlocks(with_stars(["r1", 3])).badge).toBeNull();
  expect(unlocks(with_stars(["r7", 1])).badge).toBe(1);
  expect(unlocks(with_stars(["r7", 1], ["c7", 1])).badge).toBe(2);
  expect(unlocks(with_stars(["c7", 2])).badge).toBe(2);
  expect(badge_text(2)).toBe("Club champion");
});

test("a run reports only the rewards it moved from locked to earned", () => {
  const nine = with_stars(...all_of(rookie, 1).slice(0, 6), ["r7", 3]);
  const kinds = (before: Stars, after: Stars) => earned(before, after, rookie).map((reward) => reward.kind);
  expect(kinds({}, with_stars(["r7", 1]))).toEqual(["badge"]);
  expect(kinds(nine, { ...nine, r1: 2 })).toEqual(["paint"]);
  expect(kinds(with_stars(...all_of(rookie, 3), ["r1", 2]), with_stars(...all_of(rookie, 3)))).toEqual(["decal"]);
  expect(kinds(with_stars(...all_of(rookie, 3)), with_stars(...all_of(rookie, 3)))).toEqual([]);
  expect(kinds({}, with_stars(...all_of(rookie, 3)))).toEqual(["paint", "decal", "badge"]);
});
