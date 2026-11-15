import { describe, it, expect } from "vitest";
import { summarize } from "./stats";

describe("summarize", () => {
  it("returns null for no finite values", () => {
    expect(summarize([])).toBeNull();
    expect(summarize([NaN, Infinity, -Infinity])).toBeNull();
  });

  it("filters out non-finite values before summarizing", () => {
    const s = summarize([1, NaN, 2, Infinity, 3])!;
    expect(s.n).toBe(3);
    expect(s.median).toBe(2);
    expect(s.min).toBe(1);
    expect(s.max).toBe(3);
  });

  it("handles a single value (no interpolation to do)", () => {
    const s = summarize([7])!;
    expect(s).toEqual({
      n: 1,
      median: 7,
      min: 7,
      max: 7,
      p25: 7,
      p75: 7,
      iqr: 0,
    });
  });

  it("computes median/quartiles on a known odd-length set", () => {
    // sorted: 1 2 3 4 5
    const s = summarize([3, 1, 5, 2, 4])!;
    expect(s.median).toBe(3);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    // p=0.25 → idx 1.0 → value 2; p=0.75 → idx 3.0 → value 4
    expect(s.p25).toBe(2);
    expect(s.p75).toBe(4);
    expect(s.iqr).toBe(2);
  });

  it("linearly interpolates quantiles on an even-length set", () => {
    // sorted: 1 2 3 4
    const s = summarize([4, 2, 1, 3])!;
    // median: idx 1.5 → 2 + (3-2)*0.5 = 2.5
    expect(s.median).toBeCloseTo(2.5, 10);
    // p25: idx 0.75 → 1 + (2-1)*0.75 = 1.75
    expect(s.p25).toBeCloseTo(1.75, 10);
    // p75: idx 2.25 → 3 + (4-3)*0.25 = 3.25
    expect(s.p75).toBeCloseTo(3.25, 10);
    expect(s.iqr).toBeCloseTo(1.5, 10);
  });

  it("sorts input, so order does not affect results", () => {
    const a = summarize([5, 1, 3, 2, 4])!;
    const b = summarize([1, 2, 3, 4, 5])!;
    expect(a).toEqual(b);
  });

  it("yields zero IQR for identical values", () => {
    const s = summarize([2, 2, 2, 2])!;
    expect(s.median).toBe(2);
    expect(s.iqr).toBe(0);
    expect(s.p25).toBe(2);
    expect(s.p75).toBe(2);
  });

  it("handles negative values", () => {
    const s = summarize([-3, -1, -2])!;
    expect(s.min).toBe(-3);
    expect(s.max).toBe(-1);
    expect(s.median).toBe(-2);
  });
});
