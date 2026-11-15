import { Idb } from "./idb";
import { CachedStore, use_records } from "./cached-store";
import { plan_restore, plan_sweep, record_families } from "./sweep";

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

let asked = false;

// Persisted storage is not cleared when the browser runs short of space. Asked once a session and only after a record is
// set, so a player who never saves anything is never asked; a denial leaves the records best-effort, as before.
function keep_storage() {
  if (asked) return;
  asked = true;
  navigator.storage
    .persisted()
    .then((kept) => kept || navigator.storage.persist())
    .catch((error: unknown) => console.warn("records: persistent storage not granted, records stay best-effort", error));
}

function persist(key: string, value: string) {
  keep_storage();
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
 * there, so this runs every boot), and makes `local_store()` read them. Resolves false when IndexedDB fails or is not
 * done `timeout_ms` after `beside` settles: the records then stay in localStorage for this session, none of them moved.
 * The wait counts from `beside` (the world's generation) because a busy boot also delays the open: counted from the
 * start, a slow but working IndexedDB fell back and showed a moved profile as empty.
 */
export function load_records(mode_ids: readonly string[], beside: Promise<unknown>, timeout_ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const give_up = (why: unknown) => {
      if (settled) return;
      settled = true;
      console.warn("records: IndexedDB unavailable, records stay in localStorage", why);
      resolve(false);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = () => {
      if (!settled) timer = setTimeout(() => give_up(new Error(`no records ${timeout_ms} ms after the world`)), timeout_ms);
    };
    beside.then(wait, wait);
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

/**
 * The rollback escape hatch, not called by any shipped build: copies the records back into localStorage, merged with
 * whatever a build there wrote meanwhile, for a build that reads them from localStorage again. IndexedDB keeps its copy.
 * Ship it as the boot step in place of `load_records` only to roll back past the move (docs/plan/indexeddb.md, step 5).
 */
export async function restore_records(mode_ids: readonly string[]): Promise<void> {
  const writes = plan_restore(await db.entries(STORE), local_entries(), record_families(mode_ids));
  for (const [key, text] of writes) {
    try {
      localStorage.setItem(key, text);
    } catch (error) {
      console.warn(`records: ${key} not copied back to localStorage`, error);
    }
  }
}
