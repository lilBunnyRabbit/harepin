import type { Store } from "../modes/track";

/**
 * The records, read from memory: filled once at boot, so every reader stays sync. A write lands in memory at once and
 * goes to `persist` behind it; `persist` owns the fallback when the write is refused.
 */
export class CachedStore implements Store {
  constructor(
    private readonly values: Map<string, string>,
    private readonly persist: (key: string, value: string) => void,
  ) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
    this.persist(key, value);
  }

  entries(): IterableIterator<[string, string]> {
    return this.values.entries();
  }
}

let records: CachedStore | null = null;

/** Set once at boot when the records loaded; until then, and if they never do, `local_store()` is localStorage. */
export function use_records(store: CachedStore) {
  records = store;
}

export function cached_records(): CachedStore | null {
  return records;
}
