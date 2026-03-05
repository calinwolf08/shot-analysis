/**
 * Test fixtures for E2E tests.
 *
 * Since E2E tests require realistic shot detection scenarios but we cannot
 * include actual video files, this module provides:
 *
 * 1. Mock frame providers that simulate video input
 * 2. Expected outputs for validation (shot counts, timings, etc.)
 * 3. Mock pose detector that returns realistic landmark data for shot patterns
 *
 * The mock pose detector generates landmark sequences that simulate:
 * - Single shot videos (gather → load → rise → setPoint → release → followThrough)
 * - Multi-shot videos (multiple complete shot cycles)
 * - Edge cases (poor visibility, partial shots)
 *
 * @see Feature 7.4 - End-to-End Integration Tests
 */

import type { FrameProvider, VideoFrame } from "../../src/providers/types";
import type { PoseLandmarks as PosePoseLandmarks } from "../../src/pose/types";
import type { ShotPhase } from "../../src/types";

// ============================================================================
// Video Frame Fixtures
// ============================================================================

/**
 * Creates a mock video frame with specified dimensions.
 */
export function createMockFrame(
  frameIndex: number,
  fps: number = 30,
  width: number = 640,
  height: number = 480,
): VideoFrame {
  const timestamp = (frameIndex / fps) * 1000;
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    timestamp,
    frameIndex,
  };
}

/**
 * Creates a mock frame provider that generates a fixed number of frames.
 */
export function createMockFrameProvider(
  frameCount: number,
  fps: number = 30,
  width: number = 640,
  height: number = 480,
): FrameProvider {
  let currentIndex = 0;

  return {
    getNextFrame: async (): Promise<VideoFrame | null> => {
      if (currentIndex >= frameCount) {
        return null;
      }
      const frame = createMockFrame(currentIndex, fps, width, height);
      currentIndex++;
      return frame;
    },
    getFps: () => fps,
    getMetadata: () => ({
      width,
      height,
      duration: (frameCount / fps) * 1000,
    }),
  };
}

/**
 * Creates a mock frame provider for a live stream (no duration).
 */
export function createLiveStreamFrameProvider(
  frameCount: number,
  fps: number = 30,
  width: number = 640,
  height: number = 480,
): FrameProvider {
  let currentIndex = 0;

  return {
    getNextFrame: async (): Promise<VideoFrame | null> => {
      if (currentIndex >= frameCount) {
        return null;
      }
      const frame = createMockFrame(currentIndex, fps, width, height);
      currentIndex++;
      return frame;
    },
    getFps: () => fps,
    getMetadata: () => ({
      width,
      height,
      // No duration for live streams
    }),
  };
}

// ============================================================================
// Landmark Fixtures
// ============================================================================

/**
 * Configuration for a shot pattern in the landmark sequence.
 */
export interface ShotPatternConfig {
  /** Frame where the shot starts (gather phase) */
  startFrame: number;
  /** Total frames for the shot (typically 30-60 frames at 30fps) */
  duration: number;
  /** Base confidence for landmarks (varies by phase) */
  baseConfidence?: number;
}

/**
 * Expected shot output for validation.
 */
export interface ExpectedShot {
  shotIndex: number;
  frameRange: { start: number; end: number };
  expectedPhases: ShotPhase[];
}

/**
 * Test scenario configuration.
 */
export interface TestScenario {
  name: string;
  totalFrames: number;
  fps: number;
  shotPatterns: ShotPatternConfig[];
  expectedShots: ExpectedShot[];
}

// ============================================================================
// Pre-defined Test Scenarios
// ============================================================================

/**
 * Single clean shot with all phases clearly detected.
 * Simulates ideal conditions: good lighting, clear view, complete shot motion.
 */
