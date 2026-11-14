import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, parse_build, type Build, type Slot } from "../car/build";
import type { CarId } from "../car/cars";
import { PRESETS } from "../car/presets";

export interface ViewerPreset {
  id: string;
  label: string;
  parts: Record<Slot, number>;
  /** A shipped preset's own paint and decal; the others take the picked paint. */
  paint: number | null;
  decal: number;
}

type Named = Partial<Record<Slot, string>>;

const MID: Named = { engine: "Tuned", tyres: "Sport", aero: "Street kit", brakes: "Sport", weight: "Light", nitro: "Small tank" };
const MAX: Named = { engine: "Race", tyres: "Semi-slick", aero: "Race kit", suspension: "Race", brakes: "Race", weight: "Stripped", nitro: "Big tank" };

// By part name, so a reordered slot can't move a tier onto another part.
function named(parts: Named): Record<Slot, number> {
  const out = { ...DEFAULT_PARTS };
  for (const [slot, name] of Object.entries(parts) as [Slot, string][]) {
    const at = SLOTS[slot].parts.findIndex((p) => p.name === name);
    if (at < 0) throw new Error(`viewer: no ${slot} part "${name}"`);
    out[slot] = at;
  }
  return out;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const tier = (id: string, label: string, parts: Record<Slot, number>): ViewerPreset => ({ id, label, parts, paint: null, decal: 0 });

const KITS: ViewerPreset[] = SLOTS.aero.parts.slice(1).map((part, i) => tier(`aero${i + 1}`, part.name, { ...DEFAULT_PARTS, aero: i + 1 }));

export function viewer_presets(car: CarId): ViewerPreset[] {
  const shipped = PRESETS.flatMap((preset): ViewerPreset[] => {
    const build = parse_build(preset.code);
    if (!build || build.car !== car) return [];
    return [{ id: `preset-${slug(preset.name)}`, label: preset.name, parts: build.parts, paint: build.paint, decal: build.decal }];
  });
  return [tier("stock", "Stock", { ...DEFAULT_PARTS }), ...KITS, tier("mid", "Mid tier", named(MID)), tier("max", "Max tier", named(MAX)), ...shipped];
}

export function viewer_build(car: CarId, preset: ViewerPreset, paint: number): Build {
  return { ...DEFAULT_BUILD, car, paint: preset.paint ?? paint, decal: preset.decal, parts: { ...preset.parts } };
}
