import { expect, test } from "bun:test";
import { DECALS, MAX_PAINT, REWARD_PAINTS } from "../car/build";
import { TIERS, tier_stars, type Stars } from "./career";
import { NO_UNLOCKS, REWARD_DECALS, badge_text, earned, reward_paint_name, unlocks } from "./rewards";

const [rookie, , , elite, legend] = TIERS;
const with_stars = (...picks: [string, number][]): Stars => Object.fromEntries(picks);
const all_of = (tier: (typeof TIERS)[number], stars: number) => tier.events.map((event): [string, number] => [event.id, stars]);

test("each tier hands out its own paint past MAX_PAINT and its own appended decal", () => {
  expect(REWARD_PAINTS).toBe(TIERS.length);
  expect(TIERS.map((tier) => tier.rewards.paint)).toEqual(TIERS.map((_, i) => MAX_PAINT + 1 + i));
  // Legend's decal waits for its final map.
  expect(TIERS.map((tier) => tier.rewards.decal)).toEqual(["sky", "volcano", "ice", "dunes", undefined]);
  expect(REWARD_DECALS).toEqual([9, 10, 11, 12]);
  expect(TIERS.map(reward_paint_name)).toEqual(["Bronze metallic", "Silver metallic", "Gold metallic", "Platinum metallic", "Carbon"]);
});

test("nothing is earned from no stars", () => {
  expect(unlocks({})).toEqual(NO_UNLOCKS);
});

test("paint at the tier's paint stars, decal at all of the tier's stars", () => {
  const nine = with_stars(...all_of(rookie, 1).slice(0, 6), ["r7", 3]);
  expect(unlocks(nine).paints).toEqual([]);
  const ten = with_stars(...all_of(rookie, 1).slice(0, 6), ["r7", 3], ["r1", 2]);
  expect(Object.values(ten).reduce((a, b) => a + b, 0)).toBe(rookie.rewards.paint_at);
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
  expect(unlocks(with_stars(["r7", 1], ["e12", 1])).badge).toBe(4);
  expect(badge_text(2)).toBe("Club champion");
  expect(badge_text(4)).toBe("Elite champion");
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

test("Elite opens its paint at its own paint stars, its dunes decal at all of its stars", () => {
  const full = with_stars(...all_of(elite, 3));
  expect(elite.rewards.paint_at).toBe(18);
  const short = elite.rewards.paint_at - 1 - elite.events.length;
  const below = with_stars(...elite.events.map((event, i): [string, number] => [event.id, i < short ? 2 : 1]));
  expect(tier_stars(below, elite)).toBe(elite.rewards.paint_at - 1);
  expect(unlocks(below).paints).toEqual([]);
  expect(unlocks(full).paints).toEqual([elite.rewards.paint]);
  expect(unlocks({ ...full, e1: 2 }).decals).toEqual([]);
  expect(unlocks(full).decals).toEqual([DECALS.indexOf("dunes")]);
  expect(unlocks(full).badge).toBe(4);
  expect(earned({}, full, elite).map((reward) => reward.kind)).toEqual(["paint", "decal", "badge"]);
});

test("Legend opens its paint at its own paint stars and holds no decal or badge until its final ships", () => {
  const full = with_stars(...all_of(legend, 3));
  expect(legend.rewards.paint_at).toBe(18);
  expect(tier_stars(full, legend)).toBe(legend.events.length * 3);
  expect(unlocks(full).paints).toEqual([legend.rewards.paint]);
  expect(unlocks(full).decals).toEqual([]);
  expect(unlocks(full).badge).toBeNull();
  expect(earned({}, full, legend).map((reward) => reward.kind)).toEqual(["paint"]);
});
