import { mulberry32, seed_of } from "../rng";
import type { Pack, Question, Trial } from "./pack";

export interface Shown {
  /** The trial id, or its letter in a blind group (the base is always `A`). */
  label: string;
  feel: string;
  /** What to do: a blind variant shows its base's, since its own may name the mod. */
  try: string;
  /** Index of the group's base trial; -1 outside a group or for the base itself. */
  base: number;
  /** Car name, class and PI may show: a blind variant hides them, a PI step names the mod. */
  open: boolean;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function shuffled(n: number, seed: number): number[] {
  const out = [...Array(n).keys()];
  const next = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A group runs from a `base` trial to the next one. In a blind pack every trial of a group shows a letter, B on in an
 * order seeded by the pack id and rev, and the base's feel line, so the owner rates the car and not its label.
 */
export function shown_trials(pack: Pack): Shown[] {
  const out: Shown[] = pack.trials.map((t) => ({ label: t.id, feel: t.feel, try: t.try, base: -1, open: true }));
  const starts = pack.trials.flatMap((t, i) => (t.base ? [i] : []));
  starts.forEach((start, g) => {
    const end = starts[g + 1] ?? pack.trials.length;
    for (let i = start + 1; i < end; i++) out[i].base = start;
    if (!pack.blind) return;
    const order = shuffled(end - start - 1, seed_of(`${pack.id}.r${pack.rev}.${g}`));
    out[start] = { ...out[start], label: LETTERS[0] };
    order.forEach((k, at) => {
      out[start + 1 + k] = { label: LETTERS[(at + 1) % LETTERS.length], feel: pack.trials[start].feel, try: pack.trials[start].try, base: start, open: false };
    });
  });
  return out;
}

export const VS_BASE: Question = { kind: "pick", id: "vsbase", label: "vs A", options: ["worse", "same", "better"] };

/** A blind variant also asks how it compares with its group's base, before the free-text questions. */
export function with_vs_base(pack: Pack, trial: Trial, own: readonly Question[]): readonly Question[] {
  if (!pack.blind || trial.base) return own;
  const at = pack.trials.indexOf(trial);
  if (at < 0 || !pack.trials.slice(0, at).some((t) => t.base)) return own;
  return [...own.filter((q) => q.kind !== "text"), VS_BASE, ...own.filter((q) => q.kind === "text")];
}
