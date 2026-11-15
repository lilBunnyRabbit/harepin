import { MAX_PAINT, parse_build, type Build } from "../car/build";
import { within } from "../car/car-pick";
import { PRESETS } from "../car/presets";
import { rating } from "../car/pi";

/** Coprime with the paint count, so it visits every paint once while grid neighbours land far apart in hue. */
const PAINT_STRIDE = 5;
const FIRST_NUMBER = 2;

/** O6: a class holds two or three presets, so they cycle; a paint and number of its own keeps a repeat from looking alike. */
export function field_builds(player: Build, count: number, excludes: readonly string[] = []): Build[] {
  const own = rating(player);
  const presets = PRESETS.flatMap((preset) => {
    const build = parse_build(preset.code);
    if (!build || excludes.includes(build.car)) return [];
    const rated = rating(build);
    return within(rated.class, own.class) ? [{ build, gap: Math.abs(rated.pi - own.pi) }] : [];
  }).sort((a, b) => a.gap - b.gap);
  if (!presets.length) return [];
  const free = Array.from({ length: MAX_PAINT + 1 }, (_, k) => (k * PAINT_STRIDE) % (MAX_PAINT + 1)).filter((paint) => paint !== player.paint);
  const numbers = Array.from({ length: count + 1 }, (_, i) => FIRST_NUMBER + i).filter((n) => n !== player.number);
  return Array.from({ length: count }, (_, i) => ({ ...presets[i % presets.length].build, paint: free[i % free.length], number: numbers[i] }));
}
