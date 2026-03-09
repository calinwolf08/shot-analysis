/**
 * Tests for detection execution and comparison functions.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 * @see Task 9.2 - Detection Execution & Comparison
 */

import { describe, it, expect } from "vitest";
import {
  adaptPoseDataToDetector,
  detectOrientation,
  runDetection,
  compareResults,
  runAndCompare,
  type DetectionResult,
} from "./detection";
import type {
  PoseData,
  LabelData,
  Frame,
  TestLandmark,
  Orientation,
} from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test landmark with default values.
 */
function createTestLandmark(
  x: number,
  y: number,
  z: number = 0,
  visibility: number = 0.99,
): TestLandmark {
  return { x, y, z, visibility };
}

/**
 * Creates an array of 33 default landmarks.
 */
function createDefaultLandmarks(): TestLandmark[] {
  return Array.from({ length: 33 }, () =>
    createTestLandmark(0.5, 0.5, 0, 0.99),
  );
}

/**
 * Creates a test frame with specified wrist Y positions.
 */
function createFrameWithWrists(
  frameIndex: number,
  leftWristY: number,
  rightWristY: number,
  options: {
    leftShoulderX?: number;
    rightShoulderX?: number;
    leftHipX?: number;
    rightHipX?: number;
    shoulderZ?: number;
  } = {},
): Frame {
  const landmarks = createDefaultLandmarks();

  // Set wrists (15 = left, 16 = right)
  landmarks[15] = createTestLandmark(0.3, leftWristY);
  landmarks[16] = createTestLandmark(0.7, rightWristY);

  // Set shoulders for arm return detection (11 = left, 12 = right)
  landmarks[11] = createTestLandmark(
    options.leftShoulderX ?? 0.35,
    0.3,
    options.shoulderZ ?? 0,
  );
  landmarks[12] = createTestLandmark(
    options.rightShoulderX ?? 0.65,
    0.3,
    -(options.shoulderZ ?? 0),
  );

  // Set hips (23 = left, 24 = right)
  landmarks[23] = createTestLandmark(options.leftHipX ?? 0.4, 0.6);
  landmarks[24] = createTestLandmark(options.rightHipX ?? 0.6, 0.6);

  return {
    frameIndex,
    timestamp: frameIndex / 30,
    poseConfidence: 0.95,
    landmarks,
  };
}

/**
 * Creates minimal PoseData with given frames.
 */
function createPoseData(frames: Frame[]): PoseData {
  return {
    video: "test-video.mp4",
    fps: 30,
    totalFrames: frames.length,
    width: 1920,
    height: 1080,
    extractedAt: new Date().toISOString(),
    frames,
  };
}

/**
 * Creates minimal PoseData for comparison tests.
 * Creates frames with front orientation by default.
 */
function createMinimalPoseData(
  shots: Array<{ startFrame: number; endFrame: number }>,
  options: {
    leftShoulderX?: number;
    rightShoulderX?: number;
    leftHipX?: number;
    rightHipX?: number;
    shoulderZ?: number;
  } = {},
): PoseData {
  // Find the max frame needed
  const maxFrame = Math.max(...shots.map((s) => s.endFrame)) + 10;
  const frames: Frame[] = [];

  for (let i = 0; i <= maxFrame; i++) {
    frames.push(
      createFrameWithWrists(i, 0.5, 0.5, {
        leftShoulderX: options.leftShoulderX ?? 0.35,
        rightShoulderX: options.rightShoulderX ?? 0.65,
        leftHipX: options.leftHipX ?? 0.4,
        rightHipX: options.rightHipX ?? 0.6,
        shoulderZ: options.shoulderZ ?? 0,
      }),
    );
  }

  return createPoseData(frames);
}

/**
 * Creates minimal LabelData for testing.
 */
function createLabelData(
  shots: Array<{
    startFrame: number;
    endFrame: number;
    cameraOrientation?: Orientation;
  }>,
  defaultOrientation: Orientation = "front",
): LabelData {
  return {
    video: "test-video.mp4",
    labeledBy: "test",
    labeledAt: new Date().toISOString(),
    shots: shots.map((shot, index) => ({
      shotNumber: index + 1,
      startFrame: shot.startFrame,
      endFrame: shot.endFrame,
      cameraOrientation: shot.cameraOrientation ?? defaultOrientation,
    })),
  };
}

// ============================================================================
// Tests: Adapter
// ============================================================================

