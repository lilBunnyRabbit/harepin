import { build_code, DEFAULT_BUILD, DEFAULT_PARTS, parse_build, SLOTS, type Slot } from "../../src/car/build";
import type { CarId } from "../../src/car/cars";
import { PRESETS } from "../../src/car/presets";
import type { GroundName } from "../grounds";

export const Family = { STOCK: "stock", GRIP: "grip", AERO: "aero", DRIFT: "drift", DIRT: "dirt", MAX: "max" } as const;
export type Family = (typeof Family)[keyof typeof Family];

type Parts = Partial<Record<Slot, string>>;

const GRIP: Parts = { tyres: "Semi-slick", suspension: "Race", brakes: "Race" };

function preset_parts(name: string): Record<Slot, number> {
  const preset = PRESETS.find((p) => p.name === name);
  const build = preset && parse_build(preset.code);
  if (!build) throw new Error(`no preset "${name}"`);
  return build.parts;
}

/** Each family asks one question of a car (docs/plan/feel-lab-v2.md 3); parts by name, so a reordered slot can't move them. */
const FAMILIES: Record<Family, Parts | (() => Record<Slot, number>)> = {
  stock: {},
  grip: GRIP,
  aero: { ...GRIP, aero: "Race kit" },
  drift: { suspension: "Drift", engine: "Tuned", bias: "Rear" },
  dirt: { tyres: "Rally", suspension: "Lifted", engine: "Tuned" },
  max: () => preset_parts("Maxed F1"),
};

/** Which families each car is held to. The bus is out (decision O6). */
const COVERAGE: Partial<Record<CarId, Family[]>> = {
  hatch: ["stock", "grip", "aero", "dirt"],
  coupe: ["stock", "grip", "aero", "drift", "dirt"],
  muscle: ["stock", "grip", "aero", "drift"],
  rally: ["stock", "grip", "aero", "dirt"],
  kaze: ["stock", "grip", "aero", "drift"],
  sturm: ["stock", "grip", "aero", "drift"],
  raijin: ["stock", "grip", "aero", "dirt"],
  formula: ["stock", "max"],
  fujin: ["stock", "max"],
  tsumuji: ["stock", "grip", "drift"],
  sajin: ["stock", "dirt"],
};

/** Loose grounds a stock and a dirt setup also run on; everything runs on asphalt. */
const LOOSE: GroundName[] = ["dirt", "grass", "sand", "packed_snow", "ice"];
const SWEPT: CarId = "coupe";
const SWEEPS: Slot[] = ["tyres", "aero"];

export interface Setup {
  /** `<car>.<setup>`: a family, `preset:<name>` or `<slot>:<part>` for a sweep row. */
  id: string;
  car: CarId;
  code: string;
  grounds: GroundName[];
}

function part_index(slot: Slot, name: string): number {
  const at = SLOTS[slot].parts.findIndex((p) => p.name === name);
  if (at < 0) throw new Error(`no ${slot} part "${name}"`);
  return at;
}

function parts_of(family: Family): Record<Slot, number> {
  const def = FAMILIES[family];
  if (typeof def === "function") return def();
  const parts = { ...DEFAULT_PARTS };
  for (const [slot, name] of Object.entries(def) as [Slot, string][]) parts[slot] = part_index(slot, name);
  return parts;
}

const code_of = (car: CarId, parts: Record<Slot, number>) => build_code({ ...DEFAULT_BUILD, car, parts });
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function setups(car?: CarId): Setup[] {
  const out: Setup[] = [];
  for (const [id, families] of Object.entries(COVERAGE) as [CarId, Family[]][]) {
    if (car && id !== car) continue;
    for (const family of families) {
      const grounds: GroundName[] = family === "stock" || family === "dirt" ? ["asphalt", ...LOOSE] : ["asphalt"];
      out.push({ id: `${id}.${family}`, car: id, code: code_of(id, parts_of(family)), grounds });
    }
    for (const preset of PRESETS) {
      const build = parse_build(preset.code);
      if (build?.car === id) out.push({ id: `${id}.preset:${slug(preset.name)}`, car: id, code: preset.code, grounds: ["asphalt"] });
    }
    if (id !== SWEPT) continue;
    for (const slot of SWEEPS)
      SLOTS[slot].parts.forEach((part, i) => out.push({ id: `${id}.${slot}:${slug(part.name)}`, car: id, code: code_of(id, { ...DEFAULT_PARTS, [slot]: i }), grounds: ["asphalt"] }));
  }
  return out;
}
