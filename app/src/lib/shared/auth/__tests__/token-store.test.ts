// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createTokenStore } from "../token-store";

describe("createTokenStore", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a token and clears it", () => {
    const store = createTokenStore("test.token");
    expect(store.get()).toBeNull();
    store.set("abc123");
    expect(store.get()).toBe("abc123");
    expect(localStorage.getItem("test.token")).toBe("abc123");
    store.clear();
    expect(store.get()).toBeNull();
  });

  it("isolates by key", () => {
    const a = createTokenStore("k.a");
    const b = createTokenStore("k.b");
    a.set("A");
    expect(b.get()).toBeNull();
    expect(a.get()).toBe("A");
  });
});