describe("adaptPoseDataToDetector", () => {
  it("converts PoseData frames to PoseLandmarks array", () => {
    const frames = [
      createFrameWithWrists(0, 0.5, 0.5),
      createFrameWithWrists(1, 0.45, 0.45),
    ];
    const poseData = createPoseData(frames);

    const result = adaptPoseDataToDetector(poseData);

    expect(result.landmarks).toHaveLength(2);
    expect(result.landmarks[0]!.landmarks).toHaveLength(33);
    expect(result.landmarks[0]!.poseConfidence).toBe(0.95);
  });

  it("adds confidence property to landmarks", () => {
    const frames = [createFrameWithWrists(0, 0.5, 0.5)];
    const poseData = createPoseData(frames);

    const result = adaptPoseDataToDetector(poseData);

    // Test landmarks now have confidence (same as visibility)
    const landmark = result.landmarks[0]!.landmarks[0]!;
    expect(landmark).toHaveProperty("confidence");
    expect(landmark.confidence).toBe(landmark.visibility);
  });

  it("handles empty frames array", () => {
    const poseData = createPoseData([]);
    const result = adaptPoseDataToDetector(poseData);
    expect(result.landmarks).toHaveLength(0);
  });

  it("provides correct indexToFrame mapping", () => {
    const frames = [
      createFrameWithWrists(0, 0.5, 0.5),
      createFrameWithWrists(1, 0.45, 0.45),
    ];
    const poseData = createPoseData(frames);

    const result = adaptPoseDataToDetector(poseData);

    expect(result.indexToFrame).toHaveLength(2);
    expect(result.indexToFrame[0]).toBe(0);
    expect(result.indexToFrame[1]).toBe(1);
  });
});

// ============================================================================
// Tests: Orientation Detection
// ============================================================================

describe("detectOrientation", () => {
  it("returns 'unknown' for empty frames", () => {
    const poseData = createPoseData([]);
    expect(detectOrientation(poseData)).toBe("unknown");
  });

  it("can detect orientation with minimal frames", () => {
    // With the updated algorithm, even 2 frames may be enough if they have valid landmarks
    // Note: default createFrameWithWrists uses leftShoulderX=0.35, rightShoulderX=0.65
    // which is rightShoulder.x > leftShoulder.x -> "behind" view in MediaPipe convention
    const frames = [
      createFrameWithWrists(0, 0.5, 0.5),
      createFrameWithWrists(1, 0.5, 0.5),
    ];
    const poseData = createPoseData(frames);
    const orientation = detectOrientation(poseData);
    // With clear shoulder separation in createFrameWithWrists, we can detect orientation
    expect(["behind", "behind-left", "behind-right", "unknown"]).toContain(
      orientation,
    );
  });

  it("detects 'front' orientation with clear shoulder separation", () => {
    // Create frames with shoulders clearly separated for FRONT view
    // MediaPipe convention: "left"/"right" refer to PERSON's body parts
    // Front view: rightShoulder.x < leftShoulder.x (person's right appears on viewer's left)
    const frames: Frame[] = [];
    for (let i = 0; i < 30; i++) {
      frames.push(
        createFrameWithWrists(i, 0.5, 0.5, {
          leftShoulderX: 0.7, // Person's left shoulder on viewer's right
          rightShoulderX: 0.3, // Person's right shoulder on viewer's left
          leftHipX: 0.65,
          rightHipX: 0.35,
        }),
      );
    }
    const poseData = createPoseData(frames);

    expect(detectOrientation(poseData)).toBe("front");
  });

  it("detects 'side-left' orientation with aligned shoulders and depth difference", () => {
    // Create frames with shoulders nearly aligned in X but different Z
    const frames: Frame[] = [];
    for (let i = 0; i < 30; i++) {
      const frame = createFrameWithWrists(i, 0.5, 0.5, {
        leftShoulderX: 0.48,
        rightShoulderX: 0.52,
        leftHipX: 0.48,
        rightHipX: 0.52,
        shoulderZ: -0.2, // Left shoulder closer, right farther
      });
      frames.push(frame);
    }
    const poseData = createPoseData(frames);

    expect(detectOrientation(poseData)).toBe("side-left");
  });

  it("detects 'side-right' orientation with aligned shoulders and opposite depth", () => {
    // Create frames with shoulders nearly aligned in X but different Z
    const frames: Frame[] = [];
    for (let i = 0; i < 30; i++) {
      const frame = createFrameWithWrists(i, 0.5, 0.5, {
        leftShoulderX: 0.48,
        rightShoulderX: 0.52,
        leftHipX: 0.48,
        rightHipX: 0.52,
        shoulderZ: 0.2, // Right shoulder closer, left farther
      });
      frames.push(frame);
    }
    const poseData = createPoseData(frames);

    expect(detectOrientation(poseData)).toBe("side-right");
  });
});

