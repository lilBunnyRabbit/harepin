export interface IdbStore {
  readonly name: string;
  readonly key: string;
}

export interface IdbSchema {
  readonly name: string;
  /** Bump with every store added: only a new version runs the upgrade that creates it. */
  readonly version: number;
  readonly stores: readonly IdbStore[];
}

/** The game's one database. A new save adds its store here and bumps `version`; stores are never renamed or dropped. */
export const HAREPIN_DB: IdbSchema = {
  name: "harepin",
  version: 1,
  stores: [{ name: "series", key: "season" }],
};

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
  });

function open(schema: IdbSchema): Promise<IDBDatabase> {
  const request = indexedDB.open(schema.name, schema.version);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of schema.stores) if (!db.objectStoreNames.contains(store.name)) db.createObjectStore(store.name, { keyPath: store.key });
  };
  return done(request);
}

/**
 * Get, put and delete over a schema's object stores, with the platform API only. The database opens on first use; every
 * call can reject (private mode, storage refused, a blocked upgrade), and the caller decides the fallback. Values read
 * back are untrusted: validate their shape.
 */
export class Idb {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly schema: IdbSchema = HAREPIN_DB) {}

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    this.db ??= open(this.schema);
    const db = await this.db;
    return db.transaction(name, mode).objectStore(name);
  }

  async get(store: string, key: IDBValidKey): Promise<unknown> {
    return done((await this.store(store, "readonly")).get(key));
  }

  async put(store: string, value: unknown): Promise<void> {
    await done((await this.store(store, "readwrite")).put(value));
  }

  async delete(store: string, key: IDBValidKey): Promise<void> {
    await done((await this.store(store, "readwrite")).delete(key));
  }
}
