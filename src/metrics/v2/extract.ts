/**
 * Single extraction entry point (Step 4).
 *
 * `extractShotMetrics` is the one function both consumers call — the NBA
 * reference pipeline and the app. It detects shot boundaries and keyframes
 * (reusing the same detectors the rest of the app uses), then builds the
 * sequencing and structure measurements for each shot.
 *
 * @see docs/implementation-plan-metrics-overhaul.md (Step 4)
 */

import { createShotDetector } from "../../detection/integrated-shot-detector";
import {
  detectKeyframesFromFrames,
  poseLandmarksToFrames,
} from "../../detection/keyframe-phases";
import { detectOrientation } from "../../detection/pose-shot-detector";
import type { Landmark, PoseLandmarks } from "../../pose/types";
import type { Frame, KeyframeId, PoseData } from "../../testing/types";
import { computeSequencing } from "./sequencing";
import { computeStructure } from "./structure";
import type { ShootingHand } from "./structure/geometry";
import { isSideView } from "./normalize";
import { METRICS_SCHEMA_VERSION, type ShotMetricsV2 } from "./types";

export interface ExtractOptions {
  /** Shooting hand for arm-specific metrics. Default: "right". */
  readonly shootingHand?: ShootingHand;
  /**
   * Camera orientation override. When omitted it's auto-detected from the pose
   * data (posture metrics need a side view, so this matters).
   */
  readonly cameraOrientation?: string;
}

const EMPTY_LANDMARKS: Landmark[] = Array.from({ length: 33 }, () => ({
  x: 0,
  y: 0,
  z: 0,
  visibility: 0,
  confidence: 0,
}));

/** PoseData frames → the runtime PoseLandmarks sequence used by detectors. */
function toSequence(frames: readonly Frame[]): PoseLandmarks[] {
  return frames.map((f) => ({
    landmarks:
      f.landmarks && f.landmarks.length
        ? f.landmarks.map((l) => ({
            x: l.x,
            y: l.y,
            z: l.z,
            visibility: l.visibility,
            confidence: (l as { confidence?: number }).confidence ?? l.visibility,
          }))
        : EMPTY_LANDMARKS,
    poseConfidence: f.poseConfidence ?? 0,
  }));
}

/**
 * PoseData → the keyframe Frame[] (frameIndex aligned to shot boundaries) that
 * both keyframe detection and structure metrics consume. Exposed so callers
 * with their OWN shot boundaries (e.g. labeled reference clips) can detect
 * keyframes and call {@link metricsForShot} directly.
 */
export function keyframeFramesFromPoseData(poseData: PoseData): Frame[] {
  return poseLandmarksToFrames(toSequence(poseData.frames as readonly Frame[]));
}

/** Mean pose confidence across a shot's frame span. */
function meanConfidence(frames: readonly Frame[], start: number, end: number): number {
  let sum = 0;
  let n = 0;
  for (let i = start; i <= end && i < frames.length; i++) {
    const c = frames[i]?.poseConfidence;
    if (typeof c === "number") {
      sum += c;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

/**
 * Builds v2 metrics for a shot whose boundaries and keyframes are already known.
 * Used by {@link extractShotMetrics} and directly by callers that already ran
 * detection (e.g. the validator, which shows detected keyframes).
 */
export function metricsForShot(
  frames: readonly Frame[],
  keyframes: ReadonlyMap<KeyframeId, number | null>,
  shot: { startFrame: number; endFrame: number },
  opts: {
    fps: number;
    cameraOrientation: string;
    shootingHand: ShootingHand;
    poseConfidence: number;
  },
): ShotMetricsV2 {
  const { startFrame, endFrame } = shot;
  return {
    schemaVersion: METRICS_SCHEMA_VERSION,
    shot: {
      startFrame,
      endFrame,
      fps: opts.fps,
      cameraOrientation: opts.cameraOrientation,
    },
    reliability: {
      poseConfidence: opts.poseConfidence,
      sideView: isSideView(opts.cameraOrientation),
    },
    sequencing: computeSequencing(keyframes, startFrame, endFrame),
    structure: computeStructure(frames, keyframes, {
      startFrame,
      endFrame,
      cameraOrientation: opts.cameraOrientation,
      shootingHand: opts.shootingHand,
    }),
  };
}

/**
 * Detects every shot in a clip and returns its v2 metrics — the single entry
 * point for the NBA pipeline and the app.
 *
 * @param poseData - poses.json contents (frames + fps + metadata)
 * @param opts - shooting hand and optional orientation override
 */
export function extractShotMetrics(
  poseData: PoseData,
  opts: ExtractOptions = {},
): ShotMetricsV2[] {
  const frames = poseData.frames as readonly Frame[];
  const sequence = toSequence(frames);
  const shots = createShotDetector().processFrames(sequence);
  const kfFrames = poseLandmarksToFrames(sequence);

  const shootingHand: ShootingHand = opts.shootingHand ?? "right";
  const detected = detectOrientation(poseData);
  const cameraOrientation =
    opts.cameraOrientation ?? (detected === "unknown" ? "front" : detected);
  const fps = poseData.fps ?? 30;

  return shots.map((shot) => {
    const start = shot.frameRange.start;
    const end = shot.frameRange.end;
    const keyframes = detectKeyframesFromFrames(kfFrames, start, end);
    return metricsForShot(
      kfFrames,
      keyframes,
      { startFrame: start, endFrame: end },
      {
        fps,
        cameraOrientation,
        shootingHand,
        poseConfidence: meanConfidence(frames, start, end),
      },
    );
  });
}
