/**
 * Local per-shot video clip storage (on-device only — nothing is uploaded).
 * Clips are recorded in the live loop and keyed by the shot's id, so the
 * review screen can play the actual shot behind the pose overlay on the
 * device that recorded it.
 *
 * Retention: only the newest `cap` clips are kept (the "Keep video for last N
 * shots" setting; 0 = keep none). Older shots fall back to the skeleton.
 *
 * Backends:
 *  - web: IndexedDB (blobs can be large),
 *  - native (Capacitor iOS/Android): files in the app's data directory via
 *    @capacitor/filesystem, with a small JSON index,
 *  - memory / no-op for tests and environments without either.
 */
import { Directory, Filesystem } from "@capacitor/filesystem";
import { isNative } from "$lib/shared/config/platform";

export interface StoredClip {
  readonly blob: Blob;
  readonly mime: string;
  /**
   * The clip's first frame on the shot's pose-frame clock (ms), so pose frame
   * `t` plays at video time `(t − startFrameTs) / 1000`. Null on older clips
   * (review then approximates by spreading the shot across the clip).
   */
  readonly startFrameTs: number | null;
}

export interface ShotClipStore {
  /** Store a clip for a shot, then evict the oldest beyond the cap. */
  save(shotId: string, clip: StoredClip): Promise<void>;
  /** The stored clip for a shot, or null (none / another device / evicted). */
  get(shotId: string): Promise<StoredClip | null>;
  has(shotId: string): Promise<boolean>;
  /** Current retention cap (clips kept). */
  readonly cap: number;
  /** Change the cap and prune immediately. */
  setCap(cap: number): Promise<void>;
}

/** Default number of shot clips kept on-device (oldest evicted). */
export const DEFAULT_CLIP_CAP = 20;
/** Choices offered in Profile ("Keep video for last N shots"). */
export const CLIP_CAP_CHOICES = [0, 5, 10, 20, 50] as const;

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
  const keep = Math.max(0, cap);
  if (entries.length <= keep) return [];
  const sorted = [...entries].sort(
    (a, b) => a.createdAt - b.createdAt || (a.shotId < b.shotId ? -1 : 1),
  );
  return sorted.slice(0, entries.length - keep).map((e) => e.shotId);
}

/** A no-op store: save discards, get/has return empty. */
export function createNoopShotClipStore(): ShotClipStore {
  return {
    cap: 0,
    async save() {},
    async get() {
      return null;
    },
    async has() {
      return false;
    },
    async setCap() {},
  };
}

/** In-memory store (tests / fallback): same semantics, incl. the cap. */
export function createMemoryShotClipStore(
  cap = DEFAULT_CLIP_CAP,
): ShotClipStore {
  const clips = new Map<string, { clip: StoredClip; createdAt: number }>();
  let seq = 0;
  let limit = cap;
  const prune = () => {
    const metas = [...clips.entries()].map(([id, v]) => ({
      shotId: id,
      createdAt: v.createdAt,
    }));
    for (const id of clipsToEvict(metas, limit)) clips.delete(id);
  };
  return {
    get cap() {
      return limit;
    },
    async save(shotId, clip) {
      if (limit <= 0) return;
      clips.set(shotId, { clip, createdAt: Date.now() + seq++ });
      prune();
    },
    async get(shotId) {
      return clips.get(shotId)?.clip ?? null;
    },
    async has(shotId) {
      return clips.has(shotId);
    },
    async setCap(next) {
      limit = next;
      prune();
    },
  };
}

// ---- IndexedDB (web) --------------------------------------------------------

const IDB_NAME = "shotcoach-clips";
const IDB_STORE = "clips";

interface IdbRow {
  shotId: string;
  blob: Blob;
  createdAt: number;
  mime?: string;
  startFrameTs?: number | null;
}

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** IndexedDB-backed store. Falls back to no-op when IndexedDB is missing. */
export function createIdbShotClipStore(cap = DEFAULT_CLIP_CAP): ShotClipStore {
  if (!idbAvailable()) return createNoopShotClipStore();
  let limit = cap;

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

  function done(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB failed"));
    });
  }

  async function prune(db: IDBDatabase): Promise<void> {
    const metas = await new Promise<ClipMeta[]>((resolve, reject) => {
      const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).getAll();
      req.onsuccess = () =>
        resolve(
          (req.result as IdbRow[]).map((r) => ({
            shotId: r.shotId,
            createdAt: r.createdAt,
          })),
        );
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB read failed"));
    });
    const evict = clipsToEvict(metas, limit);
    if (evict.length === 0) return;
    const tx = db.transaction(IDB_STORE, "readwrite");
    for (const id of evict) tx.objectStore(IDB_STORE).delete(id);
    await done(tx);
  }

  async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const db = await open();
    try {
      return await fn(db);
    } finally {
      db.close();
    }
  }

  const store: ShotClipStore = {
    get cap() {
      return limit;
    },
    save(shotId, clip) {
      if (limit <= 0) return Promise.resolve();
      return withDb(async (db) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        const row: IdbRow = {
          shotId,
          blob: clip.blob,
          mime: clip.mime,
          startFrameTs: clip.startFrameTs,
          createdAt: Date.now(),
        };
        tx.objectStore(IDB_STORE).put(row);
        await done(tx);
        await prune(db);
      });
    },
    get(shotId) {
      return withDb(
        (db) =>
          new Promise<StoredClip | null>((resolve, reject) => {
            const req = db
              .transaction(IDB_STORE)
              .objectStore(IDB_STORE)
              .get(shotId);
            req.onsuccess = () => {
              const row = req.result as IdbRow | undefined;
              resolve(
                row
                  ? {
                      blob: row.blob,
                      mime: row.mime ?? row.blob.type,
                      startFrameTs: row.startFrameTs ?? null,
                    }
                  : null,
              );
            };
            req.onerror = () =>
              reject(req.error ?? new Error("IndexedDB read failed"));
          }),
      );
    },
    async has(shotId) {
      return (await store.get(shotId)) !== null;
    },
    setCap(next) {
      limit = next;
      return withDb(prune);
    },
  };
  return store;
}

