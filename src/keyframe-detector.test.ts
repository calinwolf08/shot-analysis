/**
 * Unit tests for KeyframeDetector - Load, Rise, Set Point, and Release phase detection.
 *
 * Tests detection functions for identifying keyframes in basketball shots.
 */

import { describe, it, expect } from "vitest";
import {
  KeyframeDetector,
  createKeyframeDetector,
  calculateKneeAngle,
  calculateElbowAngle,
  calculateWristAngle,
  detectLegBendLowPoint,
  detectBallLowPoint,
  detectLegsStartExtending,
  detectBallStartsUpward,
  detectSetPoint,
  detectRelease,
  calculateVelocity,
  calculateSmoothedVelocity,
  type KeyframeDetectorConfig,
} from "./keyframe-detector";
import type { Frame, TestLandmark } from "./testing/types";
import { LANDMARK_INDICES } from "./types";

/**
 * Default config for Load phase detection tests.
 */
const LOAD_PHASE_CONFIG: Required<KeyframeDetectorConfig> = {
  visibilityThreshold: 0.5,
  ballLowPointSearchWindow: 0.4,
  legBendSearchWindow: 0.5,
  riseSearchWindow: 0.6,
  smoothingWindowSize: 3,
  minConsecutiveFrames: 2,
  kneeVelocityThreshold: 0.5,
  wristVelocityThreshold: -0.005,
  setPointSearchWindow: 0.7,
  setPointMaxElbowAngle: 160,
  releaseSearchWindow: 0.5,
};

/**
 * Helper to create a single landmark with default values.
 */
function createLandmark(
  x: number,
  y: number,
  z: number = 0,
  visibility: number = 0.95,
): TestLandmark {
  return { x, y, z, visibility };
}

/**
 * Helper to create a full set of 33 landmarks with default positions.
 * Default pose is standing with arms at sides.
 */
function createDefaultLandmarks(): TestLandmark[] {
  const landmarks: TestLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push(createLandmark(0.5, 0.5, 0));
  }
  return landmarks;
}

/**
 * Creates a Frame with given frame index and landmarks.
 */
function createFrame(
  frameIndex: number,
  landmarks: TestLandmark[] | null,
  poseConfidence: number = 0.95,
): Frame {
  return {
    frameIndex,
    timestamp: frameIndex / 30, // Assume 30fps
    poseConfidence,
    landmarks,
  };
}

/**
 * Creates a frame sequence simulating a basketball shot Load phase.
 * The sequence shows leg bending (knee angle decreasing then increasing)
 * and ball dipping (wrist Y increasing then decreasing).
 *
 * To create a specific knee angle, we position hip-knee-ankle such that:
 * - Hip is at (0.5, 0.4)
 * - Knee is at (0.5, 0.55)
 * - Ankle X varies to create the angle (bent knee = ankle moves forward)
 *
 * @param startFrame - Starting frame index
 * @param frameCount - Number of frames
 * @param bendFrame - Frame index where maximum bend occurs (relative to start)
 * @param dipFrame - Frame index where ball is lowest (relative to start)
 */
function createLoadPhaseSequence(
  startFrame: number,
  frameCount: number,
  bendFrame: number,
  dipFrame: number,
): Frame[] {
  const frames: Frame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const frameIdx = startFrame + i;
    const landmarks = createDefaultLandmarks();

    // Calculate normalized distance from bend frame (0 at bend, 1 at edges)
    const distFromBend = Math.abs(i - bendFrame);
    const normalizedDist = Math.min(
      1,
      distFromBend / Math.max(bendFrame, frameCount - bendFrame - 1),
    );

    // Ankle X offset: 0 when straight (normalizedDist=1), max when bent (normalizedDist=0)
    // Larger offset = more bent knee (smaller angle)
    const maxAnkleXOffset = 0.15; // Maximum forward position of ankle
    const ankleXOffset = maxAnkleXOffset * (1 - normalizedDist);

    // Fixed positions for hip and knee (vertical alignment)
    const hipX = 0.5;
    const hipY = 0.4;
    const kneeX = 0.5;
    const kneeY = 0.55;
    const ankleX = 0.5 + ankleXOffset; // Moves forward when bent
    const ankleY = 0.7;

    landmarks[LANDMARK_INDICES.LEFT_HIP] = createLandmark(hipX - 0.1, hipY, 0);
    landmarks[LANDMARK_INDICES.RIGHT_HIP] = createLandmark(hipX + 0.1, hipY, 0);
    landmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(
      kneeX - 0.1,
      kneeY,
      0,
    );
    landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(
      kneeX + 0.1,
      kneeY,
      0,
    );
    landmarks[LANDMARK_INDICES.LEFT_ANKLE] = createLandmark(
      ankleX - 0.1,
      ankleY,
      0,
    );
    landmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createLandmark(
      ankleX + 0.1,
      ankleY,
      0,
    );

    // Calculate wrist Y: highest Y (lowest ball) at dipFrame
    // Use a parabola centered at dipFrame
    const distFromDip = Math.abs(i - dipFrame);
    const normalizedDipDist = Math.min(
      1,
      distFromDip / Math.max(dipFrame, frameCount - dipFrame - 1),
    );
    const maxDipY = 0.7; // Lowest ball position (highest Y)
    const minY = 0.4; // High ball position (lowest Y)
    const wristY = maxDipY - (maxDipY - minY) * normalizedDipDist;

    landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, wristY, 0);
    landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(0.6, wristY, 0);

    frames.push(createFrame(frameIdx, landmarks));
  }

  return frames;
}

describe("calculateKneeAngle", () => {
  it("returns null when hip is null", () => {
    const knee = createLandmark(0.5, 0.6);
    const ankle = createLandmark(0.5, 0.8);
    expect(calculateKneeAngle(null, knee, ankle)).toBeNull();
  });

  it("returns null when knee is null", () => {
    const hip = createLandmark(0.5, 0.4);
    const ankle = createLandmark(0.5, 0.8);
    expect(calculateKneeAngle(hip, null, ankle)).toBeNull();
  });

  it("returns null when ankle is null", () => {
    const hip = createLandmark(0.5, 0.4);
    const knee = createLandmark(0.5, 0.6);
    expect(calculateKneeAngle(hip, knee, null)).toBeNull();
  });

  it("calculates ~180 degrees for straight leg", () => {
    // Straight vertical leg: hip, knee, ankle in line
    const hip = createLandmark(0.5, 0.3);
    const knee = createLandmark(0.5, 0.5);
    const ankle = createLandmark(0.5, 0.7);

    const angle = calculateKneeAngle(hip, knee, ankle);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(180, 0);
  });

  it("calculates ~90 degrees for right angle bend", () => {
    // Right angle: hip straight up from knee, ankle straight right from knee
    const hip = createLandmark(0.5, 0.3);
    const knee = createLandmark(0.5, 0.5);
    const ankle = createLandmark(0.7, 0.5);

    const angle = calculateKneeAngle(hip, knee, ankle);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(90, 0);
  });

  it("calculates angle < 180 for bent knee", () => {
    // Bent knee: ankle slightly forward
    const hip = createLandmark(0.5, 0.3);
    const knee = createLandmark(0.5, 0.5);
    const ankle = createLandmark(0.55, 0.7);

    const angle = calculateKneeAngle(hip, knee, ankle);
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(180);
    expect(angle!).toBeGreaterThan(90);
  });

  it("returns null for identical points (degenerate case)", () => {
    const point = createLandmark(0.5, 0.5);
    const angle = calculateKneeAngle(point, point, point);
    expect(angle).toBeNull();
  });

  it("handles 3D coordinates", () => {
    // Include z coordinate
    const hip = createLandmark(0.5, 0.3, 0.1);
    const knee = createLandmark(0.5, 0.5, 0.0);
    const ankle = createLandmark(0.5, 0.7, -0.1);

    const angle = calculateKneeAngle(hip, knee, ankle);
    expect(angle).not.toBeNull();
    expect(angle!).toBeGreaterThan(0);
    expect(angle!).toBeLessThanOrEqual(180);
  });
});

