import { stat_range, type Stats } from "../car/build";
import { PLAIN_CARS } from "../career/rewards";

export const STAT_NAMES: Record<keyof Stats, string> = { power: "Power", grip: "Grip", braking: "Braking", top_speed: "Top speed" };
// An empty bar reads as broken, so the weakest car in the game still shows a sliver.
const BAR_FLOOR = 0.08;

let range: ReturnType<typeof stat_range> | null = null;

export const bar_of = (key: keyof Stats, value: number) => {
  const { low, high } = (range ??= stat_range(PLAIN_CARS));
  return BAR_FLOOR + (1 - BAR_FLOOR) * Math.max(0, Math.min(1, (value - low[key]) / (high[key] - low[key])));
};
export const stat_rating = (key: keyof Stats, value: number) => Math.round(bar_of(key, value) * 100);
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
export const trend = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");
