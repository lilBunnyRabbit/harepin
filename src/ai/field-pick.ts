import { MAX_PAINT, parse_build, type Build } from "../car/build";
import { CARS } from "../car/cars";
import { within } from "../car/car-pick";
import { PRESETS } from "../car/presets";
import { rating, type Rating } from "../car/pi";

/** Coprime with the paint count, so it visits every paint once while grid neighbours land far apart in hue. */
const PAINT_STRIDE = 5;
const FIRST_NUMBER = 2;

/**
 * O6: a class holds one to three presets, so they cycle; a paint and number of its own keeps a repeat from looking alike.
 * `own` is the player's car as it drives: a lab trial's mods or lab car can move it off its build's class.
 */
export function field_builds(player: Build, own: Rating, count: number, excludes: readonly string[] = []): Build[] {
  const presets = PRESETS.flatMap((preset) => {
    const build = parse_build(preset.code);
    if (!build || excludes.includes(build.car) || CARS[build.car].ai_field === false) return [];
    const rated = rating(build);
    return within(rated.class, own.class) ? [{ build, same: rated.class === own.class, gap: Math.abs(rated.pi - own.pi) }] : [];
  }).sort((a, b) => a.gap - b.gap);
  // Under the class only when it has no preset of its own: a party bus in a class C field is a mismatch, not a rival.
  const same = presets.filter((p) => p.same);
  const pool = same.length ? same : presets;
  if (!pool.length) return [];
  const free = Array.from({ length: MAX_PAINT + 1 }, (_, k) => (k * PAINT_STRIDE) % (MAX_PAINT + 1)).filter((paint) => paint !== player.paint);
  const numbers = Array.from({ length: count + 1 }, (_, i) => FIRST_NUMBER + i).filter((n) => n !== player.number);
  return Array.from({ length: count }, (_, i) => ({ ...pool[i % pool.length].build, paint: free[i % free.length], number: numbers[i] }));
}
