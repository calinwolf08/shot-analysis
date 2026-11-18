import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createShotClipRecorder,
  type RecorderLike,
} from "../shot-clip-recorder";

/** Fake MediaRecorders on a fake clock; each emits one chunk naming itself. */
function harness(segmentMs = 10_000, segments = 2) {
  let t = 0;
  const made: (RecorderLike & { id: number; stopped: boolean })[] = [];
  const recorder = createShotClipRecorder({} as MediaStream, {
    segmentMs,
    segments,
    now: () => t,
    tickMs: 100,
    makeRecorder: () => {
      const id = made.length;
      const r = {
        id,
        stopped: false,
        state: "inactive" as RecorderLike["state"],
        ondataavailable: null as RecorderLike["ondataavailable"],
        onstop: null as RecorderLike["onstop"],
        start() {
          r.state = "recording";
        },
        stop() {
          r.state = "inactive";
          r.stopped = true;
          r.ondataavailable?.({ data: new Blob([`seg${id}`]) });
          r.onstop?.();
        },
      };
      made.push(r);
      return r;
    },
  })!;
  // Step the fake clock with the timers (as real time would pass).
  const advance = (ms: number) => {
    for (let left = ms; left > 0; left -= 100) {
      const step = Math.min(100, left);
      t += step;
      vi.advanceTimersByTime(step);
    }
  };
  return { recorder, made, advance, now: () => t };
}

describe("createShotClipRecorder (ping-pong segments)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps two staggered segments rolling, each capped at segmentMs", () => {
    const { recorder, made, advance } = harness(10_000);
    recorder.start();
    expect(made).toHaveLength(1);
    advance(5_000);
    expect(made).toHaveLength(2); // second starts half a segment later
    advance(5_000);
    expect(made[0]!.stopped).toBe(true); // first rotated at 10 s
    expect(made).toHaveLength(3);
    expect(recorder.recording).toBe(true);
  });

  it("keeps the SHORTEST segment that still covers the shot", async () => {
    const { recorder, made, advance } = harness(10_000);
    recorder.start(); // seg0 @0
    advance(5_000); // seg1 @5000
    advance(3_000); // t = 8000
    // Shot (with pre-roll) from t = 6000 → seg1 (started 5000) covers it.
    const take = (await recorder.takeCovering(6_000))!;
    expect(await take.blob.text()).toBe("seg1");
    expect(take.startTs).toBe(5_000);
    expect(made[0]!.stopped).toBe(true); // other segment discarded
    expect(recorder.recording).toBe(false);
  });

  it("falls back to the oldest segment when none covers the shot start", async () => {
    const { recorder, advance } = harness(10_000);
    recorder.start(); // seg0 @0
    advance(5_000); // seg1 @5000
    const take = (await recorder.takeCovering(-1_000))!;
    expect(await take.blob.text()).toBe("seg0");
    expect(take.startTs).toBe(0);
  });

  it("a clip never spans more than one segment, however long you wait", async () => {
    const { recorder, advance, now } = harness(10_000);
    recorder.start();
    advance(60_000);
    const take = (await recorder.takeCovering(now() - 2_000))!;
    expect(now() - take.startTs).toBeLessThanOrEqual(10_000);
    expect(now() - take.startTs).toBeGreaterThanOrEqual(2_000);
  });

  it("discard stops everything; take after discard is null", async () => {
    const { recorder, made } = harness();
    recorder.start();
    recorder.discard();
    expect(made.every((r) => r.state === "inactive")).toBe(true);
    expect(await recorder.takeCovering(0)).toBeNull();
  });

  it("three staggered segments always reach back ≥ 2/3 of a segment", () => {
    const { recorder, advance, now } = harness(15_000, 3);
    recorder.start();
    // Long after start, at every moment some segment began ≥ 10 s ago.
    advance(47_300);
    const shotFrom = now() - 9_500; // shot + pre-roll began 9.5 s ago
    return recorder.takeCovering(shotFrom).then((take) => {
      expect(take).not.toBeNull();
      expect(take!.startTs).toBeLessThanOrEqual(shotFrom);
      expect(now() - take!.startTs).toBeLessThanOrEqual(15_000);
    });
  });
});
