import { describe, expect, it } from "vitest";
import { isNative, isWeb } from "../platform";

describe("platform helpers (injected platform value)", () => {
  it("isNative is true for ios and android", () => {
    expect(isNative("ios")).toBe(true);
    expect(isNative("android")).toBe(true);
    expect(isNative("web")).toBe(false);
  });

  it("isWeb is true only for web", () => {
    expect(isWeb("web")).toBe(true);
    expect(isWeb("ios")).toBe(false);
    expect(isWeb("android")).toBe(false);
  });
});
