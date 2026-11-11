export interface OptionDef {
  /** Its letter in the map code: never reused or renumbered, so old codes keep parsing. */
  field: string;
  name: string;
  help: string;
  labels: readonly string[];
  /** The level that builds the kind as it was before options: `labels[normal]`. */
  normal: number;
  /** A 0-31 slider: never part of a K2 records key, so K2 records keep theirs. */
  slider?: boolean;
  /** Shown under the Create-world page's Advanced fold. */
  more?: boolean;
}

export interface Knob<R> extends OptionDef {
  apply(recipe: R, level: number): R;
  /** A slider's value per level. */
  values?: readonly number[];
}

/** A knob whose levels set `values[level]` on the recipe; the normal level leaves the recipe untouched, so it builds today's world. */
export function knob<R, V>(spec: OptionDef & { values: readonly V[]; set: (recipe: R, value: V) => R }): Knob<R> {
  const { values, set, ...def } = spec;
  return { ...def, apply: (recipe, level) => (level === def.normal ? recipe : set(recipe, values[level])) };
}

export const SLIDER_LEVELS = 32;
/** Level 16 is the kind as it was: 16 steps below it, 15 above. */
export const SLIDER_NORMAL = 16;

/** A slider's value at `level`: `lo` at 0, `mid` (the kind's own) at normal, `hi` at 31, in plain IEEE steps so peers agree. */
export function slider_value(level: number, lo: number, mid: number, hi: number): number {
  return level < SLIDER_NORMAL ? lo + ((mid - lo) * level) / SLIDER_NORMAL : mid + ((hi - mid) * (level - SLIDER_NORMAL)) / (SLIDER_LEVELS - 1 - SLIDER_NORMAL);
}

export function slider<R>(spec: Omit<OptionDef, "labels" | "normal" | "slider"> & { lo: number; mid: number; hi: number; label: (value: number) => string; set: (recipe: R, value: number) => R }): Knob<R> {
  const { lo, mid, hi, label, set, ...def } = spec;
  const values = Array.from({ length: SLIDER_LEVELS }, (_, level) => slider_value(level, lo, mid, hi));
  return { ...knob<R, number>({ ...def, slider: true, labels: values.map(label), normal: SLIDER_NORMAL, values, set }), values };
}

export function tune<R>(recipe: R, knobs: readonly Knob<R>[], levels: readonly number[]): R {
  return knobs.reduce((tuned, k, i) => k.apply(tuned, levels[i] ?? k.normal), recipe);
}

export function normal_levels(options: readonly OptionDef[]): number[] {
  return options.map((o) => o.normal);
}

/** One digit per option, its level; all normal is the empty code, so default maps keep their plain keys and links. */
export function opts_code(options: readonly OptionDef[], levels: readonly number[]): string {
  return options.every((o, i) => levels[i] === o.normal) ? "" : options.map((_, i) => String(levels[i])).join("");
}

/** Levels from a code; empty is all normal, anything malformed is null. */
export function parse_opts(options: readonly OptionDef[], code: string): number[] | null {
  if (code === "") return normal_levels(options);
  if (code.length !== options.length) return null;
  const levels = [...code].map(Number);
  return levels.every((level, i) => Number.isInteger(level) && level >= 0 && level < options[i].labels.length) ? levels : null;
}

/** Crockford base32: no I, L, O or U, so a code read out loud or copied by hand survives. */
export const CODE_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Each level off normal as its field letter and level char, sorted by letter: one string per set of levels. */
export function overrides(options: readonly OptionDef[], levels: readonly number[]): string {
  return options
    .map((o, i) => ({ field: o.field, level: levels[i] ?? o.normal, normal: o.normal }))
    .filter((o) => o.level !== o.normal)
    .sort((a, b) => (a.field < b.field ? -1 : 1))
    .map((o) => o.field + CODE_CHARS[o.level])
    .join("");
}
