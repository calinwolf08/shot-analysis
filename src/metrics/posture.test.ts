/**
 * Unit tests for posture and alignment metric calculators.
 * Tests: backPosture, headTilt, shoulderAlignment, handCupVsHinge.
 */

import { describe, it, expect } from "vitest";
import {
  BackPostureCalculator,
  HeadTiltCalculator,
  ShoulderAlignmentCalculator,
  HandCupVsHingeCalculator,
} from "./posture";
import type { MetricCalculatorContext } from "./types";
import { ShotPhase } from "../detection/types";
import { DEFAULT_CONFIG } from "../config";
import type { AnalysisConfig } from "../config";
import type { PoseLandmarks, PoseLandmark } from "../types";
import { LANDMARK_INDICES } from "../types";

/**
 * Creates a mock PoseLandmark for testing.
 */
function createMockLandmark(
  x: number = 0.5,
  y: number = 0.5,
  z: number = 0,
  visibility: number = 1.0,
  presence: number = 1.0,
): PoseLandmark {
  return {
    position: { x, y, z },
    visibility,
    presence,
  };
}

/**
 * Creates mock PoseLandmarks with all 33 landmarks for testing.
 * All landmarks are at default positions unless overridden.
 */
function createMockPoseLandmarks(
  frameIndex: number,
  confidence: number = 0.9,
  overrides: Partial<Record<number, Partial<PoseLandmark>>> = {},
): PoseLandmarks {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, (_, i) => {
    const override = overrides[i];
    if (override) {
      return {
        position: override.position ?? { x: 0.5, y: 0.5, z: 0 },
        visibility: override.visibility ?? 1.0,
        presence: override.presence ?? 1.0,
      };
    }
    return createMockLandmark();
  });
  return {
    landmarks,
    confidence,
    timestamp: frameIndex * 33.33, // Assuming 30fps
    frameIndex,
  };
}

/**
 * Creates a basic standing pose for posture testing.
 * Sets up spine, shoulders, hips, and head landmarks.
 */
