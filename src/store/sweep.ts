import { CAREER_KEY } from "../career/career-store";
import { merge_stars } from "../career/career";
import { GOALS_KEY, merge_done } from "../goals/goals";
import { merge_race_record, merge_runs } from "../modes/track";
import { RUNS_KEY, merge_runs_save } from "../runs/runs-store";

/** A kind of record that lives in IndexedDB, and how two saves of one key combine: the better record wins, never the newer write. */
export interface RecordFamily {
  owns(key: string): boolean;
  merge(kept: unknown, other: unknown): unknown;
}

const exact = (name: string, merge: RecordFamily["merge"]): RecordFamily => ({ owns: (key) => key === name, merge });
const under = (prefix: string, merge: RecordFamily["merge"]): RecordFamily => ({ owns: (key) => key.startsWith(prefix), merge });

/** Every key `local_store()` holds: `Track` (per mode, career event and run), `Career`, `Runs`, `Goals` and `Lobby`. */
export function record_families(mode_ids: readonly string[]): RecordFamily[] {
  return [
    ...mode_ids.map((mode) => under(`harepin:${mode}:`, merge_runs)),
    under("harepin:career:", merge_runs),
    under("harepin:run:", merge_runs),
    under("harepin:lobby:", merge_race_record),
    exact(CAREER_KEY, merge_stars),
    exact(RUNS_KEY, merge_runs_save),
    exact(GOALS_KEY, (kept, other) => merge_done(kept, other, mode_ids)),
  ];
}

export interface SweepPlan {
  /** What the cache starts from: IndexedDB's records with localStorage's merged in. */
  values: Map<string, string>;
  /** Keys whose IndexedDB value changes. */
  writes: [string, string][];
  /** localStorage keys and the text read, to drop once the writes commit. */
  swept: [string, string][];
}

const json = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("records: a saved record is not JSON, merging it as empty", error);
    return null;
  }
};

/** `stored` is untrusted: anything but a string key and a string value is skipped. */
export function plan_sweep(stored: Iterable<[unknown, unknown]>, local: Iterable<[string, string]>, families: readonly RecordFamily[]): SweepPlan {
  const values = new Map<string, string>();
  for (const [key, value] of stored) if (typeof key === "string" && typeof value === "string") values.set(key, value);
  const writes: [string, string][] = [];
  const swept: [string, string][] = [];
  for (const [key, text] of local) {
    const family = families.find((f) => f.owns(key));
    if (!family) continue;
    swept.push([key, text]);
    const kept = values.get(key);
    const next = kept === undefined ? text : JSON.stringify(family.merge(json(kept), json(text)));
    if (next === kept) continue;
    values.set(key, next);
    writes.push([key, next]);
  }
  return { values, writes, swept };
}