// ============================================================================
// Tests: Tolerance Logic
// ============================================================================

describe("compareResults - tolerance logic", () => {
  // Front view requires leftShoulderX > rightShoulderX (person's right appears on viewer's left)
  const frontShoulderOptions = {
    leftShoulderX: 0.65,
    rightShoulderX: 0.35,
    leftHipX: 0.6,
    rightHipX: 0.4,
  };

  it("passes with diff <= 8 (base tolerance)", () => {
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 50 }],
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 15, endFrame: 45 }], "front");
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 50 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("pass");
    expect(result.shots[0]!.startFrame.diff).toBe(5);
    expect(result.shots[0]!.endFrame.diff).toBe(5);
  });

  it("fails with diff > 10 even with expansion", () => {
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 50 }],
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 10, endFrame: 62 }], "front");
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 62 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.shots[0]!.endFrame.diff).toBe(12);
    expect(result.shots[0]!.endFrame.pass).toBe(false);
  });

  it("expands tolerance when diff is exactly 8", () => {
    // Diff of 8 should trigger expansion to ±10
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 58 }],
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 58 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("pass");
    expect(result.shots[0]!.endFrame.diff).toBe(8);
    expect(result.shots[0]!.endFrame.pass).toBe(true);
  });

  it("passes with diff of 10 when tolerance is expanded", () => {
    // Diff of 8 triggers expansion, then diff of 10 should pass
    const detection: DetectionResult = {
      shots: [{ startFrame: 18, endFrame: 60 }], // start diff = 8, end diff = 10
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
    const poseData = createMinimalPoseData(
      [{ startFrame: 18, endFrame: 60 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("pass");
    expect(result.shots[0]!.startFrame.diff).toBe(8);
    expect(result.shots[0]!.endFrame.diff).toBe(10);
  });

  it("does not expand tolerance if no diff is exactly 8", () => {
    // Diff of 9 without an 8 should fail
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 59 }],
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 59 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.shots[0]!.endFrame.diff).toBe(9);
    expect(result.shots[0]!.endFrame.pass).toBe(false);
  });
});

// ============================================================================
// Tests: Shot Count Mismatch
// ============================================================================

describe("compareResults - shot count mismatch", () => {
  it("fails when no shots detected", () => {
    const detection: DetectionResult = {
      shots: [],
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
    const poseData = createMinimalPoseData([{ startFrame: 10, endFrame: 50 }]);

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.failureReason).toBe("no shots detected");
    expect(result.shots).toHaveLength(0);
  });

  it("fails when detected more shots than labeled", () => {
    const detection: DetectionResult = {
      shots: [
        { startFrame: 10, endFrame: 50 },
        { startFrame: 60, endFrame: 100 },
      ],
      orientation: "front",
    };
    const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
    const poseData = createMinimalPoseData([
      { startFrame: 10, endFrame: 50 },
      { startFrame: 60, endFrame: 100 },
    ]);

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.failureReason).toContain("shot count mismatch");
    expect(result.failureReason).toContain("detected 2, expected 1");
  });

  it("fails when detected fewer shots than labeled", () => {
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 50 }],
      orientation: "front",
    };
    const labels = createLabelData(
      [
        { startFrame: 10, endFrame: 50 },
        { startFrame: 60, endFrame: 100 },
      ],
      "front",
    );
    const poseData = createMinimalPoseData([{ startFrame: 10, endFrame: 50 }]);

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.failureReason).toContain("shot count mismatch");
    expect(result.failureReason).toContain("detected 1, expected 2");
  });
});

// ============================================================================
// Tests: Per-Shot Orientation Mismatch
// ============================================================================

describe("compareResults - per-shot orientation", () => {
  // Front view requires leftShoulderX > rightShoulderX (person's right appears on viewer's left)
  const frontShoulderOptions = {
    leftShoulderX: 0.65,
    rightShoulderX: 0.35,
    leftHipX: 0.6,
    rightHipX: 0.4,
  };

  it("fails when shot orientation does not match", () => {
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 50 }],
      orientation: "front",
    };
    const labels = createLabelData(
      [{ startFrame: 10, endFrame: 50, cameraOrientation: "side-left" }],
      "side-left",
    );
    // Create pose data with front orientation (will mismatch side-left label)
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 50 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.shots[0]!.orientation.match).toBe(false);
    expect(result.shots[0]!.orientation.expected).toBe("side-left");
    expect(result.failureReason).toContain("orientation");
  });

  it("passes when shot orientation matches", () => {
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 50 }],
      orientation: "front",
    };
    const labels = createLabelData(
      [{ startFrame: 10, endFrame: 50, cameraOrientation: "front" }],
      "front",
    );
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 50 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("pass");
    expect(result.shots[0]!.orientation.match).toBe(true);
  });

  it("includes per-shot orientation in comparison results", () => {
    const detection: DetectionResult = {
      shots: [{ startFrame: 10, endFrame: 50 }],
      orientation: "front",
    };
    const labels = createLabelData(
      [{ startFrame: 10, endFrame: 50, cameraOrientation: "front" }],
      "front",
    );
    const poseData = createMinimalPoseData(
      [{ startFrame: 10, endFrame: 50 }],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.shots[0]!.orientation).toBeDefined();
    expect(result.shots[0]!.orientation.expected).toBe("front");
    expect(result.shots[0]!.orientation).toHaveProperty("detected");
    expect(result.shots[0]!.orientation).toHaveProperty("match");
  });
});