export const SINGLE_SHOT_SCENARIO: TestScenario = {
  name: "single-clean-shot",
  totalFrames: 90, // 3 seconds at 30fps
  fps: 30,
  shotPatterns: [
    {
      startFrame: 15, // Start shot at 0.5s
      duration: 45, // Shot takes 1.5s
      baseConfidence: 0.95,
    },
  ],
  expectedShots: [
    {
      shotIndex: 0,
      frameRange: { start: 15, end: 59 },
      expectedPhases: [
        "gather",
        "load",
        "rise",
        "setPoint",
        "release",
        "followThrough",
      ],
    },
  ],
};

/**
 * Multiple shots in sequence.
 * Simulates practice session with consecutive shots.
 */
export const MULTI_SHOT_SCENARIO: TestScenario = {
  name: "multi-shot-practice",
  totalFrames: 270, // 9 seconds at 30fps
  fps: 30,
  shotPatterns: [
    {
      startFrame: 15,
      duration: 45,
      baseConfidence: 0.92,
    },
    {
      startFrame: 90, // Start 2nd shot at 3s
      duration: 45,
      baseConfidence: 0.88,
    },
    {
      startFrame: 180, // Start 3rd shot at 6s
      duration: 45,
      baseConfidence: 0.9,
    },
  ],
  expectedShots: [
    {
      shotIndex: 0,
      frameRange: { start: 15, end: 59 },
      expectedPhases: [
        "gather",
        "load",
        "rise",
        "setPoint",
        "release",
        "followThrough",
      ],
    },
    {
      shotIndex: 1,
      frameRange: { start: 90, end: 134 },
      expectedPhases: [
        "gather",
        "load",
        "rise",
        "setPoint",
        "release",
        "followThrough",
      ],
    },
    {
      shotIndex: 2,
      frameRange: { start: 180, end: 224 },
      expectedPhases: [
        "gather",
        "load",
        "rise",
        "setPoint",
        "release",
        "followThrough",
      ],
    },
  ],
};

/**
 * Poor lighting conditions with lower confidence landmarks.
 * Simulates challenging conditions where detection may fail for some frames.
 */
export const LOW_CONFIDENCE_SCENARIO: TestScenario = {
  name: "low-confidence-lighting",
  totalFrames: 90,
  fps: 30,
  shotPatterns: [
    {
      startFrame: 15,
      duration: 45,
      baseConfidence: 0.45, // Below typical threshold
    },
  ],
  expectedShots: [], // May not detect shot due to low confidence
};

/**
 * Live stream session with multiple shots.
 * Similar to multi-shot but tests live session workflow.
 */
export const LIVE_SESSION_SCENARIO: TestScenario = {
  name: "live-practice-session",
  totalFrames: 150, // 5 seconds at 30fps
  fps: 30,
  shotPatterns: [
    {
      startFrame: 10,
      duration: 40,
      baseConfidence: 0.9,
    },
    {
      startFrame: 80,
      duration: 40,
      baseConfidence: 0.88,
    },
  ],
  expectedShots: [
    {
      shotIndex: 0,
      frameRange: { start: 10, end: 49 },
      expectedPhases: [
        "gather",
        "load",
        "rise",
        "setPoint",
        "release",
        "followThrough",
      ],
    },
    {
      shotIndex: 1,
      frameRange: { start: 80, end: 119 },
      expectedPhases: [
        "gather",
        "load",
        "rise",
        "setPoint",
        "release",
        "followThrough",
      ],
    },
  ],
};

// ============================================================================
// Mock Landmark Generator
// ============================================================================

/**
 * Generates a single landmark with position and visibility.
 */
