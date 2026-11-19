import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getVideoRetention, setVideoRetention } from "../video-retention";

describe("video retention (per-device)", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });

  it("defaults to 20 and round-trips a choice, including 0", () => {
    expect(getVideoRetention()).toBe(20);
    setVideoRetention(5);
    expect(getVideoRetention()).toBe(5);
    setVideoRetention(0);
    expect(getVideoRetention()).toBe(0);
  });

  it("ignores garbage", () => {
    store.set("shotcoach.videoRetention", "lots");
    expect(getVideoRetention()).toBe(20);
  });
});