// ============================================================================
// Tests: Multiple Shots
// ============================================================================

describe("compareResults - multiple shots", () => {
  // Front view requires leftShoulderX > rightShoulderX (person's right appears on viewer's left)
  const frontShoulderOptions = {
    leftShoulderX: 0.65,
    rightShoulderX: 0.35,
    leftHipX: 0.6,
    rightHipX: 0.4,
  };

  it("passes when all shots are within tolerance", () => {
    const detection: DetectionResult = {
      shots: [
        { startFrame: 11, endFrame: 48 },
        { startFrame: 61, endFrame: 99 },
      ],
      orientation: "front",
    };
    const labels = createLabelData(
      [
        { startFrame: 10, endFrame: 50 },
        { startFrame: 60, endFrame: 100 },
      ],
      "front",
    );
    const poseData = createMinimalPoseData(
      [
        { startFrame: 11, endFrame: 48 },
        { startFrame: 61, endFrame: 99 },
      ],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("pass");
    expect(result.shots).toHaveLength(2);
    expect(result.shots[0]!.startFrame.pass).toBe(true);
    expect(result.shots[0]!.endFrame.pass).toBe(true);
    expect(result.shots[1]!.startFrame.pass).toBe(true);
    expect(result.shots[1]!.endFrame.pass).toBe(true);
  });

  it("fails if any shot frame exceeds tolerance", () => {
    const detection: DetectionResult = {
      shots: [
        { startFrame: 10, endFrame: 50 },
        { startFrame: 60, endFrame: 110 }, // end diff = 10
      ],
      orientation: "front",
    };
    const labels = createLabelData(
      [
        { startFrame: 10, endFrame: 50 },
        { startFrame: 60, endFrame: 100 },
      ],
      "front",
    );
    const poseData = createMinimalPoseData(
      [
        { startFrame: 10, endFrame: 50 },
        { startFrame: 60, endFrame: 110 },
      ],
      frontShoulderOptions,
    );

    const result = compareResults(detection, labels, poseData);

    expect(result.status).toBe("fail");
    expect(result.shots[0]!.startFrame.pass).toBe(true);
    expect(result.shots[1]!.endFrame.pass).toBe(false);
    expect(result.shots[1]!.endFrame.diff).toBe(10);
  });
});

// ============================================================================
// Tests: runAndCompare Integration
// ============================================================================

describe("runAndCompare", () => {
  it("runs detection and comparison in one call", () => {
    // This test just verifies the function works without testing actual detection
    const frames: Frame[] = [];
    for (let i = 0; i < 30; i++) {
      frames.push(createFrameWithWrists(i, 0.5, 0.5));
    }
    const poseData = createPoseData(frames);
    const labels = createLabelData([{ startFrame: 10, endFrame: 20 }], "front");

    // runAndCompare should return a ComparisonResult
    const result = runAndCompare(poseData, labels);

    expect(result).toHaveProperty("video");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("shots");
  });
});

// ============================================================================
// Tests: runDetection
// ============================================================================

describe("runDetection", () => {
  it("returns DetectionResult structure", () => {
    const frames: Frame[] = [];
    for (let i = 0; i < 30; i++) {
      frames.push(createFrameWithWrists(i, 0.5, 0.5));
    }
    const poseData = createPoseData(frames);

    const result = runDetection(poseData);

    expect(result).toHaveProperty("shots");
    expect(result).toHaveProperty("orientation");
    expect(Array.isArray(result.shots)).toBe(true);
  });

  it("returns empty shots array when no shots detected", () => {
    // Static poses - no shot motion
    const frames: Frame[] = [];
    for (let i = 0; i < 30; i++) {
      frames.push(createFrameWithWrists(i, 0.5, 0.5));
    }
    const poseData = createPoseData(frames);

    const result = runDetection(poseData);

    expect(result.shots).toHaveLength(0);
  });
});