describe("detectLegBendLowPoint", () => {
  it("finds frame with minimum knee angle", () => {
    // Create sequence with clear bend at frame 5
    const frames = createLoadPhaseSequence(0, 20, 5, 5);
    const result = detectLegBendLowPoint(frames, 0, 19, LOAD_PHASE_CONFIG);

    expect(result).not.toBeNull();
    // Should find the frame around the bend point
    expect(result!).toBeGreaterThanOrEqual(3);
    expect(result!).toBeLessThanOrEqual(7);
  });

  it("returns null when no valid frames exist", () => {
    // Create frames with null landmarks
    const frames: Frame[] = [
      createFrame(0, null),
      createFrame(1, null),
      createFrame(2, null),
    ];
    const result = detectLegBendLowPoint(frames, 0, 2, LOAD_PHASE_CONFIG);
    expect(result).toBeNull();
  });

  it("respects search window and only looks in first portion of shot", () => {
    // Create sequence with bend at frame 15 (beyond 50% search window)
    const frames = createLoadPhaseSequence(0, 30, 20, 5);
    const result = detectLegBendLowPoint(frames, 0, 29, LOAD_PHASE_CONFIG);

    // Should find a frame in the first half, not frame 20
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(15);
  });

  it("skips frames with low visibility landmarks", () => {
    const frames = createLoadPhaseSequence(0, 10, 5, 5);

    // Make frame 5 have low visibility knee
    const landmarks = frames[5]!.landmarks!;
    const lowVisLandmarks = [...landmarks];
    lowVisLandmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(
      0.4,
      0.55,
      0,
      0.2,
    );
    lowVisLandmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(
      0.6,
      0.55,
      0,
      0.2,
    );
    frames[5] = createFrame(5, lowVisLandmarks);

    const result = detectLegBendLowPoint(frames, 0, 9, LOAD_PHASE_CONFIG);

    // Should not select frame 5 due to low visibility
    expect(result).not.toBe(5);
  });

  it("handles multiple local minima by choosing within search window", () => {
    // Create sequence with two bend points
    const frames = createLoadPhaseSequence(0, 30, 5, 5);

    // Add another deeper bend at frame 25 (outside search window)
    const landmarks = frames[25]!.landmarks!;
    const deepBendLandmarks = [...landmarks];
    // Make ankle position indicate very bent knee
    deepBendLandmarks[LANDMARK_INDICES.LEFT_ANKLE] = createLandmark(
      0.4,
      0.8,
      0,
    );
    deepBendLandmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createLandmark(
      0.6,
      0.8,
      0,
    );
    frames[25] = createFrame(25, deepBendLandmarks);

    const result = detectLegBendLowPoint(frames, 0, 29, LOAD_PHASE_CONFIG);

    // Should find frame in first 50%, not frame 25
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(15);
  });

  it("handles shot boundaries correctly", () => {
    // Create longer sequence, but shot is only frames 10-20
    const frames = createLoadPhaseSequence(0, 30, 15, 15);
    const result = detectLegBendLowPoint(frames, 10, 20, LOAD_PHASE_CONFIG);

    // Result should be within shot boundaries
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(10);
    expect(result!).toBeLessThanOrEqual(15); // First 50% of shot
  });
});

describe("detectBallLowPoint", () => {
  it("finds frame with maximum wrist Y (lowest ball position)", () => {
    // Create sequence with ball dip at frame 5
    const frames = createLoadPhaseSequence(0, 20, 5, 5);
    const result = detectBallLowPoint(frames, 0, 19, LOAD_PHASE_CONFIG);

    expect(result).not.toBeNull();
    // Should find the frame around the dip point
    expect(result!).toBeGreaterThanOrEqual(3);
    expect(result!).toBeLessThanOrEqual(7);
  });

  it("returns null when no valid frames exist", () => {
    const frames: Frame[] = [
      createFrame(0, null),
      createFrame(1, null),
      createFrame(2, null),
    ];
    const result = detectBallLowPoint(frames, 0, 2, LOAD_PHASE_CONFIG);
    expect(result).toBeNull();
  });

  it("respects search window and only looks in first portion of shot", () => {
    // Create sequence with dip at frame 25 (beyond 40% search window)
    const frames = createLoadPhaseSequence(0, 30, 5, 25);
    const result = detectBallLowPoint(frames, 0, 29, LOAD_PHASE_CONFIG);

    // Should find a frame in the first 40%, not frame 25
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(12);
  });

  it("skips frames with low visibility wrist landmarks", () => {
    const frames = createLoadPhaseSequence(0, 10, 5, 5);

    // Make frame 5 have low visibility wrists
    const landmarks = frames[5]!.landmarks!;
    const lowVisLandmarks = [...landmarks];
    lowVisLandmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(
      0.4,
      0.7,
      0,
      0.2,
    );
    lowVisLandmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(
      0.6,
      0.7,
      0,
      0.2,
    );
    frames[5] = createFrame(5, lowVisLandmarks);

    const result = detectBallLowPoint(frames, 0, 9, LOAD_PHASE_CONFIG);

    // Should not select frame 5 due to low visibility
    expect(result).not.toBe(5);
  });

  it("uses wrist Y as proxy for ball position", () => {
    // Create frames with explicit wrist positions
    const frames: Frame[] = [];
    const wristYValues = [0.5, 0.55, 0.65, 0.7, 0.68, 0.6, 0.5, 0.4];

    for (let i = 0; i < wristYValues.length; i++) {
      const landmarks = createDefaultLandmarks();
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(
        0.4,
        wristYValues[i]!,
      );
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(
        0.6,
        wristYValues[i]!,
      );
      frames.push(createFrame(i, landmarks));
    }

    const config: Required<KeyframeDetectorConfig> = {
      ...LOAD_PHASE_CONFIG,
      ballLowPointSearchWindow: 0.6,
    };

    const result = detectBallLowPoint(frames, 0, 7, config);

    // Maximum wrist Y is at frame 3 (0.7)
    expect(result).toBe(3);
  });
});

