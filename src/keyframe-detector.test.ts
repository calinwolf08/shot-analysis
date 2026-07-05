/**
 * Unit tests for KeyframeDetector - Load phase keyframe detection.
 *
 * Tests detectLegBendLowPoint() and detectBallLowPoint() functions
 * for identifying Load phase keyframes in basketball shots.
 */

import { describe, it, expect } from "vitest";
import {
  KeyframeDetector,
  createKeyframeDetector,
  calculateKneeAngle,
  detectLegBendLowPoint,
  detectBallLowPoint,
  type KeyframeDetectorConfig,
} from "./keyframe-detector";
import type { Frame, TestLandmark } from "./testing/types";
import { LANDMARK_INDICES } from "./types";

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
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectLegBendLowPoint(frames, 0, 19, config);

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
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectLegBendLowPoint(frames, 0, 2, config);
    expect(result).toBeNull();
  });

  it("respects search window and only looks in first portion of shot", () => {
    // Create sequence with bend at frame 15 (beyond 50% search window)
    const frames = createLoadPhaseSequence(0, 30, 20, 5);
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5, // Search only first 50%
    };

    const result = detectLegBendLowPoint(frames, 0, 29, config);

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

    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectLegBendLowPoint(frames, 0, 9, config);

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

    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectLegBendLowPoint(frames, 0, 29, config);

    // Should find frame in first 50%, not frame 25
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(15);
  });

  it("handles shot boundaries correctly", () => {
    // Create longer sequence, but shot is only frames 10-20
    const frames = createLoadPhaseSequence(0, 30, 15, 15);
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectLegBendLowPoint(frames, 10, 20, config);

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
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectBallLowPoint(frames, 0, 19, config);

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
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectBallLowPoint(frames, 0, 2, config);
    expect(result).toBeNull();
  });

  it("respects search window and only looks in first portion of shot", () => {
    // Create sequence with dip at frame 25 (beyond 40% search window)
    const frames = createLoadPhaseSequence(0, 30, 5, 25);
    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectBallLowPoint(frames, 0, 29, config);

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

    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.4,
      legBendSearchWindow: 0.5,
    };

    const result = detectBallLowPoint(frames, 0, 9, config);

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

    const config = {
      visibilityThreshold: 0.5,
      ballLowPointSearchWindow: 0.6,
      legBendSearchWindow: 0.5,
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
