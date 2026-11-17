import { describe, expect, it } from "vitest";
import { Directory } from "@capacitor/filesystem";
import {
  clipsToEvict,
  createFilesystemShotClipStore,
  createMemoryShotClipStore,
  type FsLike,
  type StoredClip,
} from "../shot-clip-store";

const clip = (s: string, startFrameTs: number | null = 100): StoredClip => ({
  blob: new Blob([s], { type: "video/webm" }),
  mime: "video/webm",
  startFrameTs,
});

describe("clipsToEvict", () => {
  it("keeps everything under the cap", () => {
    const entries = [
      { shotId: "a", createdAt: 1 },
      { shotId: "b", createdAt: 2 },
    ];
    expect(clipsToEvict(entries, 5)).toEqual([]);
  });

  it("evicts the oldest beyond the cap; cap 0 evicts all", () => {
    const entries = [
      { shotId: "new", createdAt: 30 },
      { shotId: "old", createdAt: 10 },
      { shotId: "mid", createdAt: 20 },
    ];
    expect(clipsToEvict(entries, 2)).toEqual(["old"]);
    expect(clipsToEvict(entries, 1)).toEqual(["old", "mid"]);
    expect(clipsToEvict(entries, 0)).toEqual(["old", "mid", "new"]);
  });
});

describe("createMemoryShotClipStore", () => {
  it("stores and retrieves a clip with its sync start", async () => {
    const store = createMemoryShotClipStore();
    const c = clip("x", 1234);
    await store.save("shot-1", c);
    expect(await store.has("shot-1")).toBe(true);
    expect(await store.get("shot-1")).toEqual(c);
    expect(await store.get("missing")).toBeNull();
  });

  it("enforces the cap, evicting the oldest", async () => {
    const store = createMemoryShotClipStore(2);
    await store.save("a", clip("a"));
    await store.save("b", clip("b"));
    await store.save("c", clip("c"));
    expect(await store.has("a")).toBe(false);
    expect(await store.has("c")).toBe(true);
  });

  it("lowering the cap prunes immediately; cap 0 stores nothing", async () => {
    const store = createMemoryShotClipStore(5);
    for (const id of ["a", "b", "c"]) await store.save(id, clip(id));
    await store.setCap(1);
    expect(store.cap).toBe(1);
    expect(await store.has("b")).toBe(false);
    expect(await store.has("c")).toBe(true);
    await store.setCap(0);
    await store.save("d", clip("d"));
    expect(await store.has("c")).toBe(false);
    expect(await store.has("d")).toBe(false);
  });
});

/** In-memory stand-in for @capacitor/filesystem. */
function fakeFs() {
  const files = new Map<string, string>();
  const fs: FsLike = {
    async writeFile({ path, data }) {
      files.set(path, data);
      return {};
    },
    async readFile({ path }) {
      const data = files.get(path);
      if (data === undefined) throw new Error("ENOENT");
      return { data };
    },
    async deleteFile({ path }) {
      files.delete(path);
    },
  };
  return { fs, files };
}

describe("createFilesystemShotClipStore (native apps)", () => {
  it("round-trips a clip as a file with its metadata", async () => {
    const { fs, files } = fakeFs();
    const store = createFilesystemShotClipStore(20, fs, Directory.Data);
    await store.save("s1", {
      blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: "video/mp4" }),
      mime: "video/mp4",
      startFrameTs: 42,
    });
    expect(files.has("clips/s1.mp4")).toBe(true);
    const got = (await store.get("s1"))!;
    expect(got.mime).toBe("video/mp4");
    expect(got.startFrameTs).toBe(42);
    expect([...new Uint8Array(await got.blob.arrayBuffer())]).toEqual([
      1, 2, 3, 250,
    ]);
    expect(await store.has("s1")).toBe(true);
    expect(await store.get("nope")).toBeNull();
  });

  it("evicts the oldest files beyond the cap and on setCap", async () => {
    const { fs, files } = fakeFs();
    const store = createFilesystemShotClipStore(2, fs, Directory.Data);
    for (const id of ["a", "b", "c"]) {
      await store.save(id, clip(id));
      await new Promise((r) => setTimeout(r, 2)); // distinct createdAt
    }
    expect(files.has("clips/a.webm")).toBe(false);
    expect(await store.has("a")).toBe(false);
    await store.setCap(1);
    expect(files.has("clips/b.webm")).toBe(false);
    expect(await store.has("c")).toBe(true);
  });
});
