/**
 * Byte-level persistence used by the sql.js web driver: the whole database
 * image is exported and stored (IndexedDB in the browser, in-memory in tests).
 */
export interface BytesStore {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

export function createMemoryBytesStore(): BytesStore & {
  readonly saves: number;
} {
  let data: Uint8Array | null = null;
  let saves = 0;
  return {
    get saves() {
      return saves;
    },
    async load() {
      return data;
    },
    async save(bytes: Uint8Array) {
      data = bytes.slice();
      saves += 1;
    },
  };
}

const IDB_STORE = "kv";
const IDB_KEY = "db-image";

/** Browser store persisting the DB image in IndexedDB. */
export function createIdbBytesStore(dbName = "shotcoach-db"): BytesStore {
  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB open failed"));
    });
  }

  return {
    async load() {
      const db = await open();
      try {
        return await new Promise<Uint8Array | null>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
          req.onsuccess = () => {
            const value = req.result as ArrayBuffer | Uint8Array | undefined;
            if (!value) return resolve(null);
            resolve(
              value instanceof Uint8Array ? value : new Uint8Array(value),
            );
          };
          req.onerror = () =>
            reject(req.error ?? new Error("IndexedDB read failed"));
        });
      } finally {
        db.close();
      }
    },
    async save(bytes: Uint8Array) {
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () =>
            reject(tx.error ?? new Error("IndexedDB write failed"));
        });
      } finally {
        db.close();
      }
    },
  };
}
