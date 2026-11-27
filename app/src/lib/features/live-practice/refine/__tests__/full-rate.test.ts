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

/** Detector returning a pose for every pushed frame (or `posed` of them); one batch per call. */
function session(posedEvery = 1) {
  const pushed: { timestamp: number }[] = [];
  return {
    pushed,
    detectOffline: () => {
      const batch: { timestamp: number }[] = [];
      return {
        push: (f: { timestamp: number; frameIndex: number }) => {
          batch.push(f);
          pushed.push(f);
        },
        finish: async () =>
          batch.map(
            (f, i): LandmarkFrame => ({
              frameIndex: i,
              timestamp: f.timestamp,
              poseConfidence: 0.9,
              landmarks: i % posedEvery === 0 ? lm : null,
            }),
          ),
        cancel: vi.fn(),
      };
    },
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

  it("re-detects only the guessed keyframe span, keeping live frames around it", async () => {
    decode30.mockClear();
    const reports: RefineReport[] = [];
    const r = createFullRateRefiner({
      session: session(),
      decode: decode30,
      span: () => ({ fromTs: 1500, toTs: 2200 }),
    });
    r.onReport((x) => reports.push(x));
    r.setRecorder(recorder(500));
    const out = (await r.refine(liveWindow()))!;
    // Span ± 200 ms margin: pose clock 1300 → 2400 = clip 0.8 → 1.9 s.
    expect(decode30).toHaveBeenCalledTimes(1);
    expect(decode30.mock.calls[0]![1]).toBeCloseTo(0.8);
    expect(decode30.mock.calls[0]![2]).toBeCloseTo(1.9);
    // Live frames (10 fps) before and after, 30 fps in between.
    expect(out.filter((f) => f.timestamp < 1300).length).toBe(3);
    expect(out.filter((f) => f.timestamp > 2450).length).toBe(6);
    expect(
      out.filter((f) => f.timestamp >= 1300 && f.timestamp <= 2400).length,
    ).toBeGreaterThan(30);
    for (let i = 1; i < out.length; i++)
      expect(out[i]!.timestamp).toBeGreaterThan(out[i - 1]!.timestamp);
    expect(reports[0]).toMatchObject({
      ok: true,
      spanMs: 1100,
      windowMs: 2000,
      extended: false,
    });
  });

  it("extends the span once when a keyframe lands at its edge", async () => {
    decode30.mockClear();
    const reports: RefineReport[] = [];
    let calls = 0;
    const r = createFullRateRefiner({
      session: session(),
      decode: decode30,
      // Live guess, then (on the merged frames) Setup right at the edge.
      span: () =>
        calls++ === 0
          ? { fromTs: 1500, toTs: 2200 }
          : { fromTs: 1350, toTs: 2200 },
    });
    r.onReport((x) => reports.push(x));
    r.setRecorder(recorder(500));
    const out = (await r.refine(liveWindow()))!;
    expect(decode30).toHaveBeenCalledTimes(2);
    // Extended 300 ms earlier: 1000 → 1299 ms = clip 0.5 → 0.799 s.
    expect(decode30.mock.calls[1]![1]).toBeCloseTo(0.5);
    expect(reports[0]).toMatchObject({
      ok: true,
      extended: true,
      spanMs: 1400,
    });
    expect(out[0]!.timestamp).toBeCloseTo(1000, 0);
  });

  it("re-detects the whole window without a guess", async () => {
    decode30.mockClear();
    const r = createFullRateRefiner({
      session: session(),
      decode: decode30,
      span: () => null,
    });
    r.setRecorder(recorder(500));
    await r.refine(liveWindow());
    expect(decode30.mock.calls[0]![1]).toBeCloseTo(0.5);
    expect(decode30.mock.calls[0]![2]).toBeCloseTo(2.5);
  });

  it("re-detects the whole window when the guess is implausibly short", async () => {
    decode30.mockClear();
    const r = createFullRateRefiner({
      session: session(),
      decode: decode30,
      // Release guessed right at the window's start: 1000 → 1200 ms inside it.
      span: () => ({ fromTs: 0, toTs: 1000 }),
    });
    r.setRecorder(recorder(500));
    await r.refine(liveWindow());
    expect(decode30).toHaveBeenCalledTimes(1);
    expect(decode30.mock.calls[0]![1]).toBeCloseTo(0.5);
    expect(decode30.mock.calls[0]![2]).toBeCloseTo(2.5);
  });

  it("re-detects the pre-roll live tracking missed, from the recording", async () => {
    decode30.mockClear();
    const r = createFullRateRefiner({ session: session(), decode: decode30 });
    const rec = recorder(200);
    r.setRecorder(rec);
    // Live frames only from 1000 ms (tracking was paused), but the window
    // should start at 400 ms.
    const out = (await r.refine({ ...liveWindow(), fromTs: 400 }))!;
    expect(rec.takeCovering).toHaveBeenCalledWith(400);
    expect(decode30.mock.calls[0]![1]).toBeCloseTo(0.2);
    expect(out[0]!.timestamp).toBeLessThan(450);
    // Not before the recording started.
    decode30.mockClear();
    r.setRecorder(recorder(700));
    await r.refine({ ...liveWindow(), fromTs: 400 });
    expect(decode30.mock.calls[0]![1]).toBeCloseTo(0);
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

describe("full-rate refiner: frame cache (opt-in)", () => {
  it("uses the recording unless asked for the cache", async () => {
    decode30.mockClear();
    const r = createFullRateRefiner({
      session: cachedSession(0),
      decode: decode30,
      span: () => null,
    });
    r.setRecorder(recorder(500));
    r.begin!(2000, 500); // ignored without source: "cache" + earlyStart
    await r.refine(liveWindow());
    expect(decode30).toHaveBeenCalledTimes(1);
  });

  /** A session whose frame cache holds 30 fps frames from `from` ms. */
  function cachedSession(from: number, to = 3000) {
    const s = session();
    const frames: {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      timestamp: number;
    }[] = [];
    const add = (t: number) =>
      frames.push({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
        timestamp: t,
      });
    for (let t = from; t <= to + 1e-9; t += 1000 / 30) add(t);
    const subs = new Set<(f: (typeof frames)[number]) => void>();
    return {
      ...s,
      cachedFrames: (a: number, b: number) =>
        frames
          .filter((f) => f.timestamp >= a && f.timestamp <= b)
          .map((f) => ({ ...f })),
      onCachedFrame: (cb: (f: (typeof frames)[number]) => void) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      /** A new frame arrives (the shot goes on). */
      arrive(t: number) {
        add(t);
        for (const cb of subs) cb(frames.at(-1)!);
      },
    };
  }

  it("re-detects the span from the cache: no recording, no decode", async () => {
    decode30.mockClear();
    const reports: RefineReport[] = [];
    const s = cachedSession(0);
    const r = createFullRateRefiner({
      session: s,
      source: "cache",
      decode: decode30,
      span: () => ({ fromTs: 1500, toTs: 2200 }),
    });
    r.onReport((x) => reports.push(x));
    const out = (await r.refine(liveWindow()))!;
    expect(decode30).not.toHaveBeenCalled();
    expect(reports[0]).toMatchObject({
      ok: true,
      source: "cache",
      earlyFrames: 0,
    });
    // 30 fps over the span ± margin (1300 → 2400), live frames around it.
    const dense = out.filter((f) => f.timestamp >= 1300 && f.timestamp <= 2400);
    expect(dense.length).toBeGreaterThan(30);
    expect(out.filter((f) => f.timestamp < 1300).length).toBe(3);
  });

  it("starts at the trigger and keeps up with new frames, then finishes at the span's end", async () => {
    const reports: RefineReport[] = [];
    const s = cachedSession(0, 2000);
    const r = createFullRateRefiner({
      session: s,
      source: "cache",
      earlyStart: true,
      decode: decode30,
      span: () => ({ fromTs: 1500, toTs: 2200 }),
    });
    r.onReport((x) => reports.push(x));
    // Trigger at 2000: window from 500.
    r.begin!(2000, 500);
    const atTrigger = s.pushed.length;
    expect(atTrigger).toBeGreaterThan(40); // 500 → 2000 at 30 fps
    for (let t = 2000 + 1000 / 30; t <= 3000; t += 1000 / 30) s.arrive(t);
    expect(s.pushed.length).toBeGreaterThan(atTrigger + 25);
    const out = (await r.refine({ ...liveWindow(), fromTs: 500 }))!;
    expect(reports[0]).toMatchObject({ ok: true, source: "cache" });
    expect(reports[0]!.earlyFrames).toBeGreaterThan(70);
    // Dense from the window's start (500), not just the span.
    expect(out[0]!.timestamp).toBeLessThan(500 + 1000 / 30 + 1);
  });

  it("cache mode alone doesn't start early: begin is a no-op", async () => {
    const s = cachedSession(0, 2000);
    const r = createFullRateRefiner({ session: s, source: "cache" });
    r.begin!(2000, 500);
    expect(s.pushed).toHaveLength(0);
  });

  it("falls back to the recording when the cache doesn't reach back", async () => {
    decode30.mockClear();
    const reports: RefineReport[] = [];
    const r = createFullRateRefiner({
      session: cachedSession(1800),
      source: "cache",
      decode: decode30,
      span: () => null,
    });
    r.onReport((x) => reports.push(x));
    r.setRecorder(recorder(500));
    await r.refine(liveWindow());
    expect(decode30).toHaveBeenCalledTimes(1);
    expect(reports[0]).toMatchObject({ ok: true, source: "video" });
  });
});
