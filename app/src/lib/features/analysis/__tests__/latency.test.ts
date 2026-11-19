import { describe, expect, it } from "vitest";
import {
  createLatencyTracker,
  shouldFallBackToLite,
} from "../services/latency";

describe("createLatencyTracker", () => {
  it("reports the median of a rolling window", () => {
    const t = createLatencyTracker(3);
    expect(t.p50()).toBeNull();
    t.add(10);
    t.add(30);
    expect(t.p50()).toBe(20);
    t.add(20);
    expect(t.p50()).toBe(20);
    t.add(100); // window = 30, 20, 100
    expect(t.p50()).toBe(30);
    expect(t.size).toBe(3);
    expect(t.total).toBe(4);
  });

  it("ignores invalid samples and resets", () => {
    const t = createLatencyTracker(5);
    t.add(NaN);
    t.add(-1);
    expect(t.size).toBe(0);
    t.add(5);
    t.reset();
    expect(t.p50()).toBeNull();
    expect(t.total).toBe(0);
  });
});

describe("shouldFallBackToLite", () => {
  const opts = {
    policy: "auto" as const,
    liteFallbackP50Ms: 150,
    warmupFrames: 2,
    windowFrames: 3,
  };
  const fill = (vals: number[]) => {
    const t = createLatencyTracker(3);
    for (const v of vals) t.add(v);
    return t;
  };

  it("falls back once warm-up + a full slow window are measured", () => {
    expect(shouldFallBackToLite("full", fill([500, 500, 200, 200]), opts)).toBe(
      false,
    ); // total 4 < 5
    expect(
      shouldFallBackToLite("full", fill([500, 500, 200, 200, 200]), opts),
    ).toBe(true);
  });

  it("stays on full when fast enough", () => {
    expect(
      shouldFallBackToLite("full", fill([9, 9, 100, 120, 140]), opts),
    ).toBe(false);
  });

  it("never falls back when already lite or the policy is pinned", () => {
    const slow = fill([300, 300, 300, 300, 300]);
    expect(shouldFallBackToLite("lite", slow, opts)).toBe(false);
    expect(
      shouldFallBackToLite("full", slow, { ...opts, policy: "full" }),
    ).toBe(false);
  });
});
