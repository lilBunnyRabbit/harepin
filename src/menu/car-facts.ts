import { SLOTS, build_spec, stats, type Build, type Stats } from "../car/build";
import type { Drive } from "../car/cars";
import { STAT_NAMES, bar_of, stat_rating } from "./garage-meters";

export interface Fact {
  icon: string;
  label: string;
  word: string;
}

export interface CardMeter {
  key: keyof Stats;
  label: string;
  value: number;
  /** Bar length, 0-100. */
  bar: number;
}

export interface CarFacts {
  drive: Fact;
  tyres: Fact;
  weight: string;
  meters: CardMeter[];
}

const DRIVE_NAMES: Record<Drive, string> = { fwd: "Front-wheel drive", rwd: "Rear-wheel drive", awd: "All-wheel drive" };
const CARD_STATS: readonly (keyof Stats)[] = ["power", "grip", "top_speed"];
const KG = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

export const drive_icon = (drive: Drive) => `icon-drive-${drive}`;
// One sprite per tyre kind, named after the part: a new kind needs its `icon-tyre-*` symbol in index.html.
export const tyre_icon = (name: string) => `icon-tyre-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`;

export function car_facts(build: Build): CarFacts {
  const spec = build_spec(build);
  const tyre = SLOTS.tyres.parts[build.parts.tyres] ?? SLOTS.tyres.parts[0];
  const now = stats(spec);
  return {
    drive: { icon: drive_icon(spec.drive), label: DRIVE_NAMES[spec.drive], word: spec.drive.toUpperCase() },
    tyres: { icon: tyre_icon(tyre.name), label: `${tyre.name} tyres`, word: tyre.name },
    weight: `${KG.format(spec.mass)} kg`,
    meters: CARD_STATS.map((key) => ({ key, label: STAT_NAMES[key], value: stat_rating(key, now[key]), bar: bar_of(key, now[key]) * 100 })),
  };
}
