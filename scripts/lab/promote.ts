import { apply_mods, build_mods } from "../../src/car/build";
import { CARS, type CarSpec } from "../../src/car/cars";
import { LAB_CAR, resolve_trial, spec_hash, type Pack } from "../../src/lab/pack";

/** Printed values keep this many significant digits: a folded scale prints 206.99999999999997 otherwise. */
const DIGITS = 6;
/** Rounded to `DIGITS`, folding mods before the parts instead of after moves a field by about this much at most. */
const SAME = 1e-5;

const round = (spec: CarSpec): CarSpec => JSON.parse(JSON.stringify(spec), (_k, v) => (typeof v === "number" ? Number(v.toPrecision(DIGITS)) : v));
const literal = (v: unknown): string => (v === undefined ? "undefined" : JSON.stringify(v)).replace(/"(\w+)":/g, "$1: ").replace(/,(?=\S)/g, ", ");

function worst_gap(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) / Math.max(1e-9, Math.abs(a), Math.abs(b));
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let gap = 0;
    for (const k of keys) gap = Math.max(gap, worst_gap((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
    return gap;
  }
  return a === b ? 0 : Infinity;
}

/**
 * Step 1 of the plan's section 7: the trial's car with its mods folded in, as `cars.ts` fields, the shipped value
 * beside each field it changes (a lab car prints whole). Only `mods` fold; parts stay parts, so the trial's build code still applies on top.
 */
export function promote(pack: Pack, id: string): string[] {
  const trial = pack.trials.find((t) => t.id === id);
  if (!trial) throw new Error(`no trial "${id}" in ${pack.id}, expected one of ${pack.trials.map((t) => t.id).join(", ")}`);
  const r = resolve_trial(pack, trial);
  const lab = trial.car.startsWith(LAB_CAR);
  const base: CarSpec = lab ? r.spec : CARS[r.build.car];
  const folded = round(lab ? r.spec : apply_mods(base, trial.mods ?? []));
  const rebuilt = lab ? folded : apply_mods(folded, build_mods(r.build.parts));
  const hash = spec_hash(rebuilt);
  const gap = worst_gap(rebuilt, r.spec);
  const verdict = hash === r.hash ? "matches the trial" : gap <= SAME ? `matches the trial's spec#${r.hash} to ${gap.toExponential(1)} (rounding)` : `NOT the trial's spec#${r.hash} (gap ${gap.toExponential(1)}): fold by hand and recheck`;
  const out = [`// ${pack.id} r${pack.rev} ${trial.id}: ${trial.car} spec#${r.hash}`, `// folded, with the trial's parts: spec#${hash}, ${verdict}`];
  out.push(`${lab ? trial.car.slice(LAB_CAR.length) : r.build.car}: {`);
  const shipped = round(base) as unknown as Record<string, unknown>;
  for (const [key, v] of Object.entries(folded)) {
    const was = shipped[key];
    if (lab) out.push(`  ${key}: ${literal(v)},`);
    else if (literal(was) !== literal(v)) out.push(`  ${key}: ${literal(v)}, // was ${literal(was)}`);
  }
  out.push("},");
  return out;
}
