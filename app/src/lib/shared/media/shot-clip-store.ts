/**
 * Local per-shot video clip storage (web-first, on-device only). Clips are
 * recorded in the live loop and keyed by the shot's id, so the review screen
 * can play the actual shot back behind the pose overlay — on the device that
 * recorded it. Nothing is uploaded; clearing site data clears clips.
 *
 * Backed by IndexedDB in the browser (blobs can be large) with a cap so storage
 * can't grow unbounded. A no-op store stands in where IndexedDB is unavailable
 * (SSR, replay/e2e, locked-down webviews), so callers never branch on platform.
 */

export interface ShotClipStore {
  /** Store a clip for a shot, then evict oldest beyond the cap. */
  save(shotId: string, blob: Blob): Promise<void>;
  /** The stored clip for a shot, or null when none (e.g. another device). */
  get(shotId: string): Promise<Blob | null>;
  has(shotId: string): Promise<boolean>;
}

/** Default number of shot clips kept on-device (oldest evicted). */
export const DEFAULT_CLIP_CAP = 50;

interface ClipMeta {
  readonly shotId: string;
  readonly createdAt: number;
}

/**
 * Pure: given existing clip metadata (any order) and a cap, the ids to evict so
 * only the newest `cap` remain. Oldest-first by createdAt, ties broken by id.
 */
export function clipsToEvict(
  entries: readonly ClipMeta[],
  cap: number,
): string[] {
  if (entries.length <= cap) return [];
  const sorted = [...entries].sort(
    (a, b) => a.createdAt - b.createdAt || (a.shotId < b.shotId ? -1 : 1),
  );
  return sorted.slice(0, entries.length - cap).map((e) => e.shotId);
}

/** A no-op store: save discards, get/has return empty. */
export function createNoopShotClipStore(): ShotClipStore {
  return {
    async save() {},
    async get() {
      return null;
    },
    async has() {
      return false;
    },
  };
}

/** In-memory store (tests / fallback): same semantics, incl. the cap. */
export function createMemoryShotClipStore(
  cap = DEFAULT_CLIP_CAP,
): ShotClipStore {
  const clips = new Map<string, { blob: Blob; createdAt: number }>();
  let seq = 0;
  return {
    async save(shotId, blob) {
      clips.set(shotId, { blob, createdAt: Date.now() + seq++ });
      const metas = [...clips.entries()].map(([id, v]) => ({
        shotId: id,
        createdAt: v.createdAt,
      }));
      for (const id of clipsToEvict(metas, cap)) clips.delete(id);
    },
    async get(shotId) {
      return clips.get(shotId)?.blob ?? null;
    },
    async has(shotId) {
      return clips.has(shotId);
    },
  };
}

const IDB_NAME = "shotcoach-clips";
const IDB_STORE = "clips";

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** IndexedDB-backed store. Falls back to no-op when IndexedDB is missing. */
export function createIdbShotClipStore(cap = DEFAULT_CLIP_CAP): ShotClipStore {
  if (!idbAvailable()) return createNoopShotClipStore();

  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE, { keyPath: "shotId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB open failed"));
    });
  }

  async function prune(db: IDBDatabase): Promise<void> {
    const metas = await new Promise<ClipMeta[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () =>
        resolve(
          (req.result as { shotId: string; createdAt: number }[]).map((r) => ({
            shotId: r.shotId,
            createdAt: r.createdAt,
          })),
        );
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB read failed"));
    });
    const evict = clipsToEvict(metas, cap);
    if (evict.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      for (const id of evict) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB prune failed"));
    });
  }

  return {
    async save(shotId, blob) {
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put({
            shotId,
            blob,
            createdAt: Date.now(),
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () =>
            reject(tx.error ?? new Error("IndexedDB write failed"));
        });
        await prune(db);
      } finally {
        db.close();
      }
    },
    async get(shotId) {
      const db = await open();
      try {
        return await new Promise<Blob | null>((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const req = tx.objectStore(IDB_STORE).get(shotId);
          req.onsuccess = () => {
            const row = req.result as { blob: Blob } | undefined;
            resolve(row?.blob ?? null);
          };
          req.onerror = () =>
            reject(req.error ?? new Error("IndexedDB read failed"));
        });
      } finally {
        db.close();
      }
    },
    async has(shotId) {
      return (await this.get(shotId)) !== null;
    },
  };
}

/** The clip store for this environment: IndexedDB in the browser, else no-op. */
export function getShotClipStore(cap = DEFAULT_CLIP_CAP): ShotClipStore {
  return idbAvailable()
    ? createIdbShotClipStore(cap)
    : createNoopShotClipStore();
}
