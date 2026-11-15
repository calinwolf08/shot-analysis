import { describe, expect, it } from "vitest";
import type { LandmarkFrame } from "$lib/features/analysis";
import { createPresenceTracker } from "../loop/presence";

/** Landmark set where the "full body" key points have the given visibility. */
function landmarks(visibility: number) {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility,
    confidence: visibility,
  }));
}

function frame(
  overrides: Partial<LandmarkFrame> & { landmarks: LandmarkFrame["landmarks"] },
): LandmarkFrame {
  return { frameIndex: 0, timestamp: 0, poseConfidence: 0.9, ...overrides };
}

describe("createPresenceTracker", () => {
  it("goes full on a full-body frame and decays to none when frames stop", () => {
    let now = 0;
    const tracker = createPresenceTracker(
      { staleMs: 700, fullHoldMs: 600 },
      () => now,
    );
    expect(tracker.evaluate()).toBe("none");
    expect(tracker.update(frame({ landmarks: landmarks(0.9) }))).toBe("full");

    now = 500; // inside both windows
    expect(tracker.evaluate()).toBe("full");
    now = 650; // full hold expired, pose still fresh
    expect(tracker.evaluate()).toBe("partial");
    now = 800; // pose stale too
    expect(tracker.evaluate()).toBe("none");
  });

  it("reports partial when a pose lacks full-body visibility", () => {
    const now = 0;
    const tracker = createPresenceTracker({}, () => now);
    // Ankles & co. below the visibility threshold → tracked but partial.
    expect(tracker.update(frame({ landmarks: landmarks(0.3) }))).toBe(
      "partial",
    );
  });

  it("ignores frames with no pose", () => {
    let now = 0;
    const tracker = createPresenceTracker({}, () => now);
    expect(tracker.update(frame({ landmarks: null }))).toBe("none");
    tracker.update(frame({ landmarks: landmarks(0.9) }));
    now = 100;
    // A pose-less frame must not refresh the hold.
    expect(tracker.update(frame({ landmarks: null }))).toBe("full");
    now = 10_000;
    expect(tracker.update(frame({ landmarks: null }))).toBe("none");
  });
});
