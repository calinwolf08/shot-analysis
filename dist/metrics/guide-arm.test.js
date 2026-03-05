/**
 * Unit tests for GuideArmCalculator class.
 * Tests guide arm metrics: elbow flare, hand position, hand release timing.
 */
import { describe, it, expect } from "vitest";
import { GuideElbowFlareCalculator, GuideHandPositionCalculator, GuideHandReleaseCalculator, } from "./guide-arm";
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
 * Creates a basic shooting pose for a right-handed shooter with guide arm details.
 * Positions both shooting and guide arm landmarks in a typical configuration.
 */
function createGuideArmPose(frameIndex, options = {}) {
    const { 
    // Guide arm defaults (left side for right-handed shooter)
    guideShoulderX = 0.4, guideShoulderY = 0.3, guideShoulderZ = 0, guideElbowX = 0.38, guideElbowY = 0.42, guideElbowZ = 0, guideWristX = 0.45, guideWristY = 0.32, guideWristZ = 0, guideIndexX = 0.5, guideIndexY = 0.28, guideIndexZ = 0, 
    // Shooting arm defaults (right side)
    shootingShoulderX = 0.6, shootingShoulderY = 0.3, shootingShoulderZ = 0, shootingWristX = 0.55, shootingWristY = 0.28, shootingWristZ = 0, shootingIndexX = 0.55, shootingIndexY = 0.24, shootingIndexZ = 0, 
    // Hip positions
    leftHipX = 0.45, leftHipY = 0.6, leftHipZ = 0, rightHipX = 0.55, rightHipY = 0.6, rightHipZ = 0, 
    // Visibility
    guideShoulderVisibility = 1.0, guideElbowVisibility = 1.0, guideWristVisibility = 1.0, guideIndexVisibility = 1.0, shootingIndexVisibility = 1.0, } = options;
    return createMockPoseLandmarks(frameIndex, 0.9, {
        // Left shoulder (guide for right-handed)
        [LANDMARK_INDICES.LEFT_SHOULDER]: {
            position: { x: guideShoulderX, y: guideShoulderY, z: guideShoulderZ },
            visibility: guideShoulderVisibility,
        },
        // Left elbow
        [LANDMARK_INDICES.LEFT_ELBOW]: {
            position: { x: guideElbowX, y: guideElbowY, z: guideElbowZ },
            visibility: guideElbowVisibility,
        },
        // Left wrist
        [LANDMARK_INDICES.LEFT_WRIST]: {
            position: { x: guideWristX, y: guideWristY, z: guideWristZ },
            visibility: guideWristVisibility,
        },
        // Left index finger
        [LANDMARK_INDICES.LEFT_INDEX]: {
            position: { x: guideIndexX, y: guideIndexY, z: guideIndexZ },
            visibility: guideIndexVisibility,
        },
        // Right shoulder (shooting)
        [LANDMARK_INDICES.RIGHT_SHOULDER]: {
            position: {
                x: shootingShoulderX,
                y: shootingShoulderY,
                z: shootingShoulderZ,
            },
            visibility: 1.0,
        },
        // Right wrist (shooting)
        [LANDMARK_INDICES.RIGHT_WRIST]: {
            position: { x: shootingWristX, y: shootingWristY, z: shootingWristZ },
            visibility: 1.0,
        },
        // Right index finger (shooting)
        [LANDMARK_INDICES.RIGHT_INDEX]: {
            position: { x: shootingIndexX, y: shootingIndexY, z: shootingIndexZ },
            visibility: shootingIndexVisibility,
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
    });
}
describe("GuideElbowFlareCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new GuideElbowFlareCalculator();
            expect(calculator.name).toBe("guideElbowFlare");
            expect(calculator.description).toContain("guide");
            expect(calculator.description.toLowerCase()).toContain("elbow");
            expect(calculator.unit).toBe("degrees");
        });
        it("calculates guide elbow flare angle at set point", () => {
            const calculator = new GuideElbowFlareCalculator();
            const poseLandmarks = [
                createGuideArmPose(0),
                createGuideArmPose(1, {
                    // Guide elbow pushed out from body
                    guideElbowX: 0.32,
                    guideElbowY: 0.42,
                    guideElbowZ: 0.1, // Elbow forward/out
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 1 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 1, endFrame: 1 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.unit).toBe("degrees");
            expect(typeof result.value?.value).toBe("number");
            expect(result.value?.confidence).toBeGreaterThan(0);
        });
        it("returns metric at set point frame", () => {
            const calculator = new GuideElbowFlareCalculator();
            const poseLandmarks = [
                createGuideArmPose(10),
                createGuideArmPose(11),
                createGuideArmPose(12),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 10, end: 12 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 11, endFrame: 11 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value?.frame).toBe(11);
        });
    });
    describe("error handling", () => {
        it("returns error when set point phase is missing", () => {
            const calculator = new GuideElbowFlareCalculator();
            const poseLandmarks = [createGuideArmPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {}, // No set point phase
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
            expect(result.error?.toLowerCase()).toContain("phase");
        });
        it("returns low confidence when guide elbow is occluded", () => {
            const calculator = new GuideElbowFlareCalculator();
            const poseLandmarks = [
                createGuideArmPose(0, { guideElbowVisibility: 0.2 }),
            ];
            const context = {
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
        it("returns error when pose data is missing for set point frame", () => {
            const calculator = new GuideElbowFlareCalculator();
            const poseLandmarks = [];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 10 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 5, endFrame: 5 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
    });
    describe("handedness support", () => {
        it("uses correct landmarks for left-handed shooter", () => {
            const calculator = new GuideElbowFlareCalculator();
            const leftHandedConfig = {
                ...DEFAULT_CONFIG,
                shootingHand: "left",
            };
            // For left-handed shooter, guide arm is right side
            const poseLandmarks = [
                createMockPoseLandmarks(0, 0.9, {
                    // Right shoulder (guide for left-handed)
                    [LANDMARK_INDICES.RIGHT_SHOULDER]: {
                        position: { x: 0.6, y: 0.3, z: 0 },
                        visibility: 1.0,
                    },
                    // Right elbow
                    [LANDMARK_INDICES.RIGHT_ELBOW]: {
                        position: { x: 0.62, y: 0.42, z: 0 },
                        visibility: 1.0,
                    },
                    // Right wrist
                    [LANDMARK_INDICES.RIGHT_WRIST]: {
                        position: { x: 0.55, y: 0.32, z: 0 },
                        visibility: 1.0,
                    },
                    // Left shoulder (shooting)
                    [LANDMARK_INDICES.LEFT_SHOULDER]: {
                        position: { x: 0.4, y: 0.3, z: 0 },
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
            const context = {
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
    describe("edge cases", () => {
        it("handles guide arm occluded on side-view camera", () => {
            const calculator = new GuideElbowFlareCalculator();
            // Simulate side view where guide arm is partially occluded
            const poseLandmarks = [
                createGuideArmPose(0, {
                    guideShoulderVisibility: 0.3,
                    guideElbowVisibility: 0.2,
                    guideWristVisibility: 0.4,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            // Should return result with low confidence, not an error
            expect(result.value).toBeDefined();
            expect(result.value?.confidence).toBeLessThan(0.5);
        });
    });
});
describe("GuideHandPositionCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new GuideHandPositionCalculator();
            expect(calculator.name).toBe("guideHandPosition");
            expect(calculator.description).toContain("guide");
            expect(calculator.description.toLowerCase()).toContain("position");
            expect(calculator.unit).toBe("category");
        });
        it("returns categorical value", () => {
            const calculator = new GuideHandPositionCalculator();
            const poseLandmarks = [createGuideArmPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(typeof result.value?.value).toBe("string");
            expect(["side", "under", "front", "thumb-up"]).toContain(result.value?.value);
        });
    });
    describe("position classification", () => {
        it("classifies guide hand at side position", () => {
            const calculator = new GuideHandPositionCalculator();
            // Guide wrist to the left (side) of shooting wrist
            const poseLandmarks = [
                createGuideArmPose(0, {
                    guideWristX: 0.35, // Far to the left
                    guideWristY: 0.28, // Same height as shooting wrist
                    shootingWristX: 0.55,
                    shootingWristY: 0.28,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value?.value).toBe("side");
        });
        it("classifies guide hand at under position", () => {
            const calculator = new GuideHandPositionCalculator();
            // Guide wrist below shooting wrist (higher Y = lower on screen)
            // Also set guide index to be at same Y as wrist to avoid thumb-up detection
            const poseLandmarks = [
                createGuideArmPose(0, {
                    guideWristX: 0.52, // Close to shooting wrist horizontally
                    guideWristY: 0.38, // Below shooting wrist (higher Y)
                    guideIndexX: 0.54, // Index finger at similar X
                    guideIndexY: 0.38, // Index finger at same Y as wrist (not above)
                    shootingWristX: 0.55,
                    shootingWristY: 0.28,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value?.value).toBe("under");
        });
        it("classifies guide hand at front position", () => {
            const calculator = new GuideHandPositionCalculator();
            // Guide wrist in front of (different z) shooting wrist
            const poseLandmarks = [
                createGuideArmPose(0, {
                    guideWristX: 0.52,
                    guideWristY: 0.28,
                    guideWristZ: 0.15, // Forward of body plane
                    shootingWristX: 0.55,
                    shootingWristY: 0.28,
                    shootingWristZ: 0,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value?.value).toBe("front");
        });
        it("classifies guide hand at thumb-up position", () => {
            const calculator = new GuideHandPositionCalculator();
            // Guide index finger directly above wrist (thumb-up position)
            const poseLandmarks = [
                createGuideArmPose(0, {
                    guideWristX: 0.52,
                    guideWristY: 0.32,
                    guideIndexX: 0.52, // Same X as wrist
                    guideIndexY: 0.22, // Above wrist (lower Y)
                    shootingWristX: 0.55,
                    shootingWristY: 0.28,
                }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value?.value).toBe("thumb-up");
        });
    });
    describe("error handling", () => {
        it("returns error when set point phase is missing", () => {
            const calculator = new GuideHandPositionCalculator();
            const poseLandmarks = [createGuideArmPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {},
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
        it("returns error when required landmarks are missing", () => {
            const calculator = new GuideHandPositionCalculator();
            const poseLandmarks = [];
            const context = {
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
describe("GuideHandReleaseCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new GuideHandReleaseCalculator();
            expect(calculator.name).toBe("guideHandRelease");
            expect(calculator.description).toContain("guide");
            expect(calculator.description.toLowerCase()).toContain("release");
            expect(calculator.unit).toBe("percent");
        });
        it("calculates release timing as percentage of shot", () => {
            const calculator = new GuideHandReleaseCalculator();
            // Create 10 frames, guide hand separates at frame 5
            const poseLandmarks = Array.from({ length: 10 }, (_, i) => {
                if (i < 5) {
                    // Hands close together
                    return createGuideArmPose(i, {
                        guideIndexX: 0.54,
                        guideIndexY: 0.24,
                        shootingIndexX: 0.55,
                        shootingIndexY: 0.24,
                    });
                }
                else {
                    // Hands separated
                    return createGuideArmPose(i, {
                        guideIndexX: 0.4,
                        guideIndexY: 0.35,
                        shootingIndexX: 0.55,
                        shootingIndexY: 0.24,
                    });
                }
            });
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 9 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 3, endFrame: 4 },
                    [ShotPhase.Release]: { startFrame: 5, endFrame: 5 },
                    [ShotPhase.FollowThrough]: { startFrame: 6, endFrame: 9 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.unit).toBe("percent");
            expect(typeof result.value?.value).toBe("number");
            // Should be around 50% (frame 5 out of 10)
            expect(result.value?.value).toBeCloseTo(50, 0);
        });
    });
    describe("timing detection", () => {
        it("detects early release (hands separate before release)", () => {
            const calculator = new GuideHandReleaseCalculator();
            // Create 10 frames, guide hand separates early (frame 2)
            const poseLandmarks = Array.from({ length: 10 }, (_, i) => {
                if (i < 2) {
                    return createGuideArmPose(i, {
                        guideIndexX: 0.54,
                        guideIndexY: 0.24,
                        shootingIndexX: 0.55,
                        shootingIndexY: 0.24,
                    });
                }
                else {
                    return createGuideArmPose(i, {
                        guideIndexX: 0.4,
                        guideIndexY: 0.35,
                        shootingIndexX: 0.55,
                        shootingIndexY: 0.24,
                    });
                }
            });
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 9 },
                phases: {
                    [ShotPhase.Release]: { startFrame: 5, endFrame: 5 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Early release - around 20%
            expect(result.value?.value).toBeLessThan(30);
        });
        it("detects late release (hands stay together longer)", () => {
            const calculator = new GuideHandReleaseCalculator();
            // Create 10 frames, guide hand separates late (frame 8)
            const poseLandmarks = Array.from({ length: 10 }, (_, i) => {
                if (i < 8) {
                    return createGuideArmPose(i, {
                        guideIndexX: 0.54,
                        guideIndexY: 0.24,
                        shootingIndexX: 0.55,
                        shootingIndexY: 0.24,
                    });
                }
                else {
                    return createGuideArmPose(i, {
                        guideIndexX: 0.4,
                        guideIndexY: 0.35,
                        shootingIndexX: 0.55,
                        shootingIndexY: 0.24,
                    });
                }
            });
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 9 },
                phases: {
                    [ShotPhase.Release]: { startFrame: 5, endFrame: 5 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Late release - around 80%
            expect(result.value?.value).toBeGreaterThan(70);
        });
    });
    describe("error handling", () => {
        it("returns error when release phase is missing", () => {
            const calculator = new GuideHandReleaseCalculator();
            const poseLandmarks = [createGuideArmPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {},
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
        it("handles missing pose data gracefully", () => {
            const calculator = new GuideHandReleaseCalculator();
            const poseLandmarks = [];
            const context = {
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
    describe("edge cases", () => {
        it("handles young shooters with extended contact time", () => {
            const calculator = new GuideHandReleaseCalculator();
            // Young shooter: guide hand stays in contact through entire shot
            const poseLandmarks = Array.from({ length: 10 }, (_, i) => createGuideArmPose(i, {
                guideIndexX: 0.54,
                guideIndexY: 0.24,
                shootingIndexX: 0.55,
                shootingIndexY: 0.24,
            }));
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 9 },
                phases: {
                    [ShotPhase.Release]: { startFrame: 5, endFrame: 5 },
                    [ShotPhase.FollowThrough]: { startFrame: 6, endFrame: 9 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Should return 100% since hands never separate
            expect(result.value?.value).toBe(100);
        });
        it("handles shot duration of 1 frame", () => {
            const calculator = new GuideHandReleaseCalculator();
            const poseLandmarks = [createGuideArmPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {
                    [ShotPhase.Release]: { startFrame: 0, endFrame: 0 },
                },
                config,
            };
            const result = calculator.calculate(context);
            // Should handle gracefully (either return value or clear error)
            expect(result.error ?? result.value).toBeDefined();
        });
    });
});
//# sourceMappingURL=guide-arm.test.js.map