/**
 * Unit tests for ShootingArmCalculator class.
 * Tests shooting arm metrics: elbow flare, elbow angle, arm extension, wrist snap, follow-through hold.
 */

import { describe, it, expect } from "vitest";
import {
  ShootingElbowFlareCalculator,
  ShootingElbowAngleCalculator,
  MaxArmExtensionCalculator,
  WristSnapAngleCalculator,
  FollowThroughHoldCalculator,
} from "./shooting-arm";
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
 * Creates a basic shooting pose for a right-handed shooter.
 * Positions shoulder, elbow, and wrist in a typical shooting configuration.
 */
function createShootingPose(
  frameIndex: number,
  options: {
    // Shoulder position
    shoulderX?: number;
    shoulderY?: number;
    shoulderZ?: number;
    // Elbow position
    elbowX?: number;
    elbowY?: number;
    elbowZ?: number;
    // Wrist position
    wristX?: number;
    wristY?: number;
    wristZ?: number;
    // Visibility
    shoulderVisibility?: number;
    elbowVisibility?: number;
    wristVisibility?: number;
    // Hip positions for body plane calculation
    leftHipX?: number;
    leftHipY?: number;
    leftHipZ?: number;
    rightHipX?: number;
    rightHipY?: number;
    rightHipZ?: number;
    // Guide shoulder for body plane
    guideShoulderX?: number;
    guideShoulderY?: number;
    guideShoulderZ?: number;
    // Index finger for wrist angle
    indexX?: number;
    indexY?: number;
    indexZ?: number;
  } = {},
): PoseLandmarks {
  const {
    // Default shooting arm positions for right-handed shooter
    shoulderX = 0.6,
    shoulderY = 0.3,
    shoulderZ = 0,
    elbowX = 0.65,
    elbowY = 0.45,
    elbowZ = 0,
    wristX = 0.7,
    wristY = 0.25,
    wristZ = 0,
    shoulderVisibility = 1.0,
    elbowVisibility = 1.0,
    wristVisibility = 1.0,
    // Hip positions
    leftHipX = 0.45,
    leftHipY = 0.6,
    leftHipZ = 0,
    rightHipX = 0.55,
    rightHipY = 0.6,
    rightHipZ = 0,
    // Guide shoulder (left for right-handed)
    guideShoulderX = 0.4,
    guideShoulderY = 0.3,
    guideShoulderZ = 0,
    // Index finger
    indexX = 0.72,
    indexY = 0.22,
    indexZ = 0,
  } = options;

  return createMockPoseLandmarks(frameIndex, 0.9, {
    // Right shoulder (shooting for right-handed)
    [LANDMARK_INDICES.RIGHT_SHOULDER]: {
      position: { x: shoulderX, y: shoulderY, z: shoulderZ },
      visibility: shoulderVisibility,
    },
    // Right elbow
    [LANDMARK_INDICES.RIGHT_ELBOW]: {
      position: { x: elbowX, y: elbowY, z: elbowZ },
      visibility: elbowVisibility,
    },
    // Right wrist
    [LANDMARK_INDICES.RIGHT_WRIST]: {
      position: { x: wristX, y: wristY, z: wristZ },
      visibility: wristVisibility,
    },
    // Left shoulder (guide)
    [LANDMARK_INDICES.LEFT_SHOULDER]: {
      position: { x: guideShoulderX, y: guideShoulderY, z: guideShoulderZ },
      visibility: 1.0,
    },
    // Hips for body plane
    [LANDMARK_INDICES.LEFT_HIP]: {
      position: { x: leftHipX, y: leftHipY, z: leftHipZ },
      visibility: 1.0,
    },
    [LANDMARK_INDICES.RIGHT_HIP]: {
      position: { x: rightHipX, y: rightHipY, z: rightHipZ },
      visibility: 1.0,
    },
    // Right index finger for wrist angle
    [LANDMARK_INDICES.RIGHT_INDEX]: {
      position: { x: indexX, y: indexY, z: indexZ },
      visibility: 1.0,
    },
  });
}

