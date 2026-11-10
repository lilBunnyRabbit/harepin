export interface OptionDef {
  name: string;
  help: string;
  labels: readonly string[];
  /** The level that builds the kind as it was before options: `labels[normal]`. */
  normal: number;
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
