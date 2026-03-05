import { createPhaseDetector } from "./src/detection/phase-detector";
import { ShotPhase } from "./src/detection/types";
import type { PoseLandmarks, Landmark } from "./src/pose/types";
import { LANDMARK_INDEX } from "./src/pose/types";

function createLandmark(
  x: number,
  y: number,
  z: number = 0,
  visibility: number = 0.95,
  confidence: number = 0.95,
): Landmark {
  return { x, y, z, visibility, confidence };
}

function createDefaultLandmarks(): Landmark[] {
  const landmarks: Landmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push(createLandmark(0.5, 0.5, 0));
  }
  landmarks[LANDMARK_INDEX.NOSE] = createLandmark(0.5, 0.15);
  landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.4, 0.25);
  landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.6, 0.25);
  landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, 0.5);
  landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, 0.5);
  landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.45, 0.7);
  landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.55, 0.7);
  landmarks[LANDMARK_INDEX.LEFT_ANKLE] = createLandmark(0.45, 0.9);
  landmarks[LANDMARK_INDEX.RIGHT_ANKLE] = createLandmark(0.55, 0.9);
  return landmarks;
}

function createPoseLandmarks(
  landmarks: Landmark[],
  poseConfidence: number = 0.95,
): PoseLandmarks {
  return { landmarks, poseConfidence };
}

interface FrameConfig {
  wristY: [number, number];
  hipY?: number;
  kneeAngle?: number;
  indexFingerY?: [number, number];
  indexFingerX?: [number, number];
}

function createFrameSequence(configs: FrameConfig[]): PoseLandmarks[] {
  return configs.map((config) => {
    const landmarks = createDefaultLandmarks();
    landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(
      0.4,
      config.wristY[0],
    );
    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(
      0.6,
      config.wristY[1],
    );
    if (config.hipY !== undefined) {
      landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, config.hipY);
      landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, config.hipY);
    }
    if (config.indexFingerY !== undefined) {
      const leftX = config.indexFingerX?.[0] ?? 0.4;
      const rightX = config.indexFingerX?.[1] ?? 0.6;
      landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(
        leftX,
        config.indexFingerY[0],
      );
      landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(
        rightX,
        config.indexFingerY[1],
      );
    } else {
      landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(
        0.4,
        config.wristY[0] + 0.03,
      );
      landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(
        0.6,
        config.wristY[1] + 0.03,
      );
    }
    return createPoseLandmarks(landmarks);
  });
}

