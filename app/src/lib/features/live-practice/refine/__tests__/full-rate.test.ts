import { describe, expect, it, vi } from "vitest";
import type { LandmarkFrame } from "$lib/features/analysis";
import type { ShotClipRecorder } from "$lib/shared/media/shot-clip-recorder";
import type { RepWindow } from "../../coordinator/coordinator";
import { createFullRateRefiner, type RefineReport } from "../full-rate";

const lm = [{ x: 0.5, y: 0.5, z: 0, visibility: 1, confidence: 1 }];

/** 10 fps live window 1000–3000 ms, pose clock = wall clock + 0. */
function liveWindow(): RepWindow {
  const frames: LandmarkFrame[] = [];
  for (let t = 1000; t <= 3000; t += 100)
    frames.push({
      frameIndex: frames.length,
      timestamp: t,
      captureTs: t,
      poseConfidence: 0.9,
      landmarks: lm,
    });
  return { frames, startedAt: 2000, endedAt: 3000, trigger: "settled" };
}

function recorder(startTs: number): ShotClipRecorder & { starts: number } {
  const r = {
    starts: 0,
    recording: true,
    start: vi.fn(() => r.starts++),
    takeCovering: vi.fn(async () => ({
      blob: new Blob(["x"]),
      mime: "video/webm",
      startTs,
    })),
    discard: vi.fn(),
    hold: vi.fn(),
  };
  return r as unknown as ShotClipRecorder & { starts: number };
}

/** Detector returning a pose for every pushed frame (or `posed` of them). */
function session(posedEvery = 1) {
  const pushed: { timestamp: number }[] = [];
  return {
    pushed,
    detectOffline: () => ({
      push: (f: { timestamp: number; frameIndex: number }) => pushed.push(f),
      finish: async () =>
        pushed.map(
          (f, i): LandmarkFrame => ({
            frameIndex: i,
            timestamp: f.timestamp,
            poseConfidence: 0.9,
            landmarks: i % posedEvery === 0 ? lm : null,
          }),
        ),
      cancel: vi.fn(),
    }),
  };
}

/** Decoder emitting 30 fps frames over [from, to] (clip seconds). */
const decode30 = vi.fn(
  async (
    _b: Blob,
    from: number,
    to: number,
    onFrame: (f: {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      mediaTime: number;
    }) => void,
  ) => {
    let n = 0;
    for (let t = from; t <= to + 1e-9; t += 1 / 30, n++)
      onFrame({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
        mediaTime: t,
      });
    return {
      frames: n,
      start: "seek" as const,
      method: "rvfc" as const,
      stopped: "end" as const,
      firstTime: from,
      lastTime: to,
    };
  },
);

describe("full-rate refiner", () => {
  it("re-detects the window from the clip at 30 fps on the pose clock", async () => {
    const s = session();
    const rec = recorder(500); // clip starts at 500 ms
    const reports: RefineReport[] = [];
    const r = createFullRateRefiner({ session: s, decode: decode30 });
    r.onReport((x) => reports.push(x));
    const restart = vi.fn();
    r.setRecorder(rec, restart);
    const w = liveWindow();
    const out = await r.refine(w);
    // Clip time 0.5 s → 2.5 s = pose clock 1000 → 3000 ms.
    expect(decode30.mock.calls[0]![1]).toBeCloseTo(0.5);
    expect(decode30.mock.calls[0]![2]).toBeCloseTo(2.5);
    expect(out).not.toBeNull();
    expect(out!.length).toBeGreaterThan(55);
    expect(out![0]!.timestamp).toBeCloseTo(1000, 0);
    expect(out!.at(-1)!.timestamp).toBeCloseTo(3000, -1);
    expect(reports[0]!.ok).toBe(true);
    expect(reports[0]!.fps).toBeCloseTo(30, 0);
    // The recorder rolls again right away; the clip is kept for the shot.
    expect(restart).toHaveBeenCalledTimes(1);
    expect(r.takeClip(w.startedAt)?.startTs).toBe(500);
    expect(r.takeClip(w.startedAt)).toBeNull(); // only once
  });

  it("falls back when fewer frames have a pose than live did", async () => {
    const r = createFullRateRefiner({ session: session(10), decode: decode30 });
    const reports: RefineReport[] = [];
    r.onReport((x) => reports.push(x));
    r.setRecorder(recorder(500));
    expect(await r.refine(liveWindow())).toBeNull();
    expect(reports[0]).toMatchObject({
      ok: false,
      reason: "too few posed frames",
    });
  });

  it("falls back without a recording", async () => {
    const r = createFullRateRefiner({ session: session(), decode: decode30 });
    expect(await r.refine(liveWindow())).toBeNull();
    const rec = recorder(0);
    (rec as { recording: boolean }).recording = false;
    r.setRecorder(rec);
    expect(await r.refine(liveWindow())).toBeNull();
  });
});