function createLandmark(
  x: number,
  y: number,
  z: number,
  visibility: number,
  confidence: number,
): { x: number; y: number; z: number; visibility: number; confidence: number } {
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    z,
    visibility: Math.max(0, Math.min(1, visibility)),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

/**
 * Phase timing as percentage of shot duration.
 */
const PHASE_TIMINGS = {
  gather: { start: 0.0, end: 0.15 },
  load: { start: 0.15, end: 0.35 },
  rise: { start: 0.35, end: 0.55 },
  setPoint: { start: 0.55, end: 0.7 },
  release: { start: 0.7, end: 0.85 },
  followThrough: { start: 0.85, end: 1.0 },
};

/**
 * Determines the current phase based on progress through the shot.
 */
function getPhaseAtProgress(progress: number): ShotPhase {
  for (const [phase, timing] of Object.entries(PHASE_TIMINGS)) {
    if (progress >= timing.start && progress < timing.end) {
      return phase as ShotPhase;
    }
  }
  return "followThrough";
}

/**
 * Generates realistic landmark positions for a given phase.
 * Returns 33 landmarks matching MediaPipe Pose Landmarker output.
 *
 * The positions simulate realistic basketball shooting motion:
 * - gather: Ball at waist, knees bent
 * - load: Ball rising, beginning extension
 * - rise: Arms extending upward
 * - setPoint: Ball at/above head, arm cocked
 * - release: Full arm extension, ball leaving hand
 * - followThrough: Arm extended, wrist snapped
 */
function generateLandmarksForPhase(
  phase: ShotPhase,
  progress: number,
  confidence: number,
): PosePoseLandmarks {
  // Base positions for standing pose (normalized 0-1)
  const baseLandmarks = [
    // Face landmarks (0-10)
    { x: 0.5, y: 0.15, z: 0 }, // NOSE
    { x: 0.48, y: 0.12, z: 0 }, // LEFT_EYE_INNER
    { x: 0.47, y: 0.12, z: 0 }, // LEFT_EYE
    { x: 0.46, y: 0.12, z: 0 }, // LEFT_EYE_OUTER
    { x: 0.52, y: 0.12, z: 0 }, // RIGHT_EYE_INNER
    { x: 0.53, y: 0.12, z: 0 }, // RIGHT_EYE
    { x: 0.54, y: 0.12, z: 0 }, // RIGHT_EYE_OUTER
    { x: 0.44, y: 0.14, z: 0 }, // LEFT_EAR
    { x: 0.56, y: 0.14, z: 0 }, // RIGHT_EAR
    { x: 0.48, y: 0.17, z: 0 }, // MOUTH_LEFT
    { x: 0.52, y: 0.17, z: 0 }, // MOUTH_RIGHT

    // Upper body landmarks (11-22)
    { x: 0.4, y: 0.25, z: 0 }, // LEFT_SHOULDER
    { x: 0.6, y: 0.25, z: 0 }, // RIGHT_SHOULDER
    { x: 0.38, y: 0.4, z: 0 }, // LEFT_ELBOW
    { x: 0.62, y: 0.4, z: 0 }, // RIGHT_ELBOW
    { x: 0.36, y: 0.55, z: 0 }, // LEFT_WRIST
    { x: 0.64, y: 0.55, z: 0 }, // RIGHT_WRIST
    { x: 0.35, y: 0.58, z: 0 }, // LEFT_PINKY
    { x: 0.65, y: 0.58, z: 0 }, // RIGHT_PINKY
    { x: 0.36, y: 0.58, z: 0 }, // LEFT_INDEX
    { x: 0.64, y: 0.58, z: 0 }, // RIGHT_INDEX
    { x: 0.37, y: 0.57, z: 0 }, // LEFT_THUMB
    { x: 0.63, y: 0.57, z: 0 }, // RIGHT_THUMB

    // Lower body landmarks (23-32)
    { x: 0.45, y: 0.55, z: 0 }, // LEFT_HIP
    { x: 0.55, y: 0.55, z: 0 }, // RIGHT_HIP
    { x: 0.44, y: 0.75, z: 0 }, // LEFT_KNEE
    { x: 0.56, y: 0.75, z: 0 }, // RIGHT_KNEE
    { x: 0.43, y: 0.95, z: 0 }, // LEFT_ANKLE
    { x: 0.57, y: 0.95, z: 0 }, // RIGHT_ANKLE
    { x: 0.42, y: 0.98, z: 0 }, // LEFT_HEEL
    { x: 0.58, y: 0.98, z: 0 }, // RIGHT_HEEL
    { x: 0.44, y: 0.98, z: 0 }, // LEFT_FOOT_INDEX
    { x: 0.56, y: 0.98, z: 0 }, // RIGHT_FOOT_INDEX
  ];

  // Modify positions based on shooting phase
  // Right-handed shooter - right arm is shooting arm
  const shootingArmOffset = getShootingArmOffset(phase, progress);

  // Apply phase-specific modifications
  const modifiedLandmarks = baseLandmarks.map((base, index) => {
    let x = base.x;
    let y = base.y;
    let z = base.z;

    // Modify shooting arm landmarks (right side: indices 12, 14, 16, 18, 20, 22)
    if (index === 12) {
      // RIGHT_SHOULDER - slight rotation during shot
      y -= shootingArmOffset.shoulderLift * 0.05;
    } else if (index === 14) {
      // RIGHT_ELBOW
      x += shootingArmOffset.elbowOut * 0.05;
      y = base.y - shootingArmOffset.elbowRaise * 0.3;
      z = shootingArmOffset.elbowForward * -0.1;
    } else if ([16, 18, 20, 22].includes(index)) {
      // RIGHT_WRIST and hand landmarks
      x += shootingArmOffset.wristOut * 0.1;
      y = base.y - shootingArmOffset.wristRaise * 0.4;
      z = shootingArmOffset.wristForward * -0.15;
    }

    // Modify knees during gather/load phases
    if ([25, 26].includes(index)) {
      const kneeBend = phase === "gather" || phase === "load" ? 0.05 : 0;
      y += kneeBend;
    }

    return createLandmark(
      x,
      y,
      z,
      confidence * 0.95 + Math.random() * 0.05,
      confidence * 0.95 + Math.random() * 0.05,
    );
  });

  return {
    landmarks: modifiedLandmarks,
    poseConfidence: confidence,
  };
}

/**
 * Gets shooting arm position offsets based on phase and progress.
 */
function getShootingArmOffset(
  phase: ShotPhase,
  _progress: number,
): {
  shoulderLift: number;
  elbowOut: number;
  elbowRaise: number;
  elbowForward: number;
  wristOut: number;
  wristRaise: number;
  wristForward: number;
} {
  switch (phase) {
    case "gather":
      return {
        shoulderLift: 0,
        elbowOut: 0.2,
        elbowRaise: 0.1,
        elbowForward: 0.1,
        wristOut: 0.1,
        wristRaise: 0.1,
        wristForward: 0.2,
      };
    case "load":
      return {
        shoulderLift: 0.2,
        elbowOut: 0.3,
        elbowRaise: 0.3,
        elbowForward: 0.2,
        wristOut: 0.2,
        wristRaise: 0.4,
        wristForward: 0.3,
      };
    case "rise":
      return {
        shoulderLift: 0.5,
        elbowOut: 0.4,
        elbowRaise: 0.6,
        elbowForward: 0.3,
        wristOut: 0.3,
        wristRaise: 0.7,
        wristForward: 0.4,
      };
    case "setPoint":
      return {
        shoulderLift: 0.7,
        elbowOut: 0.3,
        elbowRaise: 0.85,
        elbowForward: 0.2,
        wristOut: 0.2,
        wristRaise: 0.95,
        wristForward: 0.3,
      };
    case "release":
      return {
        shoulderLift: 0.8,
        elbowOut: 0.2,
        elbowRaise: 0.95,
        elbowForward: 0.4,
        wristOut: 0.3,
        wristRaise: 1.0,
        wristForward: 0.6,
      };
    case "followThrough":
      return {
        shoulderLift: 0.7,
        elbowOut: 0.1,
        elbowRaise: 0.9,
        elbowForward: 0.5,
        wristOut: 0.4,
        wristRaise: 0.95,
        wristForward: 0.7,
      };
    default:
      return {
        shoulderLift: 0,
        elbowOut: 0,
        elbowRaise: 0,
        elbowForward: 0,
        wristOut: 0,
        wristRaise: 0,
        wristForward: 0,
      };
  }
}

/**
 * Generates neutral standing pose landmarks (no shooting motion).
 */
function generateNeutralLandmarks(
  confidence: number,
): PosePoseLandmarks | null {
  if (confidence < 0.3) {
    // Simulate detection failure with very low confidence
    return null;
  }

  return generateLandmarksForPhase("gather", 0, confidence);
}

// ============================================================================
// Mock Pose Detector Factory
// ============================================================================

/**
 * Creates a mock pose detector that returns landmarks based on shot patterns.
 *
 * This allows E2E tests to run without actual MediaPipe detection,
 * while still exercising the full analysis pipeline.
 */
export function createMockPoseDetector(scenario: TestScenario) {
  return {
    detect: async (frame: VideoFrame): Promise<PosePoseLandmarks | null> => {
      // Find which shot pattern (if any) this frame belongs to
      for (const pattern of scenario.shotPatterns) {
        const shotStart = pattern.startFrame;
        const shotEnd = shotStart + pattern.duration;

        if (frame.frameIndex >= shotStart && frame.frameIndex < shotEnd) {
          // Calculate progress through the shot (0-1)
          const progress =
            (frame.frameIndex - shotStart) / (shotEnd - shotStart);
          const phase = getPhaseAtProgress(progress);
          return generateLandmarksForPhase(
            phase,
            progress,
            pattern.baseConfidence ?? 0.9,
          );
        }
      }

      // Frame is not during a shot - return neutral pose or null
      const baseConfidence = scenario.shotPatterns[0]?.baseConfidence ?? 0.8;
      return generateNeutralLandmarks(baseConfidence);
    },
    close: async (): Promise<void> => {
      // No-op for mock
    },
  };
}

// ============================================================================
// Expected Output Generators
// ============================================================================

/**
 * Creates expected metric names for a shot analysis.
 * These are the metrics that should be present in results.
 */
export const EXPECTED_METRIC_NAMES = [
  // Shooting arm metrics
  "shootingElbowAngle",
  "shootingElbowFlare",
  "maxArmExtension",
  "followThroughHold",
  // Ball metrics
  "setPointHeight",
  "ballDip",
  "releaseAngle",
  // Guide arm metrics
  "guideHandPosition",
  "guideHandRelease",
  // Lower body metrics
  "kneeFlexion",
  "hipDrop",
  "legExtension",
  // Posture metrics
  "backPosture",
  "shoulderAlignment",
  "headTilt",
  // Timing metrics
  "ballRiseTiming",
  "legRiseTiming",
  "synchronization",
  "shotDuration",
] as const;

/**
 * Creates a custom profile for testing profile comparison.
 */
export function createTestProfile(name: string) {
  return {
    name,
    description: `Test profile: ${name}`,
    targets: {
      shootingElbowAngle: {
        ideal: 90,
        acceptable: { min: 75, max: 105 },
        priority: "high" as const,
        feedback: {
          tooLow: "Bend elbow more",
          tooHigh: "Straighten elbow",
        },
      },
      setPointHeight: {
        ideal: 0.2,
        acceptable: { min: 0.0, max: 0.4 },
        priority: "high" as const,
        feedback: {
          tooLow: "Raise set point",
          tooHigh: "Lower set point",
        },
      },
      kneeFlexion: {
        ideal: 45,
        acceptable: { min: 30, max: 60 },
        priority: "medium" as const,
        feedback: {
          tooLow: "Bend knees more",
          tooHigh: "Less knee bend",
        },
      },
      guideHandPosition: {
        ideal: "side",
        acceptable: ["side", "under"],
        priority: "medium" as const,
        feedback: {
          incorrect: "Keep guide hand on side",
        },
      },
    },
  };
}