function createCompleteShotSequence(): PoseLandmarks[] {
  const configs: FrameConfig[] = [
    // Frames 0-4: Neutral
    { wristY: [0.55, 0.55], hipY: 0.5 },
    { wristY: [0.55, 0.55], hipY: 0.5 },
    { wristY: [0.55, 0.55], hipY: 0.5 },
    { wristY: [0.55, 0.55], hipY: 0.5 },
    { wristY: [0.55, 0.55], hipY: 0.5 },
    // Frames 5-9: Gather
    { wristY: [0.52, 0.5], hipY: 0.5 },
    { wristY: [0.48, 0.45], hipY: 0.5 },
    { wristY: [0.44, 0.4], hipY: 0.5 },
    { wristY: [0.42, 0.38], hipY: 0.5 },
    { wristY: [0.4, 0.36], hipY: 0.51 },
    // Frames 10-14: Load
    { wristY: [0.42, 0.38], hipY: 0.52 },
    { wristY: [0.44, 0.4], hipY: 0.53 },
    { wristY: [0.45, 0.41], hipY: 0.54 },
    { wristY: [0.44, 0.4], hipY: 0.54 },
    { wristY: [0.42, 0.38], hipY: 0.54 },
    // Frames 15-24: Rise
    { wristY: [0.38, 0.34], hipY: 0.52 },
    { wristY: [0.34, 0.3], hipY: 0.5 },
    { wristY: [0.3, 0.26], hipY: 0.48 },
    { wristY: [0.26, 0.22], hipY: 0.47 },
    { wristY: [0.22, 0.18], hipY: 0.46 },
    { wristY: [0.2, 0.16], hipY: 0.45 },
    { wristY: [0.18, 0.14], hipY: 0.44 },
    { wristY: [0.16, 0.12], hipY: 0.44 },
    { wristY: [0.14, 0.1], hipY: 0.44 },
    { wristY: [0.13, 0.09], hipY: 0.44 },
    // Frames 25-29: Set Point
    { wristY: [0.12, 0.08], hipY: 0.44 },
    { wristY: [0.11, 0.07], hipY: 0.44 },
    { wristY: [0.1, 0.06], hipY: 0.44 },
    { wristY: [0.1, 0.06], hipY: 0.44 },
    { wristY: [0.1, 0.06], hipY: 0.44 },
    // Frames 30-34: Release
    {
      wristY: [0.12, 0.04],
      hipY: 0.44,
      indexFingerX: [0.48, 0.52],
      indexFingerY: [0.15, 0.07],
    },
    {
      wristY: [0.18, 0.03],
      hipY: 0.44,
      indexFingerX: [0.45, 0.55],
      indexFingerY: [0.21, 0.06],
    },
    {
      wristY: [0.24, 0.04],
      hipY: 0.44,
      indexFingerX: [0.42, 0.58],
      indexFingerY: [0.27, 0.07],
    },
    {
      wristY: [0.28, 0.06],
      hipY: 0.44,
      indexFingerX: [0.4, 0.6],
      indexFingerY: [0.31, 0.09],
    },
    {
      wristY: [0.32, 0.08],
      hipY: 0.44,
      indexFingerX: [0.38, 0.62],
      indexFingerY: [0.35, 0.11],
    },
    // Frames 35-39: Follow Through
    {
      wristY: [0.35, 0.1],
      hipY: 0.45,
      indexFingerX: [0.36, 0.64],
      indexFingerY: [0.38, 0.13],
    },
    {
      wristY: [0.36, 0.12],
      hipY: 0.46,
      indexFingerX: [0.35, 0.65],
      indexFingerY: [0.39, 0.15],
    },
    {
      wristY: [0.37, 0.14],
      hipY: 0.47,
      indexFingerX: [0.35, 0.65],
      indexFingerY: [0.4, 0.17],
    },
    {
      wristY: [0.38, 0.16],
      hipY: 0.48,
      indexFingerX: [0.35, 0.65],
      indexFingerY: [0.41, 0.19],
    },
    {
      wristY: [0.4, 0.18],
      hipY: 0.48,
      indexFingerX: [0.35, 0.65],
      indexFingerY: [0.43, 0.21],
    },
    // Frames 40-44: Return
    { wristY: [0.45, 0.3], hipY: 0.49 },
    { wristY: [0.5, 0.4], hipY: 0.5 },
    { wristY: [0.53, 0.48], hipY: 0.5 },
    { wristY: [0.55, 0.53], hipY: 0.5 },
    { wristY: [0.55, 0.55], hipY: 0.5 },
  ];
  return createFrameSequence(configs);
}

const sequence = createCompleteShotSequence();
const detector = createPhaseDetector();
const result = detector.detectPhases(sequence, 0, sequence.length - 1);

console.log("=== Complete Shot Sequence ===");
console.log("Total frames:", sequence.length);
console.log("Detected phases:", JSON.stringify(result.phases, null, 2));
console.log("Confidence:", result.confidence);
console.log("Phases detected:", Object.keys(result.phases));

// Test case that's failing: Shot cut off during follow-through (with more frames)
console.log("\n=== Cut-off Shot Sequence ===");
const cutoffConfigs: FrameConfig[] = [
  { wristY: [0.55, 0.55], hipY: 0.5 },
  { wristY: [0.45, 0.4], hipY: 0.51 },
  { wristY: [0.35, 0.3], hipY: 0.52 },
  { wristY: [0.25, 0.2], hipY: 0.5 },
  { wristY: [0.15, 0.1], hipY: 0.48 },
  { wristY: [0.1, 0.06], hipY: 0.46 },
  // Release
  { wristY: [0.14, 0.04], hipY: 0.46 },
  { wristY: [0.22, 0.06], hipY: 0.47 },
  { wristY: [0.28, 0.1], hipY: 0.48 },
  // Follow-through
  { wristY: [0.32, 0.14], hipY: 0.48 },
  { wristY: [0.34, 0.16], hipY: 0.49 },
  // Video ends here during follow-through
  { wristY: [0.35, 0.18], hipY: 0.49 },
];
const cutoffSequence = createFrameSequence(cutoffConfigs);
const cutoffResult = detector.detectPhases(
  cutoffSequence,
  0,
  cutoffSequence.length - 1,
);
console.log("Total frames:", cutoffSequence.length);
console.log("Detected phases:", JSON.stringify(cutoffResult.phases, null, 2));
console.log("Confidence:", cutoffResult.confidence);
console.log("Phases detected:", Object.keys(cutoffResult.phases));
console.log(
  "Has follow-through:",
  cutoffResult.phases[ShotPhase.FollowThrough] !== undefined,
);