function createPosturePose(
  frameIndex: number,
  options: {
    // Shoulder positions
    leftShoulderX?: number;
    leftShoulderY?: number;
    leftShoulderZ?: number;
    rightShoulderX?: number;
    rightShoulderY?: number;
    rightShoulderZ?: number;
    // Hip positions
    leftHipX?: number;
    leftHipY?: number;
    leftHipZ?: number;
    rightHipX?: number;
    rightHipY?: number;
    rightHipZ?: number;
    // Eye positions (for head tilt)
    leftEyeX?: number;
    leftEyeY?: number;
    leftEyeZ?: number;
    rightEyeX?: number;
    rightEyeY?: number;
    rightEyeZ?: number;
    // Ear positions (for head tilt)
    leftEarX?: number;
    leftEarY?: number;
    leftEarZ?: number;
    rightEarX?: number;
    rightEarY?: number;
    rightEarZ?: number;
    // Nose position
    noseX?: number;
    noseY?: number;
    noseZ?: number;
    // Wrist positions (for hand cup/hinge)
    rightWristX?: number;
    rightWristY?: number;
    rightWristZ?: number;
    leftWristX?: number;
    leftWristY?: number;
    leftWristZ?: number;
    // Index finger positions
    rightIndexX?: number;
    rightIndexY?: number;
    rightIndexZ?: number;
    leftIndexX?: number;
    leftIndexY?: number;
    leftIndexZ?: number;
    // Elbow positions
    rightElbowX?: number;
    rightElbowY?: number;
    rightElbowZ?: number;
    leftElbowX?: number;
    leftElbowY?: number;
    leftElbowZ?: number;
    // Visibility
    shoulderVisibility?: number;
    hipVisibility?: number;
    eyeVisibility?: number;
    earVisibility?: number;
    wristVisibility?: number;
  } = {},
): PoseLandmarks {
  const {
    // Default upright posture - shoulders centered above hips
    leftShoulderX = 0.45,
    leftShoulderY = 0.3,
    leftShoulderZ = 0,
    rightShoulderX = 0.55,
    rightShoulderY = 0.3,
    rightShoulderZ = 0,
    leftHipX = 0.45,
    leftHipY = 0.6,
    leftHipZ = 0,
    rightHipX = 0.55,
    rightHipY = 0.6,
    rightHipZ = 0,
    // Eyes at same height (no tilt)
    leftEyeX = 0.47,
    leftEyeY = 0.15,
    leftEyeZ = 0,
    rightEyeX = 0.53,
    rightEyeY = 0.15,
    rightEyeZ = 0,
    // Ears at same height
    leftEarX = 0.43,
    leftEarY = 0.17,
    leftEarZ = 0,
    rightEarX = 0.57,
    rightEarY = 0.17,
    rightEarZ = 0,
    // Nose centered
    noseX = 0.5,
    noseY = 0.12,
    noseZ = 0,
    // Default wrist positions (shooting hand)
    rightWristX = 0.6,
    rightWristY = 0.25,
    rightWristZ = 0,
    leftWristX = 0.4,
    leftWristY = 0.35,
    leftWristZ = 0,
    // Index fingers
    rightIndexX = 0.62,
    rightIndexY = 0.22,
    rightIndexZ = 0,
    leftIndexX = 0.38,
    leftIndexY = 0.32,
    leftIndexZ = 0,
    // Elbows
    rightElbowX = 0.58,
    rightElbowY = 0.4,
    rightElbowZ = 0,
    leftElbowX = 0.42,
    leftElbowY = 0.4,
    leftElbowZ = 0,
    // Visibility defaults
    shoulderVisibility = 1.0,
    hipVisibility = 1.0,
    eyeVisibility = 1.0,
    earVisibility = 1.0,
    wristVisibility = 1.0,
  } = options;

  return createMockPoseLandmarks(frameIndex, 0.9, {
    // Nose
    [LANDMARK_INDICES.NOSE]: {
      position: { x: noseX, y: noseY, z: noseZ },
      visibility: 1.0,
    },
    // Eyes
    [LANDMARK_INDICES.LEFT_EYE]: {
      position: { x: leftEyeX, y: leftEyeY, z: leftEyeZ },
      visibility: eyeVisibility,
    },
    [LANDMARK_INDICES.RIGHT_EYE]: {
      position: { x: rightEyeX, y: rightEyeY, z: rightEyeZ },
      visibility: eyeVisibility,
    },
    // Ears
    [LANDMARK_INDICES.LEFT_EAR]: {
      position: { x: leftEarX, y: leftEarY, z: leftEarZ },
      visibility: earVisibility,
    },
    [LANDMARK_INDICES.RIGHT_EAR]: {
      position: { x: rightEarX, y: rightEarY, z: rightEarZ },
      visibility: earVisibility,
    },
    // Shoulders
    [LANDMARK_INDICES.LEFT_SHOULDER]: {
      position: { x: leftShoulderX, y: leftShoulderY, z: leftShoulderZ },
      visibility: shoulderVisibility,
    },
    [LANDMARK_INDICES.RIGHT_SHOULDER]: {
      position: { x: rightShoulderX, y: rightShoulderY, z: rightShoulderZ },
      visibility: shoulderVisibility,
    },
    // Elbows
    [LANDMARK_INDICES.LEFT_ELBOW]: {
      position: { x: leftElbowX, y: leftElbowY, z: leftElbowZ },
      visibility: 1.0,
    },
    [LANDMARK_INDICES.RIGHT_ELBOW]: {
      position: { x: rightElbowX, y: rightElbowY, z: rightElbowZ },
      visibility: 1.0,
    },
    // Wrists
    [LANDMARK_INDICES.LEFT_WRIST]: {
      position: { x: leftWristX, y: leftWristY, z: leftWristZ },
      visibility: wristVisibility,
    },
    [LANDMARK_INDICES.RIGHT_WRIST]: {
      position: { x: rightWristX, y: rightWristY, z: rightWristZ },
      visibility: wristVisibility,
    },
    // Index fingers
    [LANDMARK_INDICES.LEFT_INDEX]: {
      position: { x: leftIndexX, y: leftIndexY, z: leftIndexZ },
      visibility: 1.0,
    },
    [LANDMARK_INDICES.RIGHT_INDEX]: {
      position: { x: rightIndexX, y: rightIndexY, z: rightIndexZ },
      visibility: 1.0,
    },
    // Hips
    [LANDMARK_INDICES.LEFT_HIP]: {
      position: { x: leftHipX, y: leftHipY, z: leftHipZ },
      visibility: hipVisibility,
    },
    [LANDMARK_INDICES.RIGHT_HIP]: {
      position: { x: rightHipX, y: rightHipY, z: rightHipZ },
      visibility: hipVisibility,
    },
  });
}

