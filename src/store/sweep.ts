import { BUILDS_KEY, merge_builds } from "../car/builds";
import { CAREER_KEY } from "../career/career-store";
import { merge_stars } from "../career/career";
import { GOALS_KEY, merge_done } from "../goals/goals";
import { merge_race_record, merge_runs } from "../modes/track";
import { BEST_KEY, SPLITS_KEY, merge_best } from "../race";
import { RUNS_KEY, merge_runs_save } from "../runs/runs-store";

/** A kind of record that lives in IndexedDB, and how two saves of one key combine: the better record wins, never the newer write. */
export type RecordFamily = MergedFamily | FollowingFamily;

interface MergedFamily {
  owns(key: string): boolean;
  merge(kept: unknown, other: unknown): unknown;
}

/** A record that belongs to another key's (a lap's splits to its time): it comes from whichever save won that key. */
interface FollowingFamily {
  owns(key: string): boolean;
  follows(key: string): string;
}

const exact = (name: string, merge: MergedFamily["merge"]): MergedFamily => ({ owns: (key) => key === name, merge });
const under = (prefix: string, merge: MergedFamily["merge"]): MergedFamily => ({ owns: (key) => key.startsWith(prefix), merge });

/** Every key `local_store()` holds: `Track` (per mode, career event and run), `Career`, `Runs`, `Goals`, `Lobby`, `Race` and saved builds. */
export function record_families(mode_ids: readonly string[]): RecordFamily[] {
  return [
    ...mode_ids.map((mode) => under(`harepin:${mode}:`, merge_runs)),
    under("harepin:career:", merge_runs),
    under("harepin:run:", merge_runs),
    under("harepin:lobby:", merge_race_record),
    exact(CAREER_KEY, merge_stars),
    exact(RUNS_KEY, merge_runs_save),
    exact(GOALS_KEY, (kept, other) => merge_done(kept, other, mode_ids)),
    exact(BUILDS_KEY, merge_builds),
    under(`${BEST_KEY}:`, merge_best),
    { owns: (key) => key.startsWith(`${SPLITS_KEY}:`), follows: (key) => `${BEST_KEY}${key.slice(SPLITS_KEY.length)}` },
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
  const took_local = new Set<string>();
  const set = (key: string, next: string) => {
    values.set(key, next);
    writes.push([key, next]);
  };
  const owned = [...local].flatMap(([key, text]) => {
    const family = families.find((f) => f.owns(key));
    return family ? [{ key, text, family }] : [];
  });
  for (const { key, text, family } of owned) {
    if (!("merge" in family)) continue;
    swept.push([key, text]);
    const kept = values.get(key);
    const next = kept === undefined ? text : JSON.stringify(family.merge(json(kept), json(text)));
    if (next === kept) continue;
    took_local.add(key);
    set(key, next);
  }
  const local_keys = new Set(owned.map(({ key }) => key));
  for (const { key, text, family } of owned) {
    if (!("follows" in family)) continue;
    swept.push([key, text]);
    const lead = family.follows(key);
    // A leader IndexedDB kept keeps its own follower: the other save's belongs to a record that lost. A follower alone in
    // localStorage is a write IndexedDB refused (old builds write both), so it wins.
    if ((took_local.has(lead) || !local_keys.has(lead)) && values.get(key) !== text) set(key, text);
  }
  return { values, writes, swept };
}

/** The sweep run backwards for a rollback: the localStorage writes that bring every IndexedDB record back, merged the same way. */
export function plan_restore(stored: Iterable<[unknown, unknown]>, local: Iterable<[string, string]>, families: readonly RecordFamily[]): [string, string][] {
  const records = [...stored].filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string");
  return plan_sweep(local, records, families).writes;
}