describe("KeyframeDetector class", () => {
  describe("createKeyframeDetector factory", () => {
    it("creates a detector with default config", () => {
      const detector = createKeyframeDetector();
      expect(detector).toBeInstanceOf(KeyframeDetector);
    });

    it("creates a detector with custom config", () => {
      const config: KeyframeDetectorConfig = {
        visibilityThreshold: 0.7,
        ballLowPointSearchWindow: 0.3,
      };
      const detector = createKeyframeDetector(config);
      expect(detector).toBeInstanceOf(KeyframeDetector);

      const actualConfig = detector.getConfig();
      expect(actualConfig.visibilityThreshold).toBe(0.7);
      expect(actualConfig.ballLowPointSearchWindow).toBe(0.3);
    });
  });

  describe("detectLoadPhaseKeyframes", () => {
    it("detects both leg_bend_low_point and ball_low_point", () => {
      const frames = createLoadPhaseSequence(0, 20, 5, 6);
      const detector = createKeyframeDetector();

      const result = detector.detectLoadPhaseKeyframes(frames, 0, 19);

      expect(result.keyframes).toHaveLength(2);

      const legBend = result.keyframes.find(
        (k) => k.keyframeId === "leg_bend_low_point",
      );
      const ballLow = result.keyframes.find(
        (k) => k.keyframeId === "ball_low_point",
      );

      expect(legBend).toBeDefined();
      expect(ballLow).toBeDefined();
      expect(legBend!.frameIndex).not.toBeNull();
      expect(ballLow!.frameIndex).not.toBeNull();
    });

    it("returns confidence of 1.0 when both keyframes detected", () => {
      const frames = createLoadPhaseSequence(0, 20, 5, 6);
      const detector = createKeyframeDetector();

      const result = detector.detectLoadPhaseKeyframes(frames, 0, 19);

      expect(result.confidence).toBe(1.0);
    });

    it("returns confidence of 0.5 when only one keyframe detected", () => {
      // Create frames where only wrist is valid
      const frames: Frame[] = [];
      for (let i = 0; i < 10; i++) {
        const landmarks = createDefaultLandmarks();
        // Make leg landmarks low visibility
        landmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(
          0.4,
          0.55,
          0,
          0.2,
        );
        landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(
          0.6,
          0.55,
          0,
          0.2,
        );
        // Keep wrist visible
        landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(
          0.4,
          0.5 + i * 0.02,
        );
        landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(
          0.6,
          0.5 + i * 0.02,
        );
        frames.push(createFrame(i, landmarks));
      }

      const detector = createKeyframeDetector();
      const result = detector.detectLoadPhaseKeyframes(frames, 0, 9);

      // Should detect ball_low_point but not leg_bend_low_point
      expect(result.confidence).toBe(0.5);
    });

    it("returns confidence of 0.0 when no keyframes detected", () => {
      const frames: Frame[] = [
        createFrame(0, null),
        createFrame(1, null),
        createFrame(2, null),
      ];
      const detector = createKeyframeDetector();

      const result = detector.detectLoadPhaseKeyframes(frames, 0, 2);

      expect(result.confidence).toBe(0);
    });

    it("provides per-keyframe confidence scores", () => {
      const frames = createLoadPhaseSequence(0, 20, 5, 6);
      const detector = createKeyframeDetector();

      const result = detector.detectLoadPhaseKeyframes(frames, 0, 19);

      for (const keyframe of result.keyframes) {
        expect(keyframe.confidence).toBeGreaterThanOrEqual(0);
        expect(keyframe.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("configuration", () => {
    it("uses custom visibility threshold", () => {
      const frames = createLoadPhaseSequence(0, 10, 5, 5);
      // Make all frames have visibility of 0.6
      for (const frame of frames) {
        if (frame.landmarks) {
          for (let i = 0; i < frame.landmarks.length; i++) {
            (frame.landmarks as TestLandmark[])[i] = {
              ...frame.landmarks[i]!,
              visibility: 0.6,
            };
          }
        }
      }

      // With threshold 0.5, should detect
      const detector1 = createKeyframeDetector({ visibilityThreshold: 0.5 });
      const result1 = detector1.detectLoadPhaseKeyframes(frames, 0, 9);
      expect(result1.confidence).toBeGreaterThan(0);

      // With threshold 0.8, should not detect
      const detector2 = createKeyframeDetector({ visibilityThreshold: 0.8 });
      const result2 = detector2.detectLoadPhaseKeyframes(frames, 0, 9);
      expect(result2.confidence).toBe(0);
    });

    it("uses custom search windows", () => {
      // Create sequence with bend/dip late in the shot
      const frames = createLoadPhaseSequence(0, 20, 15, 15);

      // With default search window (40%), should not find the dip at frame 15
      const detector1 = createKeyframeDetector();
      const result1 = detector1.detectLoadPhaseKeyframes(frames, 0, 19);
      const ballLow1 = result1.keyframes.find(
        (k) => k.keyframeId === "ball_low_point",
      );
      expect(ballLow1!.frameIndex).not.toBe(15);

      // With larger search window (80%), should find the dip at frame 15
      const detector2 = createKeyframeDetector({
        ballLowPointSearchWindow: 0.8,
      });
      const result2 = detector2.detectLoadPhaseKeyframes(frames, 0, 19);
      const ballLow2 = result2.keyframes.find(
        (k) => k.keyframeId === "ball_low_point",
      );
      expect(ballLow2!.frameIndex).toBeCloseTo(15, 0);
    });
  });
});

describe("edge cases", () => {
  it("handles empty frame array", () => {
    const detector = createKeyframeDetector();
    const result = detector.detectLoadPhaseKeyframes([], 0, 0);

    expect(result.keyframes).toHaveLength(2);
    expect(result.keyframes.every((k) => k.frameIndex === null)).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it("handles single frame", () => {
    const frames = [createFrame(5, createDefaultLandmarks())];
    const detector = createKeyframeDetector();

    const result = detector.detectLoadPhaseKeyframes(frames, 5, 5);

    // Should still detect keyframes (the only frame is both the min and max)
    expect(result.keyframes).toHaveLength(2);
  });

  it("handles frames with missing specific landmarks", () => {
    const frames: Frame[] = [];
    for (let i = 0; i < 10; i++) {
      const landmarks = createDefaultLandmarks();
      // Remove knee landmarks by setting to zero visibility
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(0.4, 0.55, 0, 0);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(0.6, 0.55, 0, 0);
      frames.push(createFrame(i, landmarks));
    }

    const detector = createKeyframeDetector();
    const result = detector.detectLoadPhaseKeyframes(frames, 0, 9);

    // Should still detect ball_low_point but not leg_bend_low_point
    const legBend = result.keyframes.find(
      (k) => k.keyframeId === "leg_bend_low_point",
    );
    const ballLow = result.keyframes.find(
      (k) => k.keyframeId === "ball_low_point",
    );

    expect(legBend!.frameIndex).toBeNull();
    expect(ballLow!.frameIndex).not.toBeNull();
  });

  it("handles non-contiguous frame indices", () => {
    // Simulate dropped frames
    const frames: Frame[] = [
      createFrame(0, createDefaultLandmarks()),
      createFrame(2, createDefaultLandmarks()),
      createFrame(5, createDefaultLandmarks()),
      createFrame(8, createDefaultLandmarks()),
    ];

    // Set different wrist Y values
    (frames[0]!.landmarks as TestLandmark[])[LANDMARK_INDICES.LEFT_WRIST] =
      createLandmark(0.4, 0.5);
    (frames[1]!.landmarks as TestLandmark[])[LANDMARK_INDICES.LEFT_WRIST] =
      createLandmark(0.4, 0.7); // Max Y
    (frames[2]!.landmarks as TestLandmark[])[LANDMARK_INDICES.LEFT_WRIST] =
      createLandmark(0.4, 0.6);
    (frames[3]!.landmarks as TestLandmark[])[LANDMARK_INDICES.LEFT_WRIST] =
      createLandmark(0.4, 0.4);

    const detector = createKeyframeDetector();
    const result = detector.detectLoadPhaseKeyframes(frames, 0, 8);

    const ballLow = result.keyframes.find(
      (k) => k.keyframeId === "ball_low_point",
    );
    expect(ballLow!.frameIndex).toBe(2); // Frame index 2 has max wrist Y
  });
});

/**
 * Creates a frame sequence simulating the Rise phase of a basketball shot.
 * After the low point, the knee angle increases (legs extend) and wrist Y
 * decreases (ball rises).
 *
 * @param startFrame - Starting frame index (typically the low point)
 * @param frameCount - Number of frames in the sequence
 * @param extensionStartFrame - Frame where knee extension starts (relative to start)
 * @param riseStartFrame - Frame where ball starts rising (relative to start)
 */
function createRisePhaseSequence(
  startFrame: number,
  frameCount: number,
  extensionStartFrame: number,
  riseStartFrame: number,
): Frame[] {
  const frames: Frame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const frameIdx = startFrame + i;
    const landmarks = createDefaultLandmarks();

    // Calculate knee angle: starts at bent position, extends after extensionStartFrame
    // Before extension: angle ~120 degrees (bent)
    // After extension: angle increases linearly toward 170 degrees
    let kneeAngleTarget: number;
    if (i < extensionStartFrame) {
      // Before extension starts: maintain bent position
      kneeAngleTarget = 120;
    } else {
      // After extension starts: gradually extend
      const extensionProgress =
        (i - extensionStartFrame) / (frameCount - extensionStartFrame);
      kneeAngleTarget = 120 + extensionProgress * 50; // 120 -> 170 degrees
    }

    // Convert target angle to ankle position
    // For a larger angle (more extended), ankle moves more vertical (less X offset)
    const maxAnkleXOffset = 0.15;
    const normalizedBend = 1 - (kneeAngleTarget - 90) / 90; // 0 at 180, 1 at 90
    const ankleXOffset = maxAnkleXOffset * normalizedBend;

    const hipX = 0.5;
    const hipY = 0.4;
    const kneeX = 0.5;
    const kneeY = 0.55;
    const ankleX = 0.5 + ankleXOffset;
    const ankleY = 0.7;

    landmarks[LANDMARK_INDICES.LEFT_HIP] = createLandmark(hipX - 0.1, hipY, 0);
    landmarks[LANDMARK_INDICES.RIGHT_HIP] = createLandmark(hipX + 0.1, hipY, 0);
    landmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(
      kneeX - 0.1,
      kneeY,
      0,
    );
    landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(
      kneeX + 0.1,
      kneeY,
      0,
    );
    landmarks[LANDMARK_INDICES.LEFT_ANKLE] = createLandmark(
      ankleX - 0.1,
      ankleY,
      0,
    );
    landmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createLandmark(
      ankleX + 0.1,
      ankleY,
      0,
    );

    // Calculate wrist Y: starts at low position (high Y), rises after riseStartFrame
    // Before rise: wrist at Y = 0.7 (low position)
    // After rise: wrist Y decreases (ball rises)
    let wristY: number;
    if (i < riseStartFrame) {
      // Before rise starts: maintain low position
      wristY = 0.7;
    } else {
      // After rise starts: ball rises (Y decreases)
      const riseProgress = (i - riseStartFrame) / (frameCount - riseStartFrame);
      wristY = 0.7 - riseProgress * 0.4; // 0.7 -> 0.3
    }

    landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, wristY, 0);
    landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(0.6, wristY, 0);

    frames.push(createFrame(frameIdx, landmarks));
  }

  return frames;
}

describe("calculateVelocity", () => {
  it("calculates frame-to-frame differences", () => {
    const values = [10, 12, 15, 13, 14];
    const velocities = calculateVelocity(values);

    expect(velocities).toHaveLength(4);
    expect(velocities[0]).toBe(2); // 12 - 10
    expect(velocities[1]).toBe(3); // 15 - 12
    expect(velocities[2]).toBe(-2); // 13 - 15
    expect(velocities[3]).toBe(1); // 14 - 13
  });

  it("returns empty array for single value", () => {
    const velocities = calculateVelocity([10]);
    expect(velocities).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const velocities = calculateVelocity([]);
    expect(velocities).toHaveLength(0);
  });
});

describe("calculateSmoothedVelocity", () => {
  it("applies smoothing before calculating velocity", () => {
    // Values with a spike
    const values = [10, 10, 100, 10, 10]; // Spike at index 2
    const velocities = calculateSmoothedVelocity(values, 3);

    // Smoothed velocities should be less extreme
    expect(velocities).toHaveLength(4);
    // The spike gets smoothed, so velocities are moderated
    expect(Math.abs(velocities[1]!)).toBeLessThan(90); // Would be 90 without smoothing
  });

  it("handles window size of 1 (no smoothing)", () => {
    const values = [10, 12, 15];
    const velocities = calculateSmoothedVelocity(values, 1);

    expect(velocities).toHaveLength(2);
    expect(velocities[0]).toBe(2);
    expect(velocities[1]).toBe(3);
  });

  it("returns empty for short arrays", () => {
    const velocities = calculateSmoothedVelocity([10], 3);
    expect(velocities).toHaveLength(0);
  });
});

describe("detectLegsStartExtending", () => {
  const defaultConfig: Required<KeyframeDetectorConfig> = {
    visibilityThreshold: 0.5,
    ballLowPointSearchWindow: 0.4,
    legBendSearchWindow: 0.5,
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -0.005,
    setPointSearchWindow: 0.7,
    setPointMaxElbowAngle: 160,
    releaseSearchWindow: 0.5,
  };

  it("detects frame where knee starts extending", () => {
    // Create sequence where extension starts at frame 5 (relative index 5)
    const frames = createRisePhaseSequence(0, 20, 5, 8);

    const result = detectLegsStartExtending(frames, 0, 19, defaultConfig);

    expect(result).not.toBeNull();
    // Should detect extension starting around frame 5-7
    expect(result!).toBeGreaterThanOrEqual(5);
    expect(result!).toBeLessThanOrEqual(8);
  });

  it("returns null when no clear extension detected", () => {
    // Create frames where knee angle stays constant (no extension)
    const frames: Frame[] = [];
    for (let i = 0; i < 10; i++) {
      const landmarks = createDefaultLandmarks();
      // Keep constant knee position (bent at same angle)
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createLandmark(0.4, 0.4, 0);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createLandmark(0.6, 0.4, 0);
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(0.4, 0.55, 0);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(0.6, 0.55, 0);
      landmarks[LANDMARK_INDICES.LEFT_ANKLE] = createLandmark(0.55, 0.7, 0);
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createLandmark(0.65, 0.7, 0);
      frames.push(createFrame(i, landmarks));
    }

    const result = detectLegsStartExtending(frames, 0, 9, defaultConfig);
    expect(result).toBeNull();
  });

  it("returns null when not enough frames", () => {
    const frames = createRisePhaseSequence(0, 2, 0, 0);
    const result = detectLegsStartExtending(frames, 0, 1, defaultConfig);
    expect(result).toBeNull();
  });

  it("respects search window", () => {
    // Create sequence where extension starts at frame 15 (outside search window)
    const frames = createRisePhaseSequence(0, 30, 15, 15);

    const config: Required<KeyframeDetectorConfig> = {
      ...defaultConfig,
      riseSearchWindow: 0.3, // Only search first 30%
    };

    const result = detectLegsStartExtending(frames, 0, 29, config);

    // Should not find extension at frame 15 (outside search window)
    if (result !== null) {
      expect(result).toBeLessThan(15);
    }
  });

  it("skips frames with low visibility landmarks", () => {
    const frames = createRisePhaseSequence(0, 15, 5, 8);

    // Make frames 5-7 have low visibility
    for (let i = 5; i <= 7; i++) {
      const landmarks = [...(frames[i]!.landmarks as TestLandmark[])];
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createLandmark(
        0.4,
        0.55,
        0,
        0.2,
      );
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createLandmark(
        0.6,
        0.55,
        0,
        0.2,
      );
      frames[i] = createFrame(i, landmarks);
    }

    const result = detectLegsStartExtending(frames, 0, 14, defaultConfig);

    // Should find extension after the low visibility frames
    if (result !== null) {
      expect(result).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("detectBallStartsUpward", () => {
  const defaultConfig: Required<KeyframeDetectorConfig> = {
    visibilityThreshold: 0.5,
    ballLowPointSearchWindow: 0.4,
    legBendSearchWindow: 0.5,
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -0.005,
    setPointSearchWindow: 0.7,
    setPointMaxElbowAngle: 160,
    releaseSearchWindow: 0.5,
  };

  it("detects frame where ball starts rising", () => {
    // Create sequence where ball rises starting at frame 8 (relative index 8)
    const frames = createRisePhaseSequence(0, 20, 5, 8);

    const result = detectBallStartsUpward(frames, 0, 19, defaultConfig);

    expect(result).not.toBeNull();
    // Should detect rise starting around frame 8-10
    expect(result!).toBeGreaterThanOrEqual(8);
    expect(result!).toBeLessThanOrEqual(11);
  });

  it("returns null when ball stays stationary", () => {
    // Create frames where wrist Y stays constant (ball doesn't rise)
    const frames: Frame[] = [];
    for (let i = 0; i < 10; i++) {
      const landmarks = createDefaultLandmarks();
      // Keep constant wrist position
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, 0.6, 0);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(0.6, 0.6, 0);
      frames.push(createFrame(i, landmarks));
    }

    const result = detectBallStartsUpward(frames, 0, 9, defaultConfig);
    expect(result).toBeNull();
  });

  it("returns null when ball moves downward", () => {
    // Create frames where wrist Y increases (ball moves down)
    const frames: Frame[] = [];
    for (let i = 0; i < 10; i++) {
      const landmarks = createDefaultLandmarks();
      const wristY = 0.5 + i * 0.02; // Y increases over time
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, wristY, 0);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(0.6, wristY, 0);
      frames.push(createFrame(i, landmarks));
    }

    const result = detectBallStartsUpward(frames, 0, 9, defaultConfig);
    expect(result).toBeNull();
  });

  it("returns null when not enough frames", () => {
    const frames = createRisePhaseSequence(0, 2, 0, 0);
    const result = detectBallStartsUpward(frames, 0, 1, defaultConfig);
    expect(result).toBeNull();
  });

  it("respects search window", () => {
    // Create sequence where rise starts at frame 18 (outside search window)
    const frames = createRisePhaseSequence(0, 30, 5, 18);

    const config: Required<KeyframeDetectorConfig> = {
      ...defaultConfig,
      riseSearchWindow: 0.5, // Only search first 50%
    };

    const result = detectBallStartsUpward(frames, 0, 29, config);

    // Should not find rise at frame 18 (outside search window)
    if (result !== null) {
      expect(result).toBeLessThan(18);
    }
  });

  it("skips frames with low visibility wrist landmarks", () => {
    const frames = createRisePhaseSequence(0, 15, 5, 8);

    // Make frames 8-10 have low visibility wrists
    for (let i = 8; i <= 10; i++) {
      const landmarks = [...(frames[i]!.landmarks as TestLandmark[])];
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, 0.5, 0, 0.2);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(
        0.6,
        0.5,
        0,
        0.2,
      );
      frames[i] = createFrame(i, landmarks);
    }

    const result = detectBallStartsUpward(frames, 0, 14, defaultConfig);

    // Should find rise after the low visibility frames, or not at all
    if (result !== null) {
      expect(result).toBeGreaterThan(10);
    }
  });
});

describe("KeyframeDetector.detectRisePhaseKeyframes", () => {
  it("detects both legs_start_extending and ball_starts_upward", () => {
    const frames = createRisePhaseSequence(0, 25, 5, 8);
    const detector = createKeyframeDetector();

    const result = detector.detectRisePhaseKeyframes(frames, 0, 0, 24);

    expect(result.keyframes).toHaveLength(2);

    const legsExtending = result.keyframes.find(
      (k) => k.keyframeId === "legs_start_extending",
    );
    const ballUpward = result.keyframes.find(
      (k) => k.keyframeId === "ball_starts_upward",
    );

    expect(legsExtending).toBeDefined();
    expect(ballUpward).toBeDefined();
    expect(legsExtending!.frameIndex).not.toBeNull();
    expect(ballUpward!.frameIndex).not.toBeNull();
  });

  it("returns confidence of 1.0 when both keyframes detected", () => {
    const frames = createRisePhaseSequence(0, 25, 5, 8);
    const detector = createKeyframeDetector();

    const result = detector.detectRisePhaseKeyframes(frames, 0, 0, 24);

    expect(result.confidence).toBe(1.0);
  });

  it("returns confidence of 0.0 when no keyframes detected", () => {
    // Create frames with no movement
    const frames: Frame[] = [];
    for (let i = 0; i < 5; i++) {
      const landmarks = createDefaultLandmarks();
      frames.push(createFrame(i, landmarks));
    }
    const detector = createKeyframeDetector();

    const result = detector.detectRisePhaseKeyframes(frames, 0, 0, 4);

    expect(result.confidence).toBe(0);
  });

  it("allows legs_start_extending before ball_starts_upward", () => {
    // Create sequence where legs extend first, ball rises later
    const frames = createRisePhaseSequence(0, 25, 3, 10);
    const detector = createKeyframeDetector();

    const result = detector.detectRisePhaseKeyframes(frames, 0, 0, 24);

    const legsExtending = result.keyframes.find(
      (k) => k.keyframeId === "legs_start_extending",
    );
    const ballUpward = result.keyframes.find(
      (k) => k.keyframeId === "ball_starts_upward",
    );

    expect(legsExtending!.frameIndex).not.toBeNull();
    expect(ballUpward!.frameIndex).not.toBeNull();
    expect(legsExtending!.frameIndex!).toBeLessThan(ballUpward!.frameIndex!);
  });

  it("allows ball_starts_upward before legs_start_extending", () => {
    // Create sequence where ball rises first, legs extend later
    const frames = createRisePhaseSequence(0, 25, 12, 3);
    const detector = createKeyframeDetector();

    const result = detector.detectRisePhaseKeyframes(frames, 0, 0, 24);

    const legsExtending = result.keyframes.find(
      (k) => k.keyframeId === "legs_start_extending",
    );
    const ballUpward = result.keyframes.find(
      (k) => k.keyframeId === "ball_starts_upward",
    );

    expect(ballUpward!.frameIndex).not.toBeNull();
    expect(legsExtending!.frameIndex).not.toBeNull();
    expect(ballUpward!.frameIndex!).toBeLessThan(legsExtending!.frameIndex!);
  });

  it("uses custom smoothing window size", () => {
    const frames = createRisePhaseSequence(0, 25, 5, 8);

    // Test with different smoothing window sizes
    const detector1 = createKeyframeDetector({ smoothingWindowSize: 2 });
    const detector2 = createKeyframeDetector({ smoothingWindowSize: 5 });

    const result1 = detector1.detectRisePhaseKeyframes(frames, 0, 0, 24);
    const result2 = detector2.detectRisePhaseKeyframes(frames, 0, 0, 24);

    // Both should detect keyframes (may differ slightly due to smoothing)
    expect(result1.confidence).toBeGreaterThan(0);
    expect(result2.confidence).toBeGreaterThan(0);
  });

  it("uses custom minConsecutiveFrames", () => {
    const frames = createRisePhaseSequence(0, 25, 5, 8);

    const detector1 = createKeyframeDetector({ minConsecutiveFrames: 2 });
    const detector2 = createKeyframeDetector({ minConsecutiveFrames: 5 });

    const result1 = detector1.detectRisePhaseKeyframes(frames, 0, 0, 24);
    const result2 = detector2.detectRisePhaseKeyframes(frames, 0, 0, 24);

    // With fewer required consecutive frames, detection should be more sensitive
    expect(result1.confidence).toBeGreaterThanOrEqual(result2.confidence);
  });
});

// ============================================================================
// Set Point and Release Phase Tests
// ============================================================================

describe("calculateElbowAngle", () => {
  it("returns null when shoulder is null", () => {
    const elbow = createLandmark(0.5, 0.5);
    const wrist = createLandmark(0.5, 0.7);
    expect(calculateElbowAngle(null, elbow, wrist)).toBeNull();
  });

  it("returns null when elbow is null", () => {
    const shoulder = createLandmark(0.5, 0.3);
    const wrist = createLandmark(0.5, 0.7);
    expect(calculateElbowAngle(shoulder, null, wrist)).toBeNull();
  });

  it("returns null when wrist is null", () => {
    const shoulder = createLandmark(0.5, 0.3);
    const elbow = createLandmark(0.5, 0.5);
    expect(calculateElbowAngle(shoulder, elbow, null)).toBeNull();
  });

  it("calculates ~180 degrees for straight arm", () => {
    // Straight vertical arm: shoulder, elbow, wrist in line
    const shoulder = createLandmark(0.5, 0.3);
    const elbow = createLandmark(0.5, 0.5);
    const wrist = createLandmark(0.5, 0.7);

    const angle = calculateElbowAngle(shoulder, elbow, wrist);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(180, 0);
  });

  it("calculates ~90 degrees for right angle bend", () => {
    // Right angle: shoulder straight up from elbow, wrist straight right
    const shoulder = createLandmark(0.5, 0.3);
    const elbow = createLandmark(0.5, 0.5);
    const wrist = createLandmark(0.7, 0.5);

    const angle = calculateElbowAngle(shoulder, elbow, wrist);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(90, 0);
  });

  it("calculates angle < 180 for bent elbow", () => {
    // Bent elbow: wrist slightly forward
    const shoulder = createLandmark(0.5, 0.3);
    const elbow = createLandmark(0.5, 0.5);
    const wrist = createLandmark(0.55, 0.65);

    const angle = calculateElbowAngle(shoulder, elbow, wrist);
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(180);
    expect(angle!).toBeGreaterThan(90);
  });

  it("returns null for identical points (degenerate case)", () => {
    const point = createLandmark(0.5, 0.5);
    const angle = calculateElbowAngle(point, point, point);
    expect(angle).toBeNull();
  });
});

describe("calculateWristAngle", () => {
  it("returns null when elbow is null", () => {
    const wrist = createLandmark(0.5, 0.6);
    const indexFinger = createLandmark(0.5, 0.65);
    expect(calculateWristAngle(null, wrist, indexFinger)).toBeNull();
  });

  it("returns null when wrist is null", () => {
    const elbow = createLandmark(0.5, 0.5);
    const indexFinger = createLandmark(0.5, 0.65);
    expect(calculateWristAngle(elbow, null, indexFinger)).toBeNull();
  });

  it("returns null when index finger is null", () => {
    const elbow = createLandmark(0.5, 0.5);
    const wrist = createLandmark(0.5, 0.6);
    expect(calculateWristAngle(elbow, wrist, null)).toBeNull();
  });

  it("calculates ~180 degrees for straight wrist", () => {
    // Straight wrist: elbow, wrist, index in line
    const elbow = createLandmark(0.5, 0.4);
    const wrist = createLandmark(0.5, 0.5);
    const indexFinger = createLandmark(0.5, 0.6);

    const angle = calculateWristAngle(elbow, wrist, indexFinger);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(180, 0);
  });

  it("calculates ~90 degrees for flexed wrist", () => {
    // Flexed wrist at 90 degrees
    const elbow = createLandmark(0.5, 0.4);
    const wrist = createLandmark(0.5, 0.5);
    const indexFinger = createLandmark(0.6, 0.5); // Index pointing perpendicular

    const angle = calculateWristAngle(elbow, wrist, indexFinger);
    expect(angle).not.toBeNull();
    expect(angle!).toBeCloseTo(90, 0);
  });

  it("calculates angle < 180 for partially flexed wrist", () => {
    // Partially flexed wrist
    const elbow = createLandmark(0.5, 0.4);
    const wrist = createLandmark(0.5, 0.5);
    const indexFinger = createLandmark(0.52, 0.58);

    const angle = calculateWristAngle(elbow, wrist, indexFinger);
    expect(angle).not.toBeNull();
    expect(angle!).toBeLessThan(180);
    expect(angle!).toBeGreaterThan(90);
  });
});

/**
 * Creates a frame sequence simulating the Set Point and Release phase.
 * The wrist rises to a high point (set point) with bent elbow,
 * then the wrist snaps (flexes) during release.
 *
 * @param startFrame - Starting frame index
 * @param frameCount - Number of frames
 * @param setPointFrame - Frame where set point occurs (relative to start)
 * @param releaseFrame - Frame where release occurs (relative to start)
 */
function createSetPointReleaseSequence(
  startFrame: number,
  frameCount: number,
  setPointFrame: number,
  releaseFrame: number,
): Frame[] {
  const frames: Frame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const frameIdx = startFrame + i;
    const landmarks = createDefaultLandmarks();

    // Wrist Y position: rises to minimum (highest position) at setPointFrame
    // Before set point: wrist rises (Y decreases)
    // After set point: wrist stays high or slightly descends
    let wristY: number;
    if (i < setPointFrame) {
      // Rising to set point
      const progress = i / setPointFrame;
      wristY = 0.6 - progress * 0.25; // 0.6 -> 0.35
    } else {
      // After set point: slight descent
      const progress = (i - setPointFrame) / (frameCount - setPointFrame);
      wristY = 0.35 + progress * 0.1; // 0.35 -> 0.45
    }

    // Elbow angle: starts bent, stays bent until after set point
    // Then gradually extends
    let elbowAngleTarget: number;
    if (i <= setPointFrame) {
      // Bent elbow at set point (~120 degrees)
      elbowAngleTarget = 120;
    } else {
      // Elbow extends after set point
      const progress = (i - setPointFrame) / (frameCount - setPointFrame);
      elbowAngleTarget = 120 + progress * 50; // 120 -> 170
    }

    // Position arm landmarks to achieve target elbow angle
    const shoulderY = 0.3;
    const elbowY = 0.4;
    // For a bent elbow, wrist moves forward relative to shoulder-elbow line
    const normalizedBend = 1 - (elbowAngleTarget - 90) / 90;
    const wristXOffset = normalizedBend * 0.15;

    landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createLandmark(
      0.4,
      shoulderY,
      0,
    );
    landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createLandmark(
      0.6,
      shoulderY,
      0,
    );
    landmarks[LANDMARK_INDICES.LEFT_ELBOW] = createLandmark(0.4, elbowY, 0);
    landmarks[LANDMARK_INDICES.RIGHT_ELBOW] = createLandmark(0.6, elbowY, 0);
    landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(
      0.4 + wristXOffset,
      wristY,
      0,
    );
    landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(
      0.6 + wristXOffset,
      wristY,
      0,
    );

    // Wrist flexion angle: straight before release, maximally flexed at release
    // Before release: ~170 degrees (mostly straight)
    // At release: ~100-120 degrees (flexed/snapped)
    // After release: gradually returns to straight
    let wristFlexion: number;
    if (i < releaseFrame) {
      // Before release: gradually increase flexion
      const progress = Math.max(
        0,
        (i - setPointFrame) / (releaseFrame - setPointFrame),
      );
      wristFlexion = 170 - progress * 60; // 170 -> 110
    } else if (i === releaseFrame) {
      // Maximum flexion at release
      wristFlexion = 100;
    } else {
      // After release: return to straight
      const progress = (i - releaseFrame) / (frameCount - releaseFrame);
      wristFlexion = 100 + progress * 60; // 100 -> 160
    }

    // Position index finger to achieve target wrist flexion
    // Wrist flexion is angle at wrist between forearm and hand direction
    const wristPos = landmarks[LANDMARK_INDICES.LEFT_WRIST]!;
    const flexionRad = (wristFlexion * Math.PI) / 180;
    const indexOffset = 0.05; // Distance from wrist to index
    // For simplicity, flex in the Y direction
    const indexY = wristPos.y + indexOffset * Math.cos(Math.PI - flexionRad);
    const indexX = wristPos.x + indexOffset * Math.sin(Math.PI - flexionRad);

    landmarks[LANDMARK_INDICES.LEFT_INDEX] = createLandmark(indexX, indexY, 0);
    landmarks[LANDMARK_INDICES.RIGHT_INDEX] = createLandmark(
      indexX + 0.2,
      indexY,
      0,
    );

    frames.push(createFrame(frameIdx, landmarks));
  }

  return frames;
}

describe("detectSetPoint", () => {
  const defaultConfig: Required<KeyframeDetectorConfig> = {
    visibilityThreshold: 0.5,
    ballLowPointSearchWindow: 0.4,
    legBendSearchWindow: 0.5,
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -0.005,
    setPointSearchWindow: 0.7,
    setPointMaxElbowAngle: 160,
    releaseSearchWindow: 0.5,
  };

  it("detects frame with highest wrist position and bent elbow", () => {
    const frames = createSetPointReleaseSequence(0, 30, 10, 15);
    const result = detectSetPoint(frames, 0, 29, defaultConfig);

    expect(result).not.toBeNull();
    // Should detect set point around frame 10
    expect(result!).toBeGreaterThanOrEqual(8);
    expect(result!).toBeLessThanOrEqual(12);
  });

  it("returns null when no valid frames exist", () => {
    const frames: Frame[] = [
      createFrame(0, null),
      createFrame(1, null),
      createFrame(2, null),
    ];
    const result = detectSetPoint(frames, 0, 2, defaultConfig);
    expect(result).toBeNull();
  });

  it("respects search window", () => {
    // Create sequence with set point at frame 25 (beyond 70% search window of 30 frames)
    const frames = createSetPointReleaseSequence(0, 30, 25, 28);

    const config: Required<KeyframeDetectorConfig> = {
      ...defaultConfig,
      setPointSearchWindow: 0.5, // Only search first 50%
    };

    const result = detectSetPoint(frames, 0, 29, config);

    // Should find a frame in the search window, not frame 25
    if (result !== null) {
      expect(result).toBeLessThan(25);
    }
  });

  it("skips frames with low visibility landmarks", () => {
    const frames = createSetPointReleaseSequence(0, 20, 10, 15);

    // Make frame 10 have low visibility wrists
    const landmarks = [...(frames[10]!.landmarks as TestLandmark[])];
    landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, 0.35, 0, 0.2);
    landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(0.6, 0.35, 0, 0.2);
    frames[10] = createFrame(10, landmarks);

    const result = detectSetPoint(frames, 0, 19, defaultConfig);

    // Should not select frame 10 due to low visibility
    expect(result).not.toBe(10);
  });

  it("prefers frames with bent elbow when wrist is at similar height", () => {
    const frames = createSetPointReleaseSequence(0, 20, 8, 15);

    // Verify set point is detected near frame 8 where elbow is still bent
    const result = detectSetPoint(frames, 0, 19, defaultConfig);

    expect(result).not.toBeNull();
    // Should be around the set point frame where elbow is bent
    expect(result!).toBeGreaterThanOrEqual(6);
    expect(result!).toBeLessThanOrEqual(12);
  });
});

describe("detectRelease", () => {
  const defaultConfig: Required<KeyframeDetectorConfig> = {
    visibilityThreshold: 0.5,
    ballLowPointSearchWindow: 0.4,
    legBendSearchWindow: 0.5,
    riseSearchWindow: 0.6,
    smoothingWindowSize: 3,
    minConsecutiveFrames: 2,
    kneeVelocityThreshold: 0.5,
    wristVelocityThreshold: -0.005,
    setPointSearchWindow: 0.7,
    setPointMaxElbowAngle: 160,
    releaseSearchWindow: 0.5,
  };

  it("detects frame with maximum wrist flexion", () => {
    const frames = createSetPointReleaseSequence(0, 30, 10, 15);
    const result = detectRelease(frames, 10, 29, defaultConfig);

    expect(result).not.toBeNull();
    // Release should be detected somewhere after the set point (frame 10)
    // The exact frame depends on the generated wrist flexion pattern
    expect(result!).toBeGreaterThan(10);
    expect(result!).toBeLessThanOrEqual(20);
  });

  it("returns null when no valid frames exist", () => {
    const frames: Frame[] = [
      createFrame(10, null),
      createFrame(11, null),
      createFrame(12, null),
    ];
    const result = detectRelease(frames, 10, 12, defaultConfig);
    expect(result).toBeNull();
  });

  it("respects search window", () => {
    // Create sequence with release at frame 25
    const frames = createSetPointReleaseSequence(0, 30, 10, 25);

    const config: Required<KeyframeDetectorConfig> = {
      ...defaultConfig,
      releaseSearchWindow: 0.3, // Only search first 30% after set point
    };

    const result = detectRelease(frames, 10, 29, config);

    // Should not find frame 25 (outside search window)
    if (result !== null) {
      expect(result).toBeLessThan(20);
    }
  });

  it("skips frames with low visibility landmarks", () => {
    const frames = createSetPointReleaseSequence(0, 20, 8, 12);

    // Make frame 12 have low visibility index finger
    const landmarks = [...(frames[12]!.landmarks as TestLandmark[])];
    landmarks[LANDMARK_INDICES.LEFT_INDEX] = createLandmark(0.45, 0.5, 0, 0.2);
    landmarks[LANDMARK_INDICES.RIGHT_INDEX] = createLandmark(0.65, 0.5, 0, 0.2);
    frames[12] = createFrame(12, landmarks);

    const result = detectRelease(frames, 8, 19, defaultConfig);

    // Should not select frame 12 due to low visibility
    expect(result).not.toBe(12);
  });

  it("finds release after set point", () => {
    const frames = createSetPointReleaseSequence(0, 30, 10, 18);
    const result = detectRelease(frames, 10, 29, defaultConfig);

    expect(result).not.toBeNull();
    // Release should be after set point
    expect(result!).toBeGreaterThan(10);
  });
});

describe("KeyframeDetector.detectSetPointReleaseKeyframes", () => {
  it("detects both set_point and release", () => {
    const frames = createSetPointReleaseSequence(0, 30, 10, 18);
    const detector = createKeyframeDetector();

    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 29);

    expect(result.keyframes).toHaveLength(2);

    const setPoint = result.keyframes.find((k) => k.keyframeId === "set_point");
    const release = result.keyframes.find((k) => k.keyframeId === "release");

    expect(setPoint).toBeDefined();
    expect(release).toBeDefined();
    expect(setPoint!.frameIndex).not.toBeNull();
    expect(release!.frameIndex).not.toBeNull();
  });

  it("returns confidence of 1.0 when both keyframes detected", () => {
    const frames = createSetPointReleaseSequence(0, 30, 10, 18);
    const detector = createKeyframeDetector();

    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 29);

    expect(result.confidence).toBe(1.0);
  });

  it("returns confidence of 0.0 when no keyframes detected", () => {
    const frames: Frame[] = [
      createFrame(0, null),
      createFrame(1, null),
      createFrame(2, null),
    ];
    const detector = createKeyframeDetector();

    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 2);

    expect(result.confidence).toBe(0);
  });

  it("ensures release occurs after set_point", () => {
    const frames = createSetPointReleaseSequence(0, 30, 8, 15);
    const detector = createKeyframeDetector();

    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 29);

    const setPoint = result.keyframes.find((k) => k.keyframeId === "set_point");
    const release = result.keyframes.find((k) => k.keyframeId === "release");

    expect(setPoint!.frameIndex).not.toBeNull();
    expect(release!.frameIndex).not.toBeNull();
    // Release must come after set point
    expect(release!.frameIndex!).toBeGreaterThan(setPoint!.frameIndex!);
  });

  it("returns null release when set_point is not detected", () => {
    // Create frames where set point cannot be detected (no valid wrist data)
    const frames: Frame[] = [];
    for (let i = 0; i < 10; i++) {
      const landmarks = createDefaultLandmarks();
      // Make wrist landmarks low visibility
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createLandmark(0.4, 0.5, 0, 0.2);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createLandmark(
        0.6,
        0.5,
        0,
        0.2,
      );
      frames.push(createFrame(i, landmarks));
    }

    const detector = createKeyframeDetector();
    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 9);

    const release = result.keyframes.find((k) => k.keyframeId === "release");
    expect(release!.frameIndex).toBeNull();
  });

  it("uses custom setPointMaxElbowAngle", () => {
    const frames = createSetPointReleaseSequence(0, 30, 10, 18);

    // With very low threshold, most frames should be rejected
    const detector1 = createKeyframeDetector({ setPointMaxElbowAngle: 90 });
    // With high threshold, all frames should be valid candidates
    const detector2 = createKeyframeDetector({ setPointMaxElbowAngle: 180 });

    const result1 = detector1.detectSetPointReleaseKeyframes(frames, 0, 29);
    const result2 = detector2.detectSetPointReleaseKeyframes(frames, 0, 29);

    // Both should detect something (we still fall back if no bent elbow frames)
    const setPoint1 = result1.keyframes.find(
      (k) => k.keyframeId === "set_point",
    );
    const setPoint2 = result2.keyframes.find(
      (k) => k.keyframeId === "set_point",
    );

    expect(setPoint2!.frameIndex).not.toBeNull();
    // With stricter threshold, may get different result
    if (setPoint1!.frameIndex !== null && setPoint2!.frameIndex !== null) {
      // Both should find a set point (may differ)
      expect(typeof setPoint1!.frameIndex).toBe("number");
    }
  });
});

describe("Set/Release edge cases", () => {
  it("handles quick release with set_point and release close together", () => {
    // Create sequence with very quick release (set_point and release only 2 frames apart)
    const frames = createSetPointReleaseSequence(0, 20, 8, 10);
    const detector = createKeyframeDetector();

    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 19);

    const setPoint = result.keyframes.find((k) => k.keyframeId === "set_point");
    const release = result.keyframes.find((k) => k.keyframeId === "release");

    // Both should be detected even when close together
    expect(setPoint!.frameIndex).not.toBeNull();
    expect(release!.frameIndex).not.toBeNull();
  });

  it("handles empty frame array", () => {
    const detector = createKeyframeDetector();
    const result = detector.detectSetPointReleaseKeyframes([], 0, 0);

    expect(result.keyframes).toHaveLength(2);
    expect(result.keyframes.every((k) => k.frameIndex === null)).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it("handles single frame", () => {
    const frames = createSetPointReleaseSequence(5, 1, 0, 0);
    const detector = createKeyframeDetector();

    const result = detector.detectSetPointReleaseKeyframes(frames, 5, 5);

    // May or may not detect (single frame limits what can be found)
    expect(result.keyframes).toHaveLength(2);
  });

  it("handles non-contiguous frame indices", () => {
    // Simulate dropped frames
    const allFrames = createSetPointReleaseSequence(0, 20, 8, 12);
    const frames: Frame[] = [
      allFrames[0]!,
      allFrames[2]!,
      allFrames[5]!,
      allFrames[8]!,
      allFrames[12]!,
      allFrames[15]!,
    ];

    const detector = createKeyframeDetector();
    const result = detector.detectSetPointReleaseKeyframes(frames, 0, 15);

    // Should still be able to detect keyframes from available frames
    const setPoint = result.keyframes.find((k) => k.keyframeId === "set_point");
    expect(setPoint!.frameIndex).not.toBeNull();
  });
});
