import { Idb } from "./idb";
import { CachedStore, use_records } from "./cached-store";
import { plan_sweep, record_families } from "./sweep";

const STORE = "kv";

const db = new Idb();

function local_entries(): [string, string][] {
  const entries: [string, string][] = [];
  for (const key of Object.keys(localStorage)) {
    const text = localStorage.getItem(key);
    if (text !== null) entries.push([key, text]);
  }
  return entries;
}

// An old build in another tab may have written a newer record since the sweep read it: only the copy that went in is dropped.
function drop_swept(swept: readonly [string, string][]) {
  try {
    for (const [key, text] of swept) if (localStorage.getItem(key) === text) localStorage.removeItem(key);
  } catch (error) {
    console.warn("records: old copies stay in localStorage", error);
  }
}

function persist(key: string, value: string) {
  db.put(STORE, value, key).catch((error: unknown) => {
    console.warn(`records: IndexedDB refused ${key}, keeping it in localStorage`, error);
    try {
      localStorage.setItem(key, value);
    } catch (fallback) {
      console.warn(`records: ${key} not saved`, fallback);
    }
  });
}

/**
 * Loads the records from IndexedDB, moving any left in localStorage in (an older build in another tab keeps writing
 * there, so this runs every boot), and makes `local_store()` read them. Resolves false when IndexedDB fails or takes
 * longer than `timeout_ms`: the records then stay in localStorage for this session, none of them moved.
 */
export function load_records(mode_ids: readonly string[], timeout_ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const give_up = (why: unknown) => {
      if (settled) return;
      settled = true;
      console.warn("records: IndexedDB unavailable, records stay in localStorage", why);
      resolve(false);
    };
    const timer = setTimeout(() => give_up(new Error(`no records in ${timeout_ms} ms`)), timeout_ms);
    let swept: [string, string][] = [];
    db.update_all(STORE, (stored) => {
      if (settled) return [];
      const plan = plan_sweep(stored, local_entries(), record_families(mode_ids));
      settled = true;
      clearTimeout(timer);
      swept = plan.swept;
      use_records(new CachedStore(plan.values, persist));
      resolve(true);
      return plan.writes;
    }).then(
      () => drop_swept(swept),
      (error: unknown) => {
        clearTimeout(timer);
        if (settled) console.warn("records: the move did not commit, the old copies stay in localStorage", error);
        give_up(error);
      },
    );
  });
}
