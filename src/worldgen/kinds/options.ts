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
}

export interface Knob<R> extends OptionDef {
  apply(recipe: R, level: number): R;
}

/** A knob whose levels set `values[level]` on the recipe; the normal level leaves the recipe untouched, so it builds today's world. */
export function knob<R, V>(spec: OptionDef & { values: readonly V[]; set: (recipe: R, value: V) => R }): Knob<R> {
  const { values, set, ...def } = spec;
  return { ...def, apply: (recipe, level) => (level === def.normal ? recipe : set(recipe, values[level])) };
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