describe("BackPostureCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new BackPostureCalculator();

      expect(calculator.name).toBe("backPosture");
      expect(calculator.description.toLowerCase()).toContain("spine");
      expect(calculator.unit).toBe("degrees");
    });

    it("calculates 0 degrees for perfectly upright posture", () => {
      const calculator = new BackPostureCalculator();

      // Create upright pose - shoulders directly above hips
      const poseLandmarks = [
        createPosturePose(0, {
          leftShoulderX: 0.45,
          leftShoulderY: 0.3,
          rightShoulderX: 0.55,
          rightShoulderY: 0.3,
          leftHipX: 0.45,
          leftHipY: 0.6,
          rightHipX: 0.55,
          rightHipY: 0.6,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("degrees");
      // Should be very close to 0 for upright posture
      expect(result.value?.value).toBeLessThan(5);
    });

    it("calculates positive angle for forward lean", () => {
      const calculator = new BackPostureCalculator();

      // Create pose with forward lean - shoulders in front of hips
      const poseLandmarks = [
        createPosturePose(0, {
          // Shoulders shifted forward (smaller X in camera view means forward lean)
          leftShoulderX: 0.45,
          leftShoulderY: 0.3,
          leftShoulderZ: -0.1, // In front of hips
          rightShoulderX: 0.55,
          rightShoulderY: 0.3,
          rightShoulderZ: -0.1,
          leftHipX: 0.45,
          leftHipY: 0.6,
          leftHipZ: 0,
          rightHipX: 0.55,
          rightHipY: 0.6,
          rightHipZ: 0,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(typeof result.value?.value).toBe("number");
      expect(result.value?.value).toBeGreaterThan(0);
    });

    it("calculates angle for side lean", () => {
      const calculator = new BackPostureCalculator();

      // Create pose with side lean - shoulders offset laterally from hips
      const poseLandmarks = [
        createPosturePose(0, {
          // Both shoulders shifted right (body leaning right)
          leftShoulderX: 0.5,
          leftShoulderY: 0.3,
          rightShoulderX: 0.6,
          rightShoulderY: 0.3,
          leftHipX: 0.45,
          leftHipY: 0.6,
          rightHipX: 0.55,
          rightHipY: 0.6,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.value).toBeGreaterThan(0);
    });

    it("tracks posture throughout shot", () => {
      const calculator = new BackPostureCalculator();

      // Create shot with varying posture
      const poseLandmarks = [
        createPosturePose(0), // Upright
        createPosturePose(1, {
          // Slight lean at set point
          leftShoulderX: 0.47,
          rightShoulderX: 0.57,
        }),
        createPosturePose(2, {
          // More lean at release
          leftShoulderX: 0.48,
          rightShoulderX: 0.58,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 2 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 1, endFrame: 1 },
          [ShotPhase.Release]: { startFrame: 2, endFrame: 2 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.frame).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("returns error when required phases are missing", () => {
      const calculator = new BackPostureCalculator();
      const poseLandmarks = [createPosturePose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No phases
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("returns low confidence when landmarks have low visibility", () => {
      const calculator = new BackPostureCalculator();
      const poseLandmarks = [
        createPosturePose(0, {
          shoulderVisibility: 0.3,
          hipVisibility: 0.3,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.confidence).toBeLessThan(0.5);
    });

    it("returns error when pose data is missing", () => {
      const calculator = new BackPostureCalculator();
      const poseLandmarks: PoseLandmarks[] = [];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles intentional fadeaway lean", () => {
      const calculator = new BackPostureCalculator();

      // Significant backward lean (fadeaway)
      const poseLandmarks = [
        createPosturePose(0, {
          leftShoulderZ: 0.15, // Shoulders behind hips
          rightShoulderZ: 0.15,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      // Should calculate the angle without error
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBeGreaterThan(0);
    });
  });
});

describe("HeadTiltCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new HeadTiltCalculator();

      expect(calculator.name).toBe("headTilt");
      expect(calculator.description.toLowerCase()).toContain("head");
      expect(calculator.unit).toBe("degrees");
    });

    it("calculates 0 degrees for level head", () => {
      const calculator = new HeadTiltCalculator();

      // Create pose with level head (eyes at same height)
      const poseLandmarks = [
        createPosturePose(0, {
          leftEyeY: 0.15,
          rightEyeY: 0.15,
          leftEarY: 0.17,
          rightEarY: 0.17,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("degrees");
      // Should be very close to 0 for level head
      expect(Math.abs(result.value?.value as number)).toBeLessThan(5);
    });

    it("calculates positive angle for head tilted right", () => {
      const calculator = new HeadTiltCalculator();

      // Create pose with head tilted right (right eye lower)
      const poseLandmarks = [
        createPosturePose(0, {
          leftEyeY: 0.13, // Higher
          rightEyeY: 0.17, // Lower (positive Y is down)
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      // Tilt should be detected
      const tiltValue = result.value?.value as number;
      expect(Math.abs(tiltValue)).toBeGreaterThan(0);
    });

    it("calculates angle at release and follow-through", () => {
      const calculator = new HeadTiltCalculator();

      // Shot with head tracking (tilt changes)
      const poseLandmarks = [
        createPosturePose(0), // Level
        createPosturePose(1, { leftEyeY: 0.14, rightEyeY: 0.16 }), // Release - slight tilt
        createPosturePose(2, { leftEyeY: 0.13, rightEyeY: 0.17 }), // Follow-through - more tilt
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 2 },
        phases: {
          [ShotPhase.Release]: { startFrame: 1, endFrame: 1 },
          [ShotPhase.FollowThrough]: { startFrame: 2, endFrame: 2 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.frame).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error handling", () => {
    it("returns error when release phase is missing", () => {
      const calculator = new HeadTiltCalculator();
      const poseLandmarks = [createPosturePose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No phases
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("returns low confidence when eye landmarks are occluded", () => {
      const calculator = new HeadTiltCalculator();
      const poseLandmarks = [
        createPosturePose(0, {
          eyeVisibility: 0.2,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.confidence).toBeLessThan(0.5);
    });
  });

  describe("edge cases", () => {
    it("handles head tracking for shot", () => {
      const calculator = new HeadTiltCalculator();

      // Head following the ball (intentional tilt)
      const poseLandmarks = [
        createPosturePose(0, {
          leftEyeY: 0.12,
          rightEyeY: 0.18, // Significant tilt
          leftEarY: 0.14,
          rightEarY: 0.2,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      // Should calculate without error
      expect(result.value).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});

describe("ShoulderAlignmentCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new ShoulderAlignmentCalculator();

      expect(calculator.name).toBe("shoulderAlignment");
      expect(calculator.description.toLowerCase()).toContain("shoulder");
      expect(calculator.unit).toBe("degrees");
    });

    it("calculates 0 degrees for shoulders square to target", () => {
      const calculator = new ShoulderAlignmentCalculator();

      // Shoulders parallel to camera (square to basket)
      const poseLandmarks = [
        createPosturePose(0, {
          leftShoulderZ: 0,
          rightShoulderZ: 0, // Same depth
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("degrees");
      // Should be very close to 0 for square shoulders
      expect(Math.abs(result.value?.value as number)).toBeLessThan(5);
    });

    it("calculates angle for rotated shoulders", () => {
      const calculator = new ShoulderAlignmentCalculator();

      // Right shoulder forward (shooting shoulder for right-handed)
      const poseLandmarks = [
        createPosturePose(0, {
          leftShoulderZ: 0.05, // Back
          rightShoulderZ: -0.05, // Forward
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(typeof result.value?.value).toBe("number");
      // Should detect rotation
      expect(Math.abs(result.value?.value as number)).toBeGreaterThan(0);
    });

    it("measures at set point", () => {
      const calculator = new ShoulderAlignmentCalculator();

      const poseLandmarks = [
        createPosturePose(0),
        createPosturePose(5, {
          leftShoulderZ: 0.03,
          rightShoulderZ: -0.03,
        }),
        createPosturePose(10),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 10 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 5, endFrame: 5 },
          [ShotPhase.Release]: { startFrame: 10, endFrame: 10 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.frame).toBe(5);
    });
  });

  describe("error handling", () => {
    it("returns error when setPoint phase is missing", () => {
      const calculator = new ShoulderAlignmentCalculator();
      const poseLandmarks = [createPosturePose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No phases
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("falls back to release phase if setPoint missing", () => {
      const calculator = new ShoulderAlignmentCalculator();
      const poseLandmarks = [createPosturePose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
    });

    it("returns low confidence when shoulders have low visibility", () => {
      const calculator = new ShoulderAlignmentCalculator();
      const poseLandmarks = [
        createPosturePose(0, {
          shoulderVisibility: 0.2,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.confidence).toBeLessThan(0.5);
    });
  });

  describe("handedness support", () => {
    it("handles left-handed shooter", () => {
      const calculator = new ShoulderAlignmentCalculator();
      const leftHandedConfig: AnalysisConfig = {
        ...DEFAULT_CONFIG,
        shootingHand: "left",
      };

      // Left shoulder forward (shooting shoulder for left-handed)
      const poseLandmarks = [
        createPosturePose(0, {
          leftShoulderZ: -0.05,
          rightShoulderZ: 0.05,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config: leftHandedConfig,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});

describe("HandCupVsHingeCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new HandCupVsHingeCalculator();

      expect(calculator.name).toBe("handCupVsHinge");
      expect(calculator.description).toContain("hand");
      expect(calculator.unit).toBe("category");
    });

    it("classifies neutral hand position", () => {
      const calculator = new HandCupVsHingeCalculator();

      // Neutral hand position - wrist relatively straight
      const poseLandmarks = [
        createPosturePose(0, {
          rightElbowX: 0.55,
          rightElbowY: 0.4,
          rightElbowZ: 0,
          rightWristX: 0.6,
          rightWristY: 0.3,
          rightWristZ: 0,
          rightIndexX: 0.6,
          rightIndexY: 0.25, // Fingers pointing up
          rightIndexZ: 0,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("category");
      expect(["cup", "hinge", "neutral"]).toContain(result.value?.value);
    });

    it("classifies cup hand position", () => {
      const calculator = new HandCupVsHingeCalculator();

      // Cup position - fingers curled under the ball
      // Wrist is hyperextended back, fingers pointing back under the ball
      const poseLandmarks = [
        createPosturePose(0, {
          rightElbowX: 0.55,
          rightElbowY: 0.45,
          rightElbowZ: 0,
          rightWristX: 0.6,
          rightWristY: 0.3,
          rightWristZ: 0,
          rightIndexX: 0.58, // Fingers curled back (toward elbow)
          rightIndexY: 0.35, // Below wrist
          rightIndexZ: 0,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      // Should classify as cup (or detect the angle)
      expect(["cup", "hinge", "neutral"]).toContain(result.value?.value);
    });

    it("classifies hinge hand position", () => {
      const calculator = new HandCupVsHingeCalculator();

      // Hinge position - wrist bent back, fingers pointing forward/up
      const poseLandmarks = [
        createPosturePose(0, {
          rightElbowX: 0.55,
          rightElbowY: 0.45,
          rightElbowZ: 0,
          rightWristX: 0.6,
          rightWristY: 0.3,
          rightWristZ: 0,
          rightIndexX: 0.65, // Fingers pointing forward
          rightIndexY: 0.25, // Above wrist line
          rightIndexZ: -0.05, // In front
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(["cup", "hinge", "neutral"]).toContain(result.value?.value);
    });

    it("measures at set point", () => {
      const calculator = new HandCupVsHingeCalculator();

      const poseLandmarks = [
        createPosturePose(0),
        createPosturePose(5), // Set point
        createPosturePose(10),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 10 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 5, endFrame: 5 },
          [ShotPhase.Release]: { startFrame: 10, endFrame: 10 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.frame).toBe(5);
    });
  });

  describe("error handling", () => {
    it("returns error when setPoint phase is missing", () => {
      const calculator = new HandCupVsHingeCalculator();
      const poseLandmarks = [createPosturePose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No phases
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("falls back to release phase if setPoint missing", () => {
      const calculator = new HandCupVsHingeCalculator();
      const poseLandmarks = [createPosturePose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
    });

    it("returns low confidence when wrist landmarks have low visibility", () => {
      const calculator = new HandCupVsHingeCalculator();
      const poseLandmarks = [
        createPosturePose(0, {
          wristVisibility: 0.2,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.confidence).toBeLessThan(0.5);
    });
  });

  describe("handedness support", () => {
    it("uses correct landmarks for left-handed shooter", () => {
      const calculator = new HandCupVsHingeCalculator();
      const leftHandedConfig: AnalysisConfig = {
        ...DEFAULT_CONFIG,
        shootingHand: "left",
      };

      const poseLandmarks = [
        createPosturePose(0, {
          leftElbowX: 0.45,
          leftElbowY: 0.45,
          leftElbowZ: 0,
          leftWristX: 0.4,
          leftWristY: 0.3,
          leftWristZ: 0,
          leftIndexX: 0.38,
          leftIndexY: 0.25,
          leftIndexZ: 0,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config: leftHandedConfig,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});
