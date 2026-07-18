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
  detectKeyframesFromFrames,
  detectOrientation,
  metricsForShot,
  type AnalysisConfig,
  type AnalysisResult,
  type DetectionPoseLandmarks,
  type PoseData,
  type PoseDataFrame,
  type PoseLandmarks as MetricsPoseLandmarks,
  type ShotAnalysis,
  type ShotMetricsV2,
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
    const keyFramePoses = extractKeyFramePoses(prepared.source, analysis);
    const v2Metrics = computeV2Metrics(
      prepared.source,
      shot.frameRange,
      orientation ?? "front",
      config.shootingHand ?? "right",
      run.fps,
    );
    analyses.push({
      ...analysis,
      orientation,
      keyFramePoses,
      ...(v2Metrics ? { v2Metrics } : {}),
    } as ShotAnalysis);
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

/** Landmarks captured at each detected phase start (skeleton overlays). */
export interface KeyFramePose {
  frameIndex: number;
  landmarks: { x: number; y: number; visibility: number }[];
}

export type KeyFramePoses = Partial<
  Record<
    "gather" | "load" | "rise" | "setPoint" | "release" | "followThrough",
    KeyFramePose
  >
>;

/** ShotAnalysis as persisted by this app: library type + overlay poses. */
export type StoredShotAnalysis = ShotAnalysis & {
  keyFramePoses?: KeyFramePoses;
  /** v2 Sequencing/Structure measurements — scored at results time against
   * the reference thresholds. Persisted (not the score) so re-thresholding
   * doesn't require re-analysis. */
  v2Metrics?: ShotMetricsV2;
};

/**
 * Computes the v2 Sequencing/Structure metrics for a shot from the full frames.
 * Defensive: any failure returns undefined so the core analysis is never broken
 * by the (newer) v2 path.
 */
function computeV2Metrics(
  source: readonly PoseDataFrame[],
  frameRange: { start: number; end: number },
  orientation: string,
  shootingHand: "left" | "right",
  fps: number,
): ShotMetricsV2 | undefined {
  try {
    const frames = source as Parameters<typeof metricsForShot>[0];
    const keyframes = detectKeyframesFromFrames(
      frames,
      frameRange.start,
      frameRange.end,
    );
    let sum = 0;
    let n = 0;
    for (
      let i = frameRange.start;
      i <= frameRange.end && i < source.length;
      i++
    ) {
      const c = source[i]?.poseConfidence;
      if (typeof c === "number") {
        sum += c;
        n++;
      }
    }
    return metricsForShot(
      frames,
      keyframes,
      { startFrame: frameRange.start, endFrame: frameRange.end },
      {
        fps,
        cameraOrientation: orientation,
        shootingHand,
        poseConfidence: n > 0 ? sum / n : 0,
      },
    );
  } catch (err) {
    console.warn("[v2] metrics computation failed for shot", err);
    return undefined;
  }
}

function extractKeyFramePoses(
  source: readonly PoseDataFrame[],
  analysis: ShotAnalysis,
): KeyFramePoses {
  const poses: KeyFramePoses = {};
  for (const [phase, range] of Object.entries(analysis.phases) as [
    keyof KeyFramePoses,
    { startFrame: number } | undefined,
  ][]) {
    if (!range) continue;
    const frame = source[range.startFrame];
    if (!frame?.landmarks) continue;
    poses[phase] = {
      frameIndex: range.startFrame,
      // 2D + visibility is all the overlay needs; keeps rows small.
      landmarks: frame.landmarks.map((l) => ({
        x: l.x,
        y: l.y,
        visibility: l.visibility,
      })),
    };
  }
  return poses;
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