describe("ShootingElbowFlareCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new ShootingElbowFlareCalculator();

      expect(calculator.name).toBe("shootingElbowFlare");
      expect(calculator.description).toContain("elbow");
      expect(calculator.unit).toBe("degrees");
    });

    it("calculates elbow flare angle at release point", () => {
      const calculator = new ShootingElbowFlareCalculator();

      // Create a pose where elbow is slightly flared out from body
      const poseLandmarks = [
        createShootingPose(0),
        createShootingPose(1),
        createShootingPose(2, {
          // Elbow positioned to show some flare
          elbowX: 0.68,
          elbowY: 0.45,
          elbowZ: 0.1, // Elbow pushed forward/out
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
      expect(result.value?.unit).toBe("degrees");
      expect(typeof result.value?.value).toBe("number");
      expect(result.value?.confidence).toBeGreaterThan(0);
    });

    it("returns metric with frame at release point", () => {
      const calculator = new ShootingElbowFlareCalculator();
      const poseLandmarks = [
        createShootingPose(10),
        createShootingPose(11),
        createShootingPose(12),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 10, end: 12 },
        phases: {
          [ShotPhase.Release]: { startFrame: 12, endFrame: 12 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value?.frame).toBe(12);
    });
  });

  describe("error handling", () => {
    it("returns error when release phase is missing", () => {
      const calculator = new ShootingElbowFlareCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No release phase
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
      expect(result.error).toContain("phase");
    });

    it("returns low confidence when elbow is occluded", () => {
      const calculator = new ShootingElbowFlareCalculator();
      const poseLandmarks = [
        createShootingPose(0, { elbowVisibility: 0.2 }), // Low visibility
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

      // Should return value with low confidence
      expect(result.value).toBeDefined();
      expect(result.value?.confidence).toBeLessThan(0.5);
    });

    it("returns error when pose data is missing for release frame", () => {
      const calculator = new ShootingElbowFlareCalculator();
      const poseLandmarks: PoseLandmarks[] = [];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 10 },
        phases: {
          [ShotPhase.Release]: { startFrame: 5, endFrame: 5 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });
  });

  describe("handedness support", () => {
    it("uses correct landmarks for left-handed shooter", () => {
      const calculator = new ShootingElbowFlareCalculator();
      const leftHandedConfig: AnalysisConfig = {
        ...DEFAULT_CONFIG,
        shootingHand: "left",
      };

      // Create pose with left-side landmarks positioned for shooting
      const poseLandmarks = [
        createMockPoseLandmarks(0, 0.9, {
          // Left shoulder (shooting for left-handed)
          [LANDMARK_INDICES.LEFT_SHOULDER]: {
            position: { x: 0.4, y: 0.3, z: 0 },
            visibility: 1.0,
          },
          // Left elbow
          [LANDMARK_INDICES.LEFT_ELBOW]: {
            position: { x: 0.35, y: 0.45, z: 0 },
            visibility: 1.0,
          },
          // Left wrist
          [LANDMARK_INDICES.LEFT_WRIST]: {
            position: { x: 0.3, y: 0.25, z: 0 },
            visibility: 1.0,
          },
          // Right shoulder (guide)
          [LANDMARK_INDICES.RIGHT_SHOULDER]: {
            position: { x: 0.6, y: 0.3, z: 0 },
            visibility: 1.0,
          },
          // Hips
          [LANDMARK_INDICES.LEFT_HIP]: {
            position: { x: 0.45, y: 0.6, z: 0 },
            visibility: 1.0,
          },
          [LANDMARK_INDICES.RIGHT_HIP]: {
            position: { x: 0.55, y: 0.6, z: 0 },
            visibility: 1.0,
          },
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config: leftHandedConfig,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});

describe("ShootingElbowAngleCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new ShootingElbowAngleCalculator();

      expect(calculator.name).toBe("shootingElbowAngle");
      expect(calculator.description).toContain("elbow");
      expect(calculator.unit).toBe("degrees");
    });

    it("calculates elbow angle at set point", () => {
      const calculator = new ShootingElbowAngleCalculator();

      // Create a pose with approximately 90-degree elbow angle
      // Shoulder at (0.6, 0.3), Elbow at (0.6, 0.45), Wrist at (0.6, 0.25)
      // This would create roughly straight arm, so let's bend it
      const poseLandmarks = [
        createShootingPose(0, {
          shoulderX: 0.6,
          shoulderY: 0.3,
          elbowX: 0.65,
          elbowY: 0.45,
          wristX: 0.7,
          wristY: 0.3, // Wrist raised to create bend
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
      expect(typeof result.value?.value).toBe("number");
      // Elbow angle should be between 0 and 180
      expect(result.value?.value).toBeGreaterThanOrEqual(0);
      expect(result.value?.value).toBeLessThanOrEqual(180);
    });

    it("calculates approximately 90-degree angle for bent elbow", () => {
      const calculator = new ShootingElbowAngleCalculator();

      // Create a clear 90-degree angle:
      // Shoulder straight up from elbow, wrist straight right from elbow
      const poseLandmarks = [
        createShootingPose(0, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          shoulderZ: 0,
          elbowX: 0.5,
          elbowY: 0.5,
          elbowZ: 0,
          wristX: 0.7,
          wristY: 0.5,
          wristZ: 0,
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
      // Should be approximately 90 degrees
      expect(result.value?.value).toBeCloseTo(90, 0);
    });

    it("calculates approximately 180-degree angle for straight arm", () => {
      const calculator = new ShootingElbowAngleCalculator();

      // Create a straight arm: shoulder, elbow, wrist in a line
      const poseLandmarks = [
        createShootingPose(0, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          shoulderZ: 0,
          elbowX: 0.5,
          elbowY: 0.4,
          elbowZ: 0,
          wristX: 0.5,
          wristY: 0.5,
          wristZ: 0,
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
      // Should be approximately 180 degrees (straight arm)
      expect(result.value?.value).toBeCloseTo(180, 0);
    });
  });

  describe("error handling", () => {
    it("returns error when setPoint phase is missing", () => {
      const calculator = new ShootingElbowAngleCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No set point phase
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("falls back to release phase if setPoint is missing", () => {
      const calculator = new ShootingElbowAngleCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      // Should succeed using release phase as fallback
      expect(result.value).toBeDefined();
    });
  });

  describe("quick release handling", () => {
    it("handles very quick release with minimal angle change", () => {
      const calculator = new ShootingElbowAngleCalculator();

      // Quick release: minimal frames, similar poses
      const poseLandmarks = [
        createShootingPose(0, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.55,
          elbowY: 0.4,
          wristX: 0.6,
          wristY: 0.32,
        }),
        createShootingPose(1, {
          // Almost same position
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.55,
          elbowY: 0.4,
          wristX: 0.61,
          wristY: 0.31,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 1 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
          [ShotPhase.Release]: { startFrame: 1, endFrame: 1 },
        },
        config,
      };

      const result = calculator.calculate(context);

      // Should still return a valid result
      expect(result.value).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });
});

describe("MaxArmExtensionCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new MaxArmExtensionCalculator();

      expect(calculator.name).toBe("maxArmExtension");
      expect(calculator.description).toContain("extension");
      expect(calculator.unit).toBe("degrees");
    });

    it("finds maximum elbow extension during follow-through", () => {
      const calculator = new MaxArmExtensionCalculator();

      // Create poses showing increasing arm extension
      const poseLandmarks = [
        // Start with bent arm (lower angle)
        createShootingPose(0, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.55,
          elbowY: 0.4,
          wristX: 0.6,
          wristY: 0.35,
        }),
        // More extended
        createShootingPose(1, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.55,
          elbowY: 0.4,
          wristX: 0.6,
          wristY: 0.45,
        }),
        // Most extended (straight arm)
        createShootingPose(2, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.5,
          elbowY: 0.4,
          wristX: 0.5,
          wristY: 0.5,
        }),
        // Slightly less extended
        createShootingPose(3, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.52,
          elbowY: 0.4,
          wristX: 0.55,
          wristY: 0.48,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 3 },
        phases: {
          [ShotPhase.FollowThrough]: { startFrame: 1, endFrame: 3 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("degrees");
      // Maximum extension should be around 180 (frame 2)
      expect(result.value?.value).toBeCloseTo(180, 0);
      // Frame should be where max occurred
      expect(result.value?.frame).toBe(2);
    });
  });

  describe("error handling", () => {
    it("returns error when follow-through phase is missing", () => {
      const calculator = new MaxArmExtensionCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {}, // No follow-through phase
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("returns low confidence when landmarks have low visibility", () => {
      const calculator = new MaxArmExtensionCalculator();
      const poseLandmarks = [
        createShootingPose(0, {
          shoulderVisibility: 0.3,
          wristVisibility: 0.3,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.FollowThrough]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.confidence).toBeLessThan(0.5);
    });
  });
});

describe("WristSnapAngleCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new WristSnapAngleCalculator();

      expect(calculator.name).toBe("wristSnapAngle");
      expect(calculator.description.toLowerCase()).toContain("wrist");
      expect(calculator.unit).toBe("degrees");
    });

    it("calculates wrist flexion change from set to release", () => {
      const calculator = new WristSnapAngleCalculator();

      // At set point: wrist is extended back (fingers pointing up)
      // At release: wrist has snapped forward (fingers pointing forward/down)
      const poseLandmarks = [
        // Set point - wrist extended
        createShootingPose(0, {
          elbowX: 0.5,
          elbowY: 0.45,
          wristX: 0.55,
          wristY: 0.35,
          indexX: 0.55,
          indexY: 0.25, // Finger pointing up
        }),
        // Release - wrist snapped forward
        createShootingPose(1, {
          elbowX: 0.5,
          elbowY: 0.45,
          wristX: 0.55,
          wristY: 0.35,
          indexX: 0.65,
          indexY: 0.35, // Finger pointing forward
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 1 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
          [ShotPhase.Release]: { startFrame: 1, endFrame: 1 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("degrees");
      expect(typeof result.value?.value).toBe("number");
      // Should show some wrist snap (change in angle)
      expect(result.value?.value).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("returns error when both setPoint and release phases are missing", () => {
      const calculator = new WristSnapAngleCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {},
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("returns error when release phase is missing", () => {
      const calculator = new WristSnapAngleCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });
  });
});

describe("FollowThroughHoldCalculator", () => {
  const config: AnalysisConfig = { ...DEFAULT_CONFIG, shootingHand: "right" };

  describe("basic functionality", () => {
    it("has correct name, description, and unit", () => {
      const calculator = new FollowThroughHoldCalculator();

      expect(calculator.name).toBe("followThroughHold");
      expect(calculator.description).toContain("follow");
      expect(calculator.unit).toBe("percent");
    });

    it("calculates duration arm stays extended as percentage", () => {
      const calculator = new FollowThroughHoldCalculator();

      // Create 10 frames total, with follow-through from frame 5-9
      // All follow-through frames have extended arm
      const poseLandmarks = Array.from({ length: 10 }, (_, i) => {
        if (i >= 5) {
          // Extended arm during follow-through
          return createShootingPose(i, {
            shoulderX: 0.5,
            shoulderY: 0.3,
            elbowX: 0.5,
            elbowY: 0.4,
            wristX: 0.5,
            wristY: 0.5, // Straight arm
          });
        }
        return createShootingPose(i);
      });

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 9 },
        phases: {
          [ShotPhase.FollowThrough]: { startFrame: 5, endFrame: 9 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      expect(result.value?.unit).toBe("percent");
      // Follow-through is 5 frames out of 10 = 50%
      expect(result.value?.value).toBeCloseTo(50, 0);
    });

    it("returns 0 when follow-through not held", () => {
      const calculator = new FollowThroughHoldCalculator();

      // Arm immediately drops after release (not extended)
      const poseLandmarks = Array.from({ length: 5 }, (_, i) =>
        createShootingPose(i, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.55,
          elbowY: 0.4 + i * 0.05, // Elbow dropping
          wristX: 0.6,
          wristY: 0.3 + i * 0.1, // Wrist dropping
        }),
      );

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 4 },
        phases: {
          [ShotPhase.FollowThrough]: { startFrame: 2, endFrame: 4 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      // Very little or no hold time
      expect(result.value?.value).toBeLessThanOrEqual(50);
    });
  });

  describe("error handling", () => {
    it("returns error when follow-through phase is missing", () => {
      const calculator = new FollowThroughHoldCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {},
        config,
      };

      const result = calculator.calculate(context);

      expect(result.error).toBeDefined();
    });

    it("handles case when follow-through duration is 0", () => {
      const calculator = new FollowThroughHoldCalculator();
      const poseLandmarks = [createShootingPose(0)];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          // Single frame follow-through
          [ShotPhase.FollowThrough]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      // Should handle gracefully
      expect(result.value).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles very short shot duration", () => {
      const calculator = new FollowThroughHoldCalculator();
      const poseLandmarks = [
        createShootingPose(0, {
          shoulderX: 0.5,
          shoulderY: 0.3,
          elbowX: 0.5,
          elbowY: 0.4,
          wristX: 0.5,
          wristY: 0.5,
        }),
      ];

      const context: MetricCalculatorContext = {
        poseLandmarks,
        frameRange: { start: 0, end: 0 },
        phases: {
          [ShotPhase.FollowThrough]: { startFrame: 0, endFrame: 0 },
        },
        config,
      };

      const result = calculator.calculate(context);

      expect(result.value).toBeDefined();
      // 1 frame out of 1 frame = 100%
      expect(result.value?.value).toBe(100);
    });
  });
});
