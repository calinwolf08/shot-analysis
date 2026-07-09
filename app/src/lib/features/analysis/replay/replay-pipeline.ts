/**
 * The deterministic core shared by ReplayAnalysisService (video + live
 * window): drives the library's public ShotDetector + MetricOrchestrator
 * over recorded pose frames, mirroring ShotAnalyzer.analyzeVideo semantics.
 */
import {
  MetricOrchestrator,
  ShotDetector,
  createBallMetricCalculators,
  createConfig,
  createGuideArmCalculators,
  createLowerBodyCalculators,
  createPostureCalculators,
  createShootingArmCalculators,
  createTimingCalculators,
  detectOrientation,
  type AnalysisConfig,
  type AnalysisResult,
  type DetectionPoseLandmarks,
  type PoseData,
  type PoseDataFrame,
  type PoseLandmarks as MetricsPoseLandmarks,
  type ShotAnalysis,
} from "basketball-shot-analysis";
import type { AnalyzeOptions, LandmarkFrame, ProgressCallback } from "../types";

export function createOrchestrator(): MetricOrchestrator {
  return new MetricOrchestrator([
    ...createShootingArmCalculators(),
    ...createGuideArmCalculators(),
    ...createBallMetricCalculators(),
    ...createLowerBodyCalculators(),
    ...createPostureCalculators(),
    ...createTimingCalculators(),
  ]);
}

export function toAnalysisConfig(opts: AnalyzeOptions): AnalysisConfig {
  return createConfig({
    shootingHand: opts.shootingHand,
    profile: opts.profile,
  });
}

export function poseDataToLandmarkFrames(pose: PoseData): LandmarkFrame[] {
  const msPerFrame = 1000 / pose.fps;
  return pose.frames.map((f) => ({
    frameIndex: f.frameIndex,
    timestamp: f.frameIndex * msPerFrame,
    poseConfidence: f.poseConfidence,
    // Recorded fixtures carry no per-landmark confidence after schema
    // parsing; the library's own loaders use visibility as the proxy.
    landmarks:
      f.landmarks?.map((l) => ({
        x: l.x,
        y: l.y,
        z: l.z,
        visibility: l.visibility,
        confidence: l.visibility,
      })) ?? null,
  }));
}

interface PreparedFrames {
  detection: DetectionPoseLandmarks[];
  metrics: MetricsPoseLandmarks[];
  /** Original pose frames aligned with the arrays above (pose-only). */
  source: PoseDataFrame[];
}

/**
 * Filters no-pose frames and produces both landmark formats (aligned).
 *
 * Frame indexes/timestamps are REBASED onto the filtered sequence: the
 * detector's frameRange values index into the filtered array, so metric
 * calculators must see matching frameIndex values or timing metrics lose
 * their landmarks (original camera indexes drift wherever a frame had no
 * detected pose). All frame refs in results are filtered-sequence indexes.
 */
function prepare(
  frames: readonly LandmarkFrame[],
  fps: number,
): PreparedFrames {
  const detection: DetectionPoseLandmarks[] = [];
  const metrics: MetricsPoseLandmarks[] = [];
  const source: PoseDataFrame[] = [];
  const msPerFrame = 1000 / fps;
  for (const f of frames) {
    if (!f.landmarks || f.landmarks.length === 0) continue;
    const index = detection.length; // rebased position in filtered sequence
    detection.push({
      landmarks: f.landmarks,
      poseConfidence: f.poseConfidence,
    });
    metrics.push({
      landmarks: f.landmarks.map((l) => ({
        position: { x: l.x, y: l.y, z: l.z },
        visibility: l.visibility,
        presence: l.confidence,
      })),
      confidence: f.poseConfidence,
      timestamp: index * msPerFrame,
      frameIndex: index,
    });
    source.push({
      frameIndex: index,
      timestamp: index * msPerFrame,
      poseConfidence: f.poseConfidence,
      landmarks: f.landmarks,
    });
  }
  return { detection, metrics, source };
}

export interface ReplayRunOptions {
  fps: number;
  width?: number;
  height?: number;
  onProgress?: ProgressCallback;
  /** Emit a loading progress event every N frames (default 50). */
  progressEvery?: number;
}

/**
 * Runs the full pipeline over pose frames. Mirrors the library analyzer:
 * frames without a detected pose are dropped; shot frame ranges index into
 * the filtered sequence (library behavior preserved).
 */
export function runReplayAnalysis(
  frames: readonly LandmarkFrame[],
  opts: AnalyzeOptions,
  run: ReplayRunOptions,
): AnalysisResult {
  const config = toAnalysisConfig(opts);
  const progressEvery = run.progressEvery ?? 50;
  const emit = run.onProgress ?? (() => undefined);

  // Phase: loading (conversion), monotonic framesProcessed.
  const total = frames.length;
  emit({
    framesProcessed: 0,
    totalFrames: total,
    shotsDetected: 0,
    phase: "loading",
  });
  const prepared = prepare(frames, run.fps);
  for (let i = progressEvery; i < total; i += progressEvery) {
    emit({
      framesProcessed: i,
      totalFrames: total,
      shotsDetected: 0,
      phase: "loading",
    });
  }

  // Phase: detecting.
  emit({
    framesProcessed: total,
    totalFrames: total,
    shotsDetected: 0,
    phase: "detecting",
  });
  const detector = new ShotDetector();
  const shots = detector.processFrames(prepared.detection);

  // Phase: extracting (per shot).
  const orchestrator = createOrchestrator();
  const analyses: ShotAnalysis[] = [];
  for (const shot of shots) {
    const shotLandmarks = prepared.metrics.slice(
      shot.frameRange.start,
      shot.frameRange.end + 1,
    );
    const analysis = orchestrator.analyzeShot(
      shot.shotIndex,
      shotLandmarks,
      shot.frameRange,
      shot.phases,
      config,
    );

    const orientation = shotOrientation(
      prepared.source,
      shot.frameRange.start,
      shot.frameRange.end,
      run,
    );
    analyses.push({ ...analysis, orientation });
    emit({
      framesProcessed: total,
      totalFrames: total,
      shotsDetected: analyses.length,
      phase: "extracting",
    });
  }

  return {
    shots: analyses,
    videoMetadata: {
      fps: run.fps,
      totalFrames: total,
      duration: total / run.fps,
      width: run.width ?? 0,
      height: run.height ?? 0,
    },
    config,
  };
}

function shotOrientation(
  source: readonly PoseDataFrame[],
  start: number,
  end: number,
  run: ReplayRunOptions,
): ShotAnalysis["orientation"] {
  const slice = source.slice(start, end + 1);
  if (slice.length < 3) return "unknown";
  const poseData: PoseData = {
    video: "replay",
    fps: run.fps,
    totalFrames: slice.length,
    width: run.width ?? 0,
    height: run.height ?? 0,
    extractedAt: "1970-01-01T00:00:00.000Z",
    frames: slice,
  };
  return detectOrientation(poseData);
}
