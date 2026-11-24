import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LiveTargetsV3, PoseData } from "basketball-shot-analysis";
import { poseDataToLandmarkFrames } from "$lib/features/analysis/replay/replay-pipeline";
import { createLiveCapture, type LiveCaptureFile } from "../live-capture";
import { replayCapture } from "../replay-capture";

const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets-v3.json"),
    "utf8",
  ),
) as LiveTargetsV3;
const fixture = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "src-tests",
      "fixtures",
      "poses",
      "20201212_134104.json",
    ),
    "utf8",
  ),
) as PoseData;
const frames = poseDataToLandmarkFrames(fixture);

/** The fixture recorded as the app would (frame-clock ms timestamps). */
function captured(windowMs = 60_000, armed?: boolean): LiveCaptureFile {
  const cap = createLiveCapture(windowMs);
  cap.setMeta({ shootingHand: "right" });
  frames.forEach((f, i) => {
    cap.frame(f);
    if (armed !== undefined && i === 0) cap.event("armed", { armed });
  });
  return cap.export({
    fps: fixture.fps,
    frameSize: { width: fixture.width, height: fixture.height },
  });
}

describe("live capture", () => {
  it("exports the pose stream in the replay-fixture format + events", () => {
    const f = captured();
    expect(f.version).toBe(1);
    expect(f.poses.frames).toHaveLength(frames.length);
    expect(f.poses.width).toBe(fixture.width);
    const first = f.poses.frames.find(
      (x) => (x as { landmarks: unknown }).landmarks,
    ) as {
      landmarks: { x: number }[];
    };
    expect(first.landmarks).toHaveLength(33);
    // Rounded to 4 decimals.
    expect(
      String(first.landmarks[0]!.x).split(".")[1]?.length ?? 0,
    ).toBeLessThanOrEqual(4);
    expect(f.events.map((e) => e.kind)).toEqual([]);
  });

  it("keeps only the last window", () => {
    const span = frames.at(-1)!.timestamp - frames[0]!.timestamp;
    const f = captured(span / 2);
    const ts = f.poses.frames.map(
      (x) => (x as { timestamp: number }).timestamp,
    );
    expect(ts.at(-1)! - ts[0]!).toBeLessThanOrEqual(span / 2 + 1);
    expect(f.poses.frames.length).toBeLessThan(frames.length);
  });

  it("thins velocity samples to ~10/s", () => {
    const cap = createLiveCapture();
    for (let t = 0; t < 1000; t += 33)
      cap.sample({
        t,
        state: "READY",
        posePresent: true,
        velocity: 0,
        riseVelocity: 1,
        settleVelocity: 0.1,
        settledForMs: null,
      });
    expect(cap.export().samples.length).toBeLessThanOrEqual(11);
  });
});

describe("replaying a capture", () => {
  it("finds the shot the fixture holds, through the live coordinator + scoring", async () => {
    const r = await replayCapture(captured(), targets);
    expect(r.reps.some((x) => x.outcome === "shot")).toBe(true);
    expect(r.posedShare).toBeGreaterThan(0.5);
    expect(r.findings.join(" ")).toMatch(/ARE recognized/);
  });

  it("explains a player who never counted as positioned", async () => {
    const r = await replayCapture(captured(60_000, false), targets);
    expect(r.armedShare).toBe(0);
    expect(r.reps).toHaveLength(0);
    expect(r.findings[0]).toMatch(/positioned/);
    // …and with arming ignored, the shot is there.
    const free = await replayCapture(captured(60_000, false), targets, {
      ignoreArming: true,
    });
    expect(free.reps.some((x) => x.outcome === "shot")).toBe(true);
  });
});

// A real capture from a phone: CAPTURE=/path/to/file.json npm run replay:capture
const CAPTURE = process.env.CAPTURE;
describe.skipIf(!CAPTURE)("capture from a device", () => {
  it("report", async () => {
    const file = JSON.parse(readFileSync(CAPTURE!, "utf8")) as LiveCaptureFile;
    const r = await replayCapture(file, targets);
    const free = await replayCapture(file, targets, { ignoreArming: true });
    const lines = [
      `Capture: ${(r.spanMs / 1000).toFixed(1)} s, ${r.frames} frames (${Math.round(r.posedShare * 100)}% with a pose), ${r.fps} fps nominal`,
      `Device: ${JSON.stringify((file.meta as { userAgent?: string }).userAgent)}`,
      `Positioned (armed): ${r.armedShare === null ? "not logged" : `${Math.round(r.armedShare * 100)}%`}`,
      `Wrist rise: peak ${r.peakVelocity?.toFixed(2)} vs trigger ${r.riseVelocity?.toFixed(2)}; near misses ${r.nearTriggers}`,
      `Reps recorded on the phone: ${r.recordedReps}`,
      `Replayed reps: ${r.reps.map((x) => `${(x.startedAt / 1000).toFixed(1)}s ${x.outcome} — ${x.detail}`).join(" | ") || "none"}`,
      `Replayed ignoring positioning: ${free.reps.map((x) => `${(x.startedAt / 1000).toFixed(1)}s ${x.outcome} — ${x.detail}`).join(" | ") || "none"}`,
      "Findings:",
      ...r.findings.map((f) => `  - ${f}`),
      "Timeline:",
      ...r.timeline.map((l) => `  ${l}`),
    ];
    console.log(lines.join("\n"));
  });
});
