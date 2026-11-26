/**
 * Replays a `?debug=capture` file through the SAME live coordinator and
 * scoring core the app uses, and explains what happened: whether the player
 * was positioned (armed), whether wrist motion reached the rep trigger, what
 * each analyzed rep found, and why shots were rejected.
 *
 *   CAPTURE=path/to/shotcoach-capture.json npm run replay:capture
 */
import type { KeyframeTargets } from "basketball-shot-analysis";
import type { LandmarkFrame } from "$lib/features/analysis";
import { landmarkFramesToPoseData } from "$lib/features/analysis/replay/replay-pipeline";
import { createLiveRepCoordinator } from "../coordinator/coordinator";
import { analyzeAndScore } from "../pipeline/core";
import { runReplayAnalysis } from "$lib/features/analysis/replay/replay-pipeline";
import type { CaptureEvent, LiveCaptureFile } from "./live-capture";

export interface ReplayRep {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly frames: number;
  readonly outcome: "shot" | "rejected" | "no-shot" | "failed";
  readonly detail: string;
}

export interface CaptureReport {
  readonly spanMs: number;
  readonly frames: number;
  readonly posedShare: number;
  readonly fps: number;
  /** Share of the capture the player counted as positioned (armed). */
  readonly armedShare: number | null;
  readonly peakVelocity: number | null;
  readonly riseVelocity: number | null;
  readonly nearTriggers: number;
  readonly recordedReps: number;
  readonly reps: readonly ReplayRep[];
  /** Plain-language conclusions, most likely cause first. */
  readonly findings: readonly string[];
  /** The recorded event log, readable. */
  readonly timeline: readonly string[];
}

function toFrames(file: LiveCaptureFile): LandmarkFrame[] {
  return (file.poses.frames as LandmarkFrame[]).map((f) => ({
    ...f,
    landmarks: f.landmarks
      ? f.landmarks.map((l) => ({
          ...l,
          z: l.z ?? 0,
          confidence: l.confidence ?? l.visibility,
        }))
      : null,
  }));
}

/** Arming over time from the recorded "armed" events (null: never logged). */
function armedAt(
  events: readonly CaptureEvent[],
): ((t: number) => boolean) | null {
  const changes = events
    .filter((e) => e.kind === "armed")
    .map((e) => ({ t: e.t, armed: (e.data as { armed: boolean }).armed }));
  if (changes.length === 0) return null;
  return (t) => {
    let a = !changes[0]!.armed; // before the first change: the opposite
    for (const c of changes) if (c.t <= t) a = c.armed;
    return a;
  };
}

function fmtEvent(e: CaptureEvent, t0: number): string {
  const s = ((e.t - t0) / 1000).toFixed(2).padStart(6);
  return `${s}s ${e.kind}${e.data !== undefined ? ` ${JSON.stringify(e.data)}` : ""}`;
}

