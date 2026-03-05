/**
 * Unit tests for LowerBodyCalculator class.
 * Tests lower body metrics: hipDrop, kneeFlexion, legExtensionStart.
 */
import { describe, it, expect } from "vitest";
import { HipDropCalculator, KneeFlexionCalculator, LegExtensionStartCalculator, } from "./lower-body";
import { ShotPhase } from "../detection/types";
import { DEFAULT_CONFIG } from "../config";
import { LANDMARK_INDICES } from "../types";
/**
 * Creates a mock PoseLandmark for testing.
 */
function createMockLandmark(x = 0.5, y = 0.5, z = 0, visibility = 1.0, presence = 1.0) {
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
function createMockPoseLandmarks(frameIndex, confidence = 0.9, overrides = {}) {
    const landmarks = Array.from({ length: 33 }, (_, i) => {
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
 * Creates a standing pose for testing lower body metrics.
 * Positions shoulders, hips, knees, and ankles in typical standing configuration.
 */
function createLowerBodyPose(frameIndex, options = {}) {
    const { 
    // Shoulder defaults (for width normalization)
    leftShoulderY = 0.3, rightShoulderY = 0.3, shoulderWidth = 0.2, // 0.4 to 0.6 x positions
    // Default standing hip positions
    leftHipX = 0.45, leftHipY = 0.5, leftHipZ = 0, rightHipX = 0.55, rightHipY = 0.5, rightHipZ = 0, hipVisibility = 1.0, 
    // Default standing knee positions
    leftKneeX = 0.45, leftKneeY = 0.65, leftKneeZ = 0, rightKneeX = 0.55, rightKneeY = 0.65, rightKneeZ = 0, kneeVisibility = 1.0, 
    // Default standing ankle positions
    leftAnkleX = 0.45, leftAnkleY = 0.8, leftAnkleZ = 0, rightAnkleX = 0.55, rightAnkleY = 0.8, rightAnkleZ = 0, ankleVisibility = 1.0, } = options;
    const shoulderHalfWidth = shoulderWidth / 2;
    return createMockPoseLandmarks(frameIndex, 0.9, {
        // Left shoulder
        [LANDMARK_INDICES.LEFT_SHOULDER]: {
            position: { x: 0.5 - shoulderHalfWidth, y: leftShoulderY, z: 0 },
            visibility: 1.0,
        },
        // Right shoulder
        [LANDMARK_INDICES.RIGHT_SHOULDER]: {
            position: { x: 0.5 + shoulderHalfWidth, y: rightShoulderY, z: 0 },
            visibility: 1.0,
        },
        // Left hip
        [LANDMARK_INDICES.LEFT_HIP]: {
            position: { x: leftHipX, y: leftHipY, z: leftHipZ },
            visibility: hipVisibility,
        },
        // Right hip
        [LANDMARK_INDICES.RIGHT_HIP]: {
            position: { x: rightHipX, y: rightHipY, z: rightHipZ },
            visibility: hipVisibility,
        },
        // Left knee
        [LANDMARK_INDICES.LEFT_KNEE]: {
            position: { x: leftKneeX, y: leftKneeY, z: leftKneeZ },
            visibility: kneeVisibility,
        },
        // Right knee
        [LANDMARK_INDICES.RIGHT_KNEE]: {
            position: { x: rightKneeX, y: rightKneeY, z: rightKneeZ },
            visibility: kneeVisibility,
        },
        // Left ankle
        [LANDMARK_INDICES.LEFT_ANKLE]: {
            position: { x: leftAnkleX, y: leftAnkleY, z: leftAnkleZ },
            visibility: ankleVisibility,
        },
        // Right ankle
        [LANDMARK_INDICES.RIGHT_ANKLE]: {
            position: { x: rightAnkleX, y: rightAnkleY, z: rightAnkleZ },
            visibility: ankleVisibility,
        },
    });
}
describe("HipDropCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new HipDropCalculator();
            expect(calculator.name).toBe("hipDrop");
            expect(calculator.description).toContain("hip");
            expect(calculator.unit).toBe("ratio");
        });
        it("calculates hip drop normalized to shoulder width", () => {
            const calculator = new HipDropCalculator();
            // Standing pose at frame 0 - hips at Y=0.5
            // Load pose at frame 1 - hips drop to Y=0.6 (down by 0.1)
            // Shoulder width = 0.2, so hip drop ratio = 0.1 / 0.2 = 0.5
            const poseLandmarks = [
                createLowerBodyPose(0, {
                    leftHipY: 0.5,
                    rightHipY: 0.5,
                    shoulderWidth: 0.2,
                }),
                createLowerBodyPose(1, {
                    leftHipY: 0.6, // Hips dropped down (higher Y = lower position)
                    rightHipY: 0.6,
                    shoulderWidth: 0.2,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 1 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 1, endFrame: 1 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.unit).toBe("ratio");
            expect(typeof result.value?.value).toBe("number");
            // Hip drop should be positive and normalized
            expect(result.value?.value).toBeGreaterThan(0);
            expect(result.value?.confidence).toBeGreaterThan(0);
        });
        it("returns zero hip drop for stationary set shot", () => {
            const calculator = new HipDropCalculator();
            // Hips stay at same level throughout shot (no dip)
            const poseLandmarks = [
                createLowerBodyPose(0, { leftHipY: 0.5, rightHipY: 0.5 }),
                createLowerBodyPose(1, { leftHipY: 0.5, rightHipY: 0.5 }),
                createLowerBodyPose(2, { leftHipY: 0.5, rightHipY: 0.5 }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 2 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 1, endFrame: 1 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Minimal or zero hip drop
            expect(result.value?.value).toBeLessThanOrEqual(0.1);
        });
        it("calculates significant hip drop for jump shot", () => {
            const calculator = new HipDropCalculator();
            // Initial stance at Y=0.5, significant dip to Y=0.65 (drop of 0.15)
            // With shoulder width 0.2, ratio = 0.15 / 0.2 = 0.75
            const poseLandmarks = [
                createLowerBodyPose(0, {
                    leftHipY: 0.5,
                    rightHipY: 0.5,
                    shoulderWidth: 0.2,
                }),
                createLowerBodyPose(1, {
                    leftHipY: 0.65,
                    rightHipY: 0.65,
                    shoulderWidth: 0.2,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 1 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 1, endFrame: 1 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Significant hip drop
            expect(result.value?.value).toBeGreaterThan(0.5);
        });
        it("returns metric with frame at load phase", () => {
            const calculator = new HipDropCalculator();
            const poseLandmarks = [
                createLowerBodyPose(5, { leftHipY: 0.5, rightHipY: 0.5 }),
                createLowerBodyPose(6, { leftHipY: 0.55, rightHipY: 0.55 }),
                createLowerBodyPose(7, { leftHipY: 0.6, rightHipY: 0.6 }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 5, end: 7 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 7, endFrame: 7 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value?.frame).toBe(7);
        });
    });
    describe("error handling", () => {
        it("returns error when load phase is missing", () => {
            const calculator = new HipDropCalculator();
            const poseLandmarks = [createLowerBodyPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {}, // No load phase
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
            expect(result.error).toContain("phase");
        });
        it("returns low confidence when hips are occluded", () => {
            const calculator = new HipDropCalculator();
            const poseLandmarks = [
                createLowerBodyPose(0, { hipVisibility: 0.3 }),
                createLowerBodyPose(1, { hipVisibility: 0.3, leftHipY: 0.6, rightHipY: 0.6 }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 1 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 1, endFrame: 1 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.confidence).toBeLessThanOrEqual(0.3);
        });
        it("returns error when pose data is missing", () => {
            const calculator = new HipDropCalculator();
            const poseLandmarks = [];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 10 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 5, endFrame: 5 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
    });
});
describe("KneeFlexionCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new KneeFlexionCalculator();
            expect(calculator.name).toBe("kneeFlexion");
            expect(calculator.description).toContain("knee");
            expect(calculator.unit).toBe("degrees");
        });
        it("calculates knee angle at load phase", () => {
            const calculator = new KneeFlexionCalculator();
            // Create pose with bent knee (90 degree angle)
            // Hip at (0.5, 0.5), Knee at (0.5, 0.65), Ankle at (0.35, 0.65)
            // This creates a 90-degree angle at the knee
            const poseLandmarks = [
                createLowerBodyPose(0, {
                    leftHipX: 0.5,
                    leftHipY: 0.5,
                    leftKneeX: 0.5,
                    leftKneeY: 0.65,
                    leftAnkleX: 0.35,
                    leftAnkleY: 0.65,
                    rightHipX: 0.6,
                    rightHipY: 0.5,
                    rightKneeX: 0.6,
                    rightKneeY: 0.65,
                    rightAnkleX: 0.45,
                    rightAnkleY: 0.65,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.unit).toBe("degrees");
            expect(typeof result.value?.value).toBe("number");
            // Knee angle should be between 0 and 180
            expect(result.value?.value).toBeGreaterThanOrEqual(0);
            expect(result.value?.value).toBeLessThanOrEqual(180);
        });
        it("calculates approximately 180 degrees for straight leg", () => {
            const calculator = new KneeFlexionCalculator();
            // Straight leg: hip, knee, ankle in a vertical line
            const poseLandmarks = [
                createLowerBodyPose(0, {
                    leftHipX: 0.45,
                    leftHipY: 0.5,
                    leftKneeX: 0.45,
                    leftKneeY: 0.65,
                    leftAnkleX: 0.45,
                    leftAnkleY: 0.8,
                    rightHipX: 0.55,
                    rightHipY: 0.5,
                    rightKneeX: 0.55,
                    rightKneeY: 0.65,
                    rightAnkleX: 0.55,
                    rightAnkleY: 0.8,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Should be approximately 180 degrees (straight leg)
            expect(result.value?.value).toBeCloseTo(180, 0);
        });
        it("calculates minimum knee angle during load phase", () => {
            const calculator = new KneeFlexionCalculator();
            // Multiple frames in load phase, find minimum angle (maximum bend)
            const poseLandmarks = [
                // Frame 0: fairly straight legs
                createLowerBodyPose(0, {
                    leftHipY: 0.5,
                    leftKneeY: 0.65,
                    leftAnkleY: 0.8,
                    rightHipY: 0.5,
                    rightKneeY: 0.65,
                    rightAnkleY: 0.8,
                }),
                // Frame 1: more bent (maximum flex point)
                createLowerBodyPose(1, {
                    leftHipY: 0.55,
                    leftKneeX: 0.45,
                    leftKneeY: 0.72,
                    leftAnkleX: 0.35, // Ankle forward
                    leftAnkleY: 0.8,
                    rightHipY: 0.55,
                    rightKneeX: 0.55,
                    rightKneeY: 0.72,
                    rightAnkleX: 0.45,
                    rightAnkleY: 0.8,
                }),
                // Frame 2: starting to extend
                createLowerBodyPose(2, {
                    leftHipY: 0.52,
                    leftKneeY: 0.68,
                    leftAnkleY: 0.8,
                    rightHipY: 0.52,
                    rightKneeY: 0.68,
                    rightAnkleY: 0.8,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 2 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 2 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Should find the minimum angle (frame 1)
            expect(result.value?.frame).toBe(1);
        });
    });
    describe("error handling", () => {
        it("returns error when load phase is missing", () => {
            const calculator = new KneeFlexionCalculator();
            const poseLandmarks = [createLowerBodyPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {}, // No load phase
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
        it("returns low confidence when knees are occluded", () => {
            const calculator = new KneeFlexionCalculator();
            const poseLandmarks = [
                createLowerBodyPose(0, {
                    kneeVisibility: 0.2,
                    ankleVisibility: 0.2,
                    hipVisibility: 0.2,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.confidence).toBeLessThanOrEqual(0.2);
        });
    });
});
describe("LegExtensionStartCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new LegExtensionStartCalculator();
            expect(calculator.name).toBe("legExtensionStart");
            expect(calculator.description).toContain("extending");
            expect(calculator.unit).toBe("percent");
        });
        it("calculates when leg extension starts as percentage", () => {
            const calculator = new LegExtensionStartCalculator();
            // Create a sequence: bent -> more bent -> starts extending
            // Total 10 frames, extension starts at frame 5 (50%)
            const poseLandmarks = Array.from({ length: 10 }, (_, i) => {
                if (i < 3) {
                    // Frames 0-2: legs bending
                    return createLowerBodyPose(i, {
                        leftHipY: 0.5 + i * 0.03,
                        leftKneeY: 0.65 + i * 0.02,
                        leftAnkleX: 0.42 + i * 0.02,
                        rightHipY: 0.5 + i * 0.03,
                        rightKneeY: 0.65 + i * 0.02,
                        rightAnkleX: 0.52 + i * 0.02,
                    });
                }
                else if (i < 5) {
                    // Frames 3-4: maximum bend (stable)
                    return createLowerBodyPose(i, {
                        leftHipY: 0.59,
                        leftKneeX: 0.42,
                        leftKneeY: 0.71,
                        leftAnkleX: 0.32,
                        rightHipY: 0.59,
                        rightKneeX: 0.58,
                        rightKneeY: 0.71,
                        rightAnkleX: 0.68,
                    });
                }
                else {
                    // Frames 5-9: extending (ankle moves back under knee)
                    const extensionProgress = i - 5;
                    return createLowerBodyPose(i, {
                        leftHipY: 0.59 - extensionProgress * 0.03,
                        leftKneeY: 0.71 - extensionProgress * 0.02,
                        leftAnkleX: 0.32 + extensionProgress * 0.03,
                        rightHipY: 0.59 - extensionProgress * 0.03,
                        rightKneeY: 0.71 - extensionProgress * 0.02,
                        rightAnkleX: 0.68 - extensionProgress * 0.03,
                    });
                }
            });
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 9 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 4 },
                    [ShotPhase.Rise]: { startFrame: 5, endFrame: 9 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.unit).toBe("percent");
            expect(typeof result.value?.value).toBe("number");
            // Should be around 50% (frame 5 of 10)
            expect(result.value?.value).toBeGreaterThan(30);
            expect(result.value?.value).toBeLessThan(70);
        });
        it("detects extension when knee angle starts increasing", () => {
            const calculator = new LegExtensionStartCalculator();
            // 5 frames: angle decreasing then increasing
            // Frame 0: 170 degrees
            // Frame 1: 150 degrees (bending)
            // Frame 2: 130 degrees (max bend)
            // Frame 3: 145 degrees (extending - detected)
            // Frame 4: 160 degrees (more extended)
            const poseLandmarks = [
                // Frame 0: nearly straight
                createLowerBodyPose(0, {
                    leftHipX: 0.45,
                    leftHipY: 0.5,
                    leftKneeX: 0.45,
                    leftKneeY: 0.65,
                    leftAnkleX: 0.45,
                    leftAnkleY: 0.8,
                    rightHipX: 0.55,
                    rightHipY: 0.5,
                    rightKneeX: 0.55,
                    rightKneeY: 0.65,
                    rightAnkleX: 0.55,
                    rightAnkleY: 0.8,
                }),
                // Frame 1: bending
                createLowerBodyPose(1, {
                    leftHipX: 0.45,
                    leftHipY: 0.53,
                    leftKneeX: 0.43,
                    leftKneeY: 0.68,
                    leftAnkleX: 0.38,
                    leftAnkleY: 0.8,
                    rightHipX: 0.55,
                    rightHipY: 0.53,
                    rightKneeX: 0.57,
                    rightKneeY: 0.68,
                    rightAnkleX: 0.62,
                    rightAnkleY: 0.8,
                }),
                // Frame 2: max bend
                createLowerBodyPose(2, {
                    leftHipX: 0.45,
                    leftHipY: 0.56,
                    leftKneeX: 0.40,
                    leftKneeY: 0.71,
                    leftAnkleX: 0.32,
                    leftAnkleY: 0.8,
                    rightHipX: 0.55,
                    rightHipY: 0.56,
                    rightKneeX: 0.60,
                    rightKneeY: 0.71,
                    rightAnkleX: 0.68,
                    rightAnkleY: 0.8,
                }),
                // Frame 3: start extending
                createLowerBodyPose(3, {
                    leftHipX: 0.45,
                    leftHipY: 0.54,
                    leftKneeX: 0.42,
                    leftKneeY: 0.69,
                    leftAnkleX: 0.36,
                    leftAnkleY: 0.8,
                    rightHipX: 0.55,
                    rightHipY: 0.54,
                    rightKneeX: 0.58,
                    rightKneeY: 0.69,
                    rightAnkleX: 0.64,
                    rightAnkleY: 0.8,
                }),
                // Frame 4: more extended
                createLowerBodyPose(4, {
                    leftHipX: 0.45,
                    leftHipY: 0.52,
                    leftKneeX: 0.44,
                    leftKneeY: 0.67,
                    leftAnkleX: 0.42,
                    leftAnkleY: 0.8,
                    rightHipX: 0.55,
                    rightHipY: 0.52,
                    rightKneeX: 0.56,
                    rightKneeY: 0.67,
                    rightAnkleX: 0.58,
                    rightAnkleY: 0.8,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 4 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 2 },
                    [ShotPhase.Rise]: { startFrame: 3, endFrame: 4 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Frame 3 out of 5 total = 60%
            expect(result.value?.value).toBeCloseTo(60, 0);
            expect(result.value?.frame).toBe(3);
        });
    });
    describe("error handling", () => {
        it("returns error when no rise or release phase is detected", () => {
            const calculator = new LegExtensionStartCalculator();
            const poseLandmarks = [createLowerBodyPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
        it("returns low confidence when legs are occluded", () => {
            const calculator = new LegExtensionStartCalculator();
            const poseLandmarks = [
                createLowerBodyPose(0, {
                    kneeVisibility: 0.2,
                    ankleVisibility: 0.2,
                    hipVisibility: 0.2,
                }),
                createLowerBodyPose(1, {
                    kneeVisibility: 0.2,
                    ankleVisibility: 0.2,
                    hipVisibility: 0.2,
                    leftKneeY: 0.68,
                    rightKneeY: 0.68,
                }),
                createLowerBodyPose(2, {
                    kneeVisibility: 0.2,
                    ankleVisibility: 0.2,
                    hipVisibility: 0.2,
                    leftKneeY: 0.64, // Extending - angle increases
                    rightKneeY: 0.64,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 2 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 1 },
                    [ShotPhase.Rise]: { startFrame: 2, endFrame: 2 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.confidence).toBeLessThanOrEqual(0.2);
        });
    });
    describe("edge cases", () => {
        it("handles shot with no leg extension", () => {
            const calculator = new LegExtensionStartCalculator();
            // All frames have same leg angle (stationary shot)
            const poseLandmarks = Array.from({ length: 5 }, (_, i) => createLowerBodyPose(i, {
                leftHipY: 0.5,
                leftKneeY: 0.65,
                leftAnkleY: 0.8,
                rightHipY: 0.5,
                rightKneeY: 0.65,
                rightAnkleY: 0.8,
            }));
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 4 },
                phases: {
                    [ShotPhase.Load]: { startFrame: 0, endFrame: 2 },
                    [ShotPhase.Rise]: { startFrame: 3, endFrame: 4 },
                },
                config,
            };
            const result = calculator.calculate(context);
            // Should handle gracefully - might return 100% (no extension found) or first rise frame
            expect(result.value).toBeDefined();
        });
    });
});
//# sourceMappingURL=lower-body.test.js.map