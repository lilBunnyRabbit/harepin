import { MAX_PAINT, parse_build, type Build } from "../car/build";
import { CARS } from "../car/cars";
import { within } from "../car/car-pick";
import { PRESETS } from "../car/presets";
import { rating, type Rating } from "../car/pi";

/** Coprime with the paint count, so it visits every paint once while grid neighbours land far apart in hue. */
const PAINT_STRIDE = 5;
const FIRST_NUMBER = 2;

export const RivalPick = { CLASS: "class", ANY: "any", PICKED: "picked" } as const;
export type RivalPick = (typeof RivalPick)[keyof typeof RivalPick];

/** Which presets a field drives: the player's class, a spread over every class, or the presets named. */
export type RivalCars = { pick: typeof RivalPick.CLASS } | { pick: typeof RivalPick.ANY } | { pick: typeof RivalPick.PICKED; presets: readonly string[] };

const OWN_CLASS: RivalCars = { pick: RivalPick.CLASS };

interface Rival {
  name: string;
  build: Build;
  rated: Rating;
}

/** The presets a field may drive on a route: never one the route leaves out, never a car kept out of AI fields (the bus). */
export function field_presets(excludes: readonly string[] = []): Rival[] {
  return PRESETS.flatMap((preset) => {
    const build = parse_build(preset.code);
    if (!build || excludes.includes(build.car) || CARS[build.car].ai_field === false) return [];
    return [{ name: preset.name, build, rated: rating(build) }];
  });
}

function class_pool(eligible: readonly Rival[], own: Rating): Build[] {
  // A class with no rival at or under it (the bus, alone in D) races the lowest class that has one.
  const cap = eligible.some((p) => within(p.rated.class, own.class)) ? own.class : eligible.reduce((low, p) => (within(p.rated.class, low) ? p.rated.class : low), eligible[0].rated.class);
  const presets = eligible
    .filter((p) => within(p.rated.class, cap))
    .map((p) => ({ build: p.build, same: p.rated.class === cap, gap: Math.abs(p.rated.pi - own.pi) }))
    .sort((a, b) => a.gap - b.gap);
  // Under the class only when it has no preset of its own: a party bus in a class C field is a mismatch, not a rival.
  const same = presets.filter((p) => p.same);
  return (same.length ? same : presets).map((p) => p.build);
}

// Slowest to fastest, taken at even steps: a small field still spans the classes.
function any_pool(eligible: readonly Rival[], count: number): Build[] {
  const sorted = [...eligible].sort((a, b) => a.rated.pi - b.rated.pi);
  const take = Math.min(count, sorted.length);
  return Array.from({ length: take }, (_, i) => sorted[Math.floor((i * sorted.length) / take)].build);
}

function pool_of(eligible: readonly Rival[], own: Rating, count: number, rivals: RivalCars): Build[] {
  if (rivals.pick === RivalPick.ANY) return any_pool(eligible, count);
  if (rivals.pick === RivalPick.PICKED) {
    const picked = eligible.filter((p) => rivals.presets.includes(p.name));
    if (picked.length) return picked.map((p) => p.build);
  }
  return class_pool(eligible, own);
}

/**
 * O6: a class holds one to three presets, so they cycle; a paint and number of its own keeps a repeat from looking alike.
 * `own` is the player's car as it drives: a lab trial's mods or lab car can move it off its build's class. Picked
 * presets that the route leaves none of fall back to the player's class.
 */
export function field_builds(player: Build, own: Rating, count: number, excludes: readonly string[] = [], rivals: RivalCars = OWN_CLASS): Build[] {
  const eligible = field_presets(excludes);
  if (!eligible.length || count <= 0) return [];
  const pool = pool_of(eligible, own, count, rivals);
  const free = Array.from({ length: MAX_PAINT + 1 }, (_, k) => (k * PAINT_STRIDE) % (MAX_PAINT + 1)).filter((paint) => paint !== player.paint);
  const numbers = Array.from({ length: count + 1 }, (_, i) => FIRST_NUMBER + i).filter((n) => n !== player.number);
  return Array.from({ length: count }, (_, i) => ({ ...pool[i % pool.length], paint: free[i % free.length], number: numbers[i] }));
}
