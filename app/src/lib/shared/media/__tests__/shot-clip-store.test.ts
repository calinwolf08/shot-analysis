import { describe, expect, it } from "vitest";
import { clipsToEvict, createMemoryShotClipStore } from "../shot-clip-store";

describe("clipsToEvict", () => {
  it("keeps everything under the cap", () => {
    const entries = [
      { shotId: "a", createdAt: 1 },
      { shotId: "b", createdAt: 2 },
    ];
    expect(clipsToEvict(entries, 5)).toEqual([]);
  });

  it("evicts the oldest beyond the cap", () => {
    const entries = [
      { shotId: "new", createdAt: 30 },
      { shotId: "old", createdAt: 10 },
      { shotId: "mid", createdAt: 20 },
    ];
    expect(clipsToEvict(entries, 2)).toEqual(["old"]);
    expect(clipsToEvict(entries, 1)).toEqual(["old", "mid"]);
  });
});

describe("createMemoryShotClipStore", () => {
  it("stores and retrieves a clip by shot id", async () => {
    const store = createMemoryShotClipStore();
    const blob = new Blob(["x"], { type: "video/webm" });
    await store.save("shot-1", blob);
    expect(await store.has("shot-1")).toBe(true);
    expect(await store.get("shot-1")).toBe(blob);
    expect(await store.get("missing")).toBeNull();
    expect(await store.has("missing")).toBe(false);
  });

  it("enforces the cap, evicting the oldest", async () => {
    const store = createMemoryShotClipStore(2);
    await store.save("a", new Blob(["a"]));
    await store.save("b", new Blob(["b"]));
    await store.save("c", new Blob(["c"]));
    expect(await store.has("a")).toBe(false); // oldest evicted
    expect(await store.has("b")).toBe(true);
    expect(await store.has("c")).toBe(true);
  });
});
