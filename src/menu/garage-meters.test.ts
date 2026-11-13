import { expect, test } from "bun:test";
import { STATS, stat_range } from "../car/build";
import { PLAIN_CARS, REWARD_CARS } from "../career/rewards";
import { bar_of } from "./garage-meters";

test("a reward car leaves every other car's garage bars where they were", () => {
  const plain = stat_range(PLAIN_CARS);
  const with_rewards = stat_range([...PLAIN_CARS, ...REWARD_CARS]);
  expect(STATS.some((key) => with_rewards.high[key] > plain.high[key])).toBe(true);
  for (const key of STATS) {
    expect(bar_of(key, plain.high[key])).toBe(1);
    expect(bar_of(key, with_rewards.high[key])).toBe(1);
  }
});
