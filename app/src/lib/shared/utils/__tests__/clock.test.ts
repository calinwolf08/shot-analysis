import { describe, expect, it } from "vitest";
import { createFakeClock, systemClock } from "../clock";

describe("systemClock", () => {
  it("returns the current epoch time", () => {
    const before = Date.now();
    const now = systemClock.now();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe("createFakeClock", () => {
  it("starts at the given time", () => {
    expect(createFakeClock(1000).now()).toBe(1000);
  });

  it("defaults to 0", () => {
    expect(createFakeClock().now()).toBe(0);
  });

  it("advances deterministically", () => {
    const clock = createFakeClock(100);
    clock.advance(50);
    expect(clock.now()).toBe(150);
    clock.advance(0);
    expect(clock.now()).toBe(150);
  });

  it("can jump to an absolute time", () => {
    const clock = createFakeClock(100);
    clock.set(5);
    expect(clock.now()).toBe(5);
  });

  it("rejects negative advances", () => {
    const clock = createFakeClock();
    expect(() => clock.advance(-1)).toThrow();
  });
});
