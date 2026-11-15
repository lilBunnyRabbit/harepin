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
  version: 2,
  stores: [
    { name: "series", key: "season" },
    { name: "ghosts", key: "key" },
  ],
};

const OPEN_TIMEOUT_MS = 3000;

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
  });

const committed = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB transaction aborted"));
  });

function open(schema: IdbSchema, closed: () => void): Promise<IDBDatabase> {
  const request = indexedDB.open(schema.name, schema.version);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of schema.stores) if (!db.objectStoreNames.contains(store.name)) db.createObjectStore(store.name, { keyPath: store.key });
  };
  return new Promise<IDBDatabase>((resolve, reject) => {
    let late = false;
    const timer = setTimeout(() => {
      late = true;
      reject(new Error(`indexedDB ${schema.name} v${schema.version} did not open in ${OPEN_TIMEOUT_MS} ms`));
    }, OPEN_TIMEOUT_MS);
    request.onsuccess = () => {
      clearTimeout(timer);
      const db = request.result;
      // The caller already fell back, and a connection held open now would block the next upgrade.
      if (late) {
        db.close();
        return;
      }
      // A newer build in another tab is upgrading: let it, rather than block it until this tab closes.
      db.onversionchange = () => {
        db.close();
        closed();
      };
      resolve(db);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error("indexedDB open failed"));
    };
    // Only a tab from before connections gave way to upgrades blocks: the timeout lets the caller fall back meanwhile, and
    // the connection that opens once that tab closes is closed again.
    request.onblocked = () => console.warn(`indexedDB ${schema.name} v${schema.version} waits for an older tab to close`);
  });
}

/**
 * Get, put and delete over a schema's object stores, with the platform API only. The database opens on first use and
 * again after a failed open; every call can reject (private mode, storage refused), and the caller
 * decides the fallback. Writes resolve once committed. Values read back are untrusted: validate their shape.
 */
export class Idb {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly schema: IdbSchema = HAREPIN_DB) {}

  private async tx(name: string, mode: IDBTransactionMode): Promise<IDBTransaction> {
    if (!this.db) {
      const opening: Promise<IDBDatabase> = open(this.schema, () => {
        if (this.db === opening) this.db = null;
      }).catch((error: unknown) => {
        if (this.db === opening) this.db = null;
        throw error;
      });
      this.db = opening;
    }
    const db = await this.db;
    return db.transaction(name, mode);
  }

  async get(store: string, key: IDBValidKey): Promise<unknown> {
    return done((await this.tx(store, "readonly")).objectStore(store).get(key));
  }

  async put(store: string, value: unknown): Promise<void> {
    const tx = await this.tx(store, "readwrite");
    tx.objectStore(store).put(value);
    await committed(tx);
  }

  /** Read and write in one transaction, so another tab cannot write between them; `next` returning undefined writes nothing. */
  async update(store: string, key: IDBValidKey, next: (stored: unknown) => unknown): Promise<void> {
    const tx = await this.tx(store, "readwrite");
    const objects = tx.objectStore(store);
    const read = objects.get(key);
    read.onsuccess = () => {
      const value = next(read.result);
      if (value !== undefined) objects.put(value);
    };
    await committed(tx);
  }

  async delete(store: string, key: IDBValidKey): Promise<void> {
    const tx = await this.tx(store, "readwrite");
    tx.objectStore(store).delete(key);
    await committed(tx);
  }
}
