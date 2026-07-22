import type { AnalysisResult, PoseData } from "basketball-shot-analysis";

export interface AnalyzeOptions {
  shootingHand: "left" | "right";
  /** Library form-profile name (e.g. "pro-form"). */
  profile: string;
  /** Optional cancellation for long-running video analysis. */
  signal?: AbortSignal;
}

export interface AnalysisProgress {
  framesProcessed: number;
  totalFrames?: number;
  shotsDetected: number;
  phase: "loading" | "detecting" | "extracting";
}

export type ProgressCallback = (progress: AnalysisProgress) => void;

/** Reference to a recorded pose-sequence fixture (replay backend). */
export interface FixtureRef {
  kind: "fixture";
  fixtureId: string;
}

/** What analyzeVideoFile accepts: a real video Blob or a fixture ref. */
export type AnalysisInput = Blob | FixtureRef;

export function isFixtureRef(input: AnalysisInput): input is FixtureRef {
  return (
    typeof input === "object" &&
    input !== null &&
    "kind" in input &&
    (input as FixtureRef).kind === "fixture"
  );
}

/**
 * One camera/replay frame of pose landmarks, the currency of live mode.
 * `landmarks` is null when no pose was detected in the frame.
 */
export interface LandmarkFrame {
  frameIndex: number;
  /** Milliseconds since session start. */
  timestamp: number;
  poseConfidence: number;
  landmarks:
    | readonly {
        x: number;
        y: number;
        z: number;
        visibility: number;
        confidence: number;
      }[]
    | null;
}

/**
 * A live analysis session. The live-practice coordinator subscribes to the
 * cheap per-frame landmark stream and calls analyzeWindow over a bounded
 * buffer when it thinks a rep happened.
 */
export interface LiveAnalysisSession {
  /** Subscribe to per-frame landmarks. Returns an unsubscribe function. */
  onFrame(cb: (frame: LandmarkFrame) => void): () => void;
  /** Full shot detection + metrics over a bounded frame window. */
  analyzeWindow(frames: readonly LandmarkFrame[]): Promise<AnalysisResult>;
  /**
   * Push a camera frame for pose detection (worker-backed sessions only;
   * replay sessions self-drive and omit this).
   */
  pushFrame?(frame: {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    frameIndex: number;
    timestamp: number;
  }): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface AnalysisService {
  /** Analyze an uploaded/recorded video end-to-end (client-only path). */
  analyzeVideoFile(
    input: AnalysisInput,
    opts: AnalyzeOptions,
    onProgress?: ProgressCallback,
  ): Promise<AnalysisResult>;
  /**
   * Extract pose frames from a video (client-side pose detection only) so the
   * server can run the authoritative full analysis. This is the production
   * upload/assessment path: the browser detects poses, the server scores them.
   */
  extractPoses(
    input: AnalysisInput,
    opts: AnalyzeOptions,
    onProgress?: ProgressCallback,
  ): Promise<PoseData>;
  /** Create a live session (camera-backed in production, replay in tests). */
  createLiveSession(opts: AnalyzeOptions): LiveAnalysisSession;
}
