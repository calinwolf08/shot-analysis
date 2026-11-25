import { beforeEach, describe, expect, it } from "vitest";
import { deviceDebugEnabled } from "../debug-mode";

const u = (q: string) => new URL(`https://app.test/shots${q}`);

describe("device debug mode", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as unknown as Storage;
  });

  it("is off by default", () => {
    expect(deviceDebugEnabled(u(""))).toBe(false);
  });

  it("?debug=on is remembered on later pages until ?debug=off", () => {
    expect(deviceDebugEnabled(u("?debug=on"))).toBe(true);
    expect(deviceDebugEnabled(u(""))).toBe(true);
    expect(deviceDebugEnabled(u("?debug=off"))).toBe(false);
    expect(deviceDebugEnabled(u(""))).toBe(false);
  });

  it("the older capture/video values turn the same mode on", () => {
    expect(deviceDebugEnabled(u("?debug=video"))).toBe(true);
    expect(deviceDebugEnabled(u(""))).toBe(true);
    deviceDebugEnabled(u("?debug=off"));
    expect(deviceDebugEnabled(u("?debug=capture"))).toBe(true);
  });

  it("the dev overlay value doesn't touch it", () => {
    expect(deviceDebugEnabled(u("?debug=live"))).toBe(false);
  });
});