export async function replayCapture(
  file: LiveCaptureFile,
  targets: KeyframeTargets,
  opts: { ignoreArming?: boolean } = {},
): Promise<CaptureReport> {
  const frames = toFrames(file);
  const meta = file.meta as {
    shootingHand?: "left" | "right";
    tuning?: { readiness?: { maxSideSeparation?: number } };
  };
  const shootingHand = meta.shootingHand ?? "right";
  const fps = file.poses.fps || 30;
  const size = { width: file.poses.width, height: file.poses.height };
  const t0 = frames[0]?.timestamp ?? 0;
  const armedFn = opts.ignoreArming ? null : armedAt(file.events);

  const reps: ReplayRep[] = [];
  let pending: Promise<unknown> | null = null;
  const coordinator = createLiveRepCoordinator(
    {
      analyze: async (w) =>
        runReplayAnalysis(w, { shootingHand, profile: "pro-form" }, { fps }),
    },
    { shootingHand },
  );
  let peak = 0;
  let rise = null as number | null;
  // Only frames where a rep could start count (positioned, pose present):
  // the junk frames as the player walks out of view can spike the velocity.
  let frameArmed = true;
  let peakTorso = 0;
  coordinator.on("debug", (d) => {
    rise = d.riseVelocity;
    if (!frameArmed || !d.posePresent || d.state !== "READY") return;
    peak = Math.max(peak, d.smoothedVelocity);
    if (d.wristOverhead) peakTorso = Math.max(peakTorso, d.torsoVelocity);
  });
  const repCauses: string[] = [];
  coordinator.on("repStarted", (e) => repCauses.push(e.cause));
  let near = 0;
  coordinator.on("nearTrigger", () => near++);
  coordinator.on("repResult", (e) => {
    try {
      onResult(e);
    } catch (err) {
      reps.push({
        startedAt: e.window.startedAt - t0,
        endedAt: e.window.endedAt - t0,
        frames: e.window.frames.length,
        outcome: "failed",
        detail: `scoring threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      coordinator.dismissFeedback();
    }
  });
  const onResult = (
    e: Parameters<Parameters<typeof coordinator.on<"repResult">>[1]>[0],
  ) => {
    const pose = landmarkFramesToPoseData(e.window.frames, fps, size);
    const focusIndex = e.window.frames.filter(
      (f) => f.landmarks !== null && f.timestamp < e.window.startedAt,
    ).length;
    const gate = {
      maxSideSeparation: meta.tuning?.readiness?.maxSideSeparation ?? 0.5,
    };
    const r = analyzeAndScore(
      pose,
      { shootingHand, profile: "pro-form" },
      targets,
      gate,
      focusIndex,
    );
    const base = {
      startedAt: e.window.startedAt - t0,
      endedAt: e.window.endedAt - t0,
      frames: e.window.frames.length,
    };
    if (r.shots.length > 0) {
      const s = r.shots[0]!;
      reps.push({
        ...base,
        outcome: "shot",
        detail: `scored ${s.scorecard.overall?.toFixed(1) ?? "–"} (${s.analysis.orientation})`,
      });
    } else if (r.rejected.length > 0) {
      reps.push({
        ...base,
        outcome: "rejected",
        detail: r.rejected
          .map((x) => `read as ${x.orientation}, needs ${x.allowed.join("/")}`)
          .join("; "),
      });
    } else {
      reps.push({
        ...base,
        outcome: "no-shot",
        detail: "shot detected but nothing scored",
      });
    }
    coordinator.dismissFeedback();
  };
  coordinator.on("noShot", (e) => {
    reps.push({
      startedAt: e.window.startedAt - t0,
      endedAt: e.window.endedAt - t0,
      frames: e.window.frames.length,
      outcome: e.reason === "analysis-failed" ? "failed" : "no-shot",
      detail:
        e.reason === "analysis-failed"
          ? "analysis threw"
          : "no shot found in the rep window",
    });
  });
  coordinator.on("stateChanged", ({ to }) => {
    if (to === "ANALYZING") pending = new Promise((r) => setTimeout(r, 0));
  });
  coordinator.start();
  // A capture can end mid-rep (the phone kept streaming; the file stops):
  // hold the last pose still for 2 s so a rep in progress can settle.
  const last = frames.at(-1);
  const pad: LandmarkFrame[] = last
    ? Array.from({ length: Math.round(2 * fps) }, (_, i) => ({
        ...last,
        frameIndex: last.frameIndex + i + 1,
        timestamp: last.timestamp + ((i + 1) * 1000) / fps,
      }))
    : [];
  let armedFrames = 0;
  for (const f of [...frames, ...pad]) {
    const armed = armedFn ? armedFn(f.timestamp) : true;
    if (armed && f.frameIndex <= (last?.frameIndex ?? 0)) armedFrames++;
    frameArmed = armed;
    coordinator.setArmed(armed);
    coordinator.pushFrame(f);
    if (pending) {
      await pending;
      // Let the coordinator's analyze promise settle.
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
      pending = null;
    }
  }

  const posed = frames.filter((f) => f.landmarks).length;
  const recordedReps = file.events.filter(
    (e) => e.kind === "rep.started",
  ).length;
  const armedShare = armedFn ? armedFrames / Math.max(1, frames.length) : null;
  const findings: string[] = [];
  const span = frames.length ? frames.at(-1)!.timestamp - t0 : 0;
  if (frames.length === 0)
    findings.push("No pose frames were captured at all.");
  else {
    if (posed / frames.length < 0.5)
      findings.push(
        `A pose was found on only ${Math.round((100 * posed) / frames.length)}% of frames: tracking is losing the player (light, distance, framing).`,
      );
    const effFps = frames.length / Math.max(0.001, span / 1000);
    if (effFps < 12)
      findings.push(
        `Only ~${effFps.toFixed(0)} pose frames/s: the phone is too slow for the shot motion to be followed.`,
      );
    if (armedShare !== null && armedShare < 0.2)
      findings.push(
        `The player counted as positioned (side-on, whole body in frame) for only ${Math.round(armedShare * 100)}% of the capture — shots can't start while not positioned. See the "readiness" events for why (cue / detected orientation).`,
      );
    if (rise !== null && peak < rise && repCauses.length === 0)
      findings.push(
        `Wrist never rose fast enough to start a rep: peak ${peak.toFixed(2)} vs trigger ${rise.toFixed(2)} (normalized units/s); past the head ${peakTorso.toFixed(2)} torso/s${near ? `; ${near} near-miss(es)` : ""}.`,
      );
    if (repCauses.length)
      findings.push(`Rep starts here: ${repCauses.join(", ")}.`);
    const rej = reps.filter((r) => r.outcome === "rejected");
    if (rej.length)
      findings.push(
        `${rej.length} rep(s) were rejected for camera angle: ${rej[0]!.detail}.`,
      );
    const none = reps.filter((r) => r.outcome === "no-shot");
    if (none.length)
      findings.push(
        `${none.length} rep(s) started but no shot was found in the window.`,
      );
    if (reps.some((r) => r.outcome === "shot"))
      findings.push(
        `Replayed here, ${reps.filter((r) => r.outcome === "shot").length} shot(s) ARE recognized — if the phone found none, the difference is on the device (timing, arming, errors in the event log).`,
      );
    if (findings.length === 0)
      findings.push("Nothing obviously wrong — see the timeline.");
  }
  return {
    spanMs: span,
    frames: frames.length,
    posedShare: frames.length ? posed / frames.length : 0,
    fps,
    armedShare,
    peakVelocity: rise !== null ? peak : null,
    riseVelocity: rise,
    nearTriggers: near,
    recordedReps,
    reps,
    findings,
    timeline: file.events.map((e) => fmtEvent(e, t0)),
  };
}