// ---- Native filesystem (Capacitor iOS/Android) -----------------------------

/** The slice of @capacitor/filesystem used (injectable for tests). */
export interface FsLike {
  writeFile(o: {
    path: string;
    data: string;
    directory: Directory;
    recursive?: boolean;
  }): Promise<unknown>;
  readFile(o: { path: string; directory: Directory }): Promise<{
    data: string | Blob;
  }>;
  deleteFile(o: { path: string; directory: Directory }): Promise<void>;
}

interface FsIndexEntry extends ClipMeta {
  file: string;
  mime: string;
  startFrameTs: number | null;
}

const FS_DIR = "clips";
const FS_INDEX = `${FS_DIR}/index.json`;
const enc = "utf8" as const;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Files under the app's data directory + a JSON index (native apps). */
export function createFilesystemShotClipStore(
  cap = DEFAULT_CLIP_CAP,
  fs: FsLike = Filesystem as unknown as FsLike,
  dir: Directory = Directory.Data,
): ShotClipStore {
  let limit = cap;

  async function readIndex(): Promise<FsIndexEntry[]> {
    try {
      const { data } = await fs.readFile({ path: FS_INDEX, directory: dir });
      const text = typeof data === "string" ? data : await data.text();
      return JSON.parse(text) as FsIndexEntry[];
    } catch {
      return [];
    }
  }
  async function writeIndex(entries: FsIndexEntry[]): Promise<void> {
    await (fs.writeFile as (o: unknown) => Promise<unknown>)({
      path: FS_INDEX,
      data: JSON.stringify(entries),
      directory: dir,
      recursive: true,
      encoding: enc,
    });
  }
  async function prune(entries: FsIndexEntry[]): Promise<FsIndexEntry[]> {
    const evict = new Set(clipsToEvict(entries, limit));
    for (const e of entries) {
      if (!evict.has(e.shotId)) continue;
      await fs.deleteFile({ path: e.file, directory: dir }).catch(() => {});
    }
    return entries.filter((e) => !evict.has(e.shotId));
  }

  const store: ShotClipStore = {
    get cap() {
      return limit;
    },
    async save(shotId, clip) {
      if (limit <= 0) return;
      const ext = clip.mime.includes("mp4") ? "mp4" : "webm";
      const file = `${FS_DIR}/${shotId}.${ext}`;
      await fs.writeFile({
        path: file,
        data: await blobToBase64(clip.blob),
        directory: dir,
        recursive: true,
      });
      const entries = (await readIndex()).filter((e) => e.shotId !== shotId);
      entries.push({
        shotId,
        file,
        mime: clip.mime,
        startFrameTs: clip.startFrameTs,
        createdAt: Date.now(),
      });
      await writeIndex(await prune(entries));
    },
    async get(shotId) {
      const entry = (await readIndex()).find((e) => e.shotId === shotId);
      if (!entry) return null;
      try {
        const { data } = await fs.readFile({
          path: entry.file,
          directory: dir,
        });
        const blob =
          typeof data === "string" ? base64ToBlob(data, entry.mime) : data;
        return { blob, mime: entry.mime, startFrameTs: entry.startFrameTs };
      } catch {
        return null;
      }
    },
    async has(shotId) {
      return (await readIndex()).some((e) => e.shotId === shotId);
    },
    async setCap(next) {
      limit = next;
      await writeIndex(await prune(await readIndex()));
    },
  };
  return store;
}

/**
 * The clip store for this environment: app files on native, IndexedDB in the
 * browser, else no-op.
 */
export function getShotClipStore(cap = DEFAULT_CLIP_CAP): ShotClipStore {
  try {
    if (isNative()) return createFilesystemShotClipStore(cap);
  } catch {
    /* not in a Capacitor shell */
  }
  return idbAvailable()
    ? createIdbShotClipStore(cap)
    : createNoopShotClipStore();
}
