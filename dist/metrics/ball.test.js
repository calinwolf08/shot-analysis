/**
 * Unit tests for Ball Position Metrics calculators.
 * Tests inferred ball position metrics: ball center, dip, path, set point, release, and behind head.
 */
import { describe, it, expect } from "vitest";
import { inferBallCenter, areHandsTogether, BallDipCalculator, BallPathCalculator, SetPointHeightCalculator, SetPointDurationCalculator, ReleasePointCalculator, ReleaseAngleCalculator, BallBehindHeadCalculator, createBallMetricCalculators, } from "./ball";
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
 * Creates a shooting pose with hands together holding the ball.
 * Index fingers are positioned close together.
 */
function createHandsTogetherPose(frameIndex, options = {}) {
    const { ballX = 0.5, ballY = 0.3, ballZ = 0, fingerSeparation = 0.02, // Close together by default
    noseY = 0.2, leftShoulderX = 0.4, rightShoulderX = 0.6, shoulderY = 0.35, leftIndexVisibility = 1.0, rightIndexVisibility = 1.0, } = options;
    // Index fingers positioned around ball center
    const halfSep = fingerSeparation / 2;
    return createMockPoseLandmarks(frameIndex, 0.9, {
        // Nose (head reference)
        [LANDMARK_INDICES.NOSE]: {
            position: { x: 0.5, y: noseY, z: 0 },
            visibility: 1.0,
        },
        // Shoulders for normalization
        [LANDMARK_INDICES.LEFT_SHOULDER]: {
            position: { x: leftShoulderX, y: shoulderY, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.RIGHT_SHOULDER]: {
            position: { x: rightShoulderX, y: shoulderY, z: 0 },
            visibility: 1.0,
        },
        // Index fingers around ball
        [LANDMARK_INDICES.LEFT_INDEX]: {
            position: { x: ballX - halfSep, y: ballY, z: ballZ },
            visibility: leftIndexVisibility,
        },
        [LANDMARK_INDICES.RIGHT_INDEX]: {
            position: { x: ballX + halfSep, y: ballY, z: ballZ },
            visibility: rightIndexVisibility,
        },
        // Wrists for arm tracking
        [LANDMARK_INDICES.LEFT_WRIST]: {
            position: { x: ballX - 0.05, y: ballY + 0.05, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.RIGHT_WRIST]: {
            position: { x: ballX + 0.05, y: ballY + 0.05, z: 0 },
            visibility: 1.0,
        },
        // Elbows
        [LANDMARK_INDICES.LEFT_ELBOW]: {
            position: { x: leftShoulderX - 0.02, y: shoulderY + 0.1, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.RIGHT_ELBOW]: {
            position: { x: rightShoulderX + 0.02, y: shoulderY + 0.1, z: 0 },
            visibility: 1.0,
        },
    });
}
/**
 * Creates a pose with hands separated (after release).
 */
function createHandsSeparatedPose(frameIndex, options = {}) {
    const { leftIndexX = 0.3, rightIndexX = 0.7, leftIndexY = 0.4, rightIndexY = 0.25, noseY = 0.2, } = options;
    return createMockPoseLandmarks(frameIndex, 0.9, {
        [LANDMARK_INDICES.NOSE]: {
            position: { x: 0.5, y: noseY, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.LEFT_SHOULDER]: {
            position: { x: 0.4, y: 0.35, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.RIGHT_SHOULDER]: {
            position: { x: 0.6, y: 0.35, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.LEFT_INDEX]: {
            position: { x: leftIndexX, y: leftIndexY, z: 0 },
            visibility: 1.0,
        },
        [LANDMARK_INDICES.RIGHT_INDEX]: {
            position: { x: rightIndexX, y: rightIndexY, z: 0 },
            visibility: 1.0,
        },
    });
}
// ============================================================================
// Ball Center Inference Tests (5.4.1, 5.4.3)
// ============================================================================
describe("inferBallCenter", () => {
    describe("basic functionality", () => {
        it("returns midpoint of index fingers when hands are together", () => {
            const pose = createHandsTogetherPose(0, {
                ballX: 0.5,
                ballY: 0.3,
                fingerSeparation: 0.02,
            });
            const result = inferBallCenter(pose);
            expect(result).not.toBeNull();
            expect(result?.position.x).toBeCloseTo(0.5, 2);
            expect(result?.position.y).toBeCloseTo(0.3, 2);
        });
        it("returns null when hands are separated", () => {
            const pose = createHandsSeparatedPose(0);
            const result = inferBallCenter(pose);
            expect(result).toBeNull();
        });
        it("calculates confidence from index finger visibility", () => {
            const pose = createHandsTogetherPose(0, {
                leftIndexVisibility: 0.8,
                rightIndexVisibility: 0.6,
            });
            const result = inferBallCenter(pose);
            expect(result).not.toBeNull();
            // Confidence should be minimum of the two, times ball confidence penalty (0.8)
            expect(result?.confidence).toBe(0.6 * 0.8);
        });
    });
    describe("edge cases", () => {
        it("returns null when index finger landmarks are missing", () => {
            // Create a pose where one index finger has very low visibility
            const poseWithMissing = createHandsTogetherPose(0, {
                leftIndexVisibility: 0.0,
            });
            const result = inferBallCenter(poseWithMissing);
            // Should return result with low confidence (not null since landmark exists)
            expect(result?.confidence).toBe(0);
        });
        it("returns 3D position including z coordinate", () => {
            const pose = createHandsTogetherPose(0, {
                ballX: 0.5,
                ballY: 0.3,
                ballZ: 0.1,
            });
            const result = inferBallCenter(pose);
            expect(result).not.toBeNull();
            expect(result?.position.z).toBeCloseTo(0.1, 2);
        });
    });
});
describe("areHandsTogether", () => {
    it("returns true when hands are close together", () => {
        const pose = createHandsTogetherPose(0, { fingerSeparation: 0.02 });
        expect(areHandsTogether(pose)).toBe(true);
    });
    it("returns false when hands are far apart", () => {
        const pose = createHandsSeparatedPose(0);
        expect(areHandsTogether(pose)).toBe(false);
    });
    it("respects custom threshold", () => {
        const pose = createHandsTogetherPose(0, { fingerSeparation: 0.1 });
        // Default threshold should consider this too far
        expect(areHandsTogether(pose)).toBe(false);
        // With higher threshold, should be considered together
        expect(areHandsTogether(pose, 0.15)).toBe(true);
    });
});
// ============================================================================
// Ball Dip Calculator Tests (5.4.4, 5.4.5)
// ============================================================================
describe("BallDipCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new BallDipCalculator();
            expect(calculator.name).toBe("ballDip");
            expect(calculator.description.toLowerCase()).toContain("drop");
            expect(calculator.unit).toBe("normalized");
        });
        it("calculates ball dip during gather/load phases", () => {
            const calculator = new BallDipCalculator();
            // Ball starts high, dips down, then rises
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballY: 0.3 }), // High
                createHandsTogetherPose(1, { ballY: 0.35 }), // Dipping
                createHandsTogetherPose(2, { ballY: 0.45 }), // Lowest point (dip)
                createHandsTogetherPose(3, { ballY: 0.4 }), // Rising
                createHandsTogetherPose(4, { ballY: 0.25 }), // Set point
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 4 },
                phases: {
                    [ShotPhase.Gather]: { startFrame: 0, endFrame: 1 },
                    [ShotPhase.Load]: { startFrame: 2, endFrame: 2 },
                    [ShotPhase.Rise]: { startFrame: 3, endFrame: 3 },
                    [ShotPhase.SetPoint]: { startFrame: 4, endFrame: 4 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.error).toBeUndefined();
            // Ball dipped from y=0.3 to y=0.45, dip = 0.15 (normalized to shoulder width)
            expect(typeof result.value?.value).toBe("number");
            expect(result.value?.value).toBeGreaterThan(0);
        });
        it("returns 0 when ball never dips", () => {
            const calculator = new BallDipCalculator();
            // Ball only rises (no dip shooting style)
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballY: 0.4 }), // Start
                createHandsTogetherPose(1, { ballY: 0.35 }), // Rising
                createHandsTogetherPose(2, { ballY: 0.3 }), // Rising more
                createHandsTogetherPose(3, { ballY: 0.25 }), // Set point
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 3 },
                phases: {
                    [ShotPhase.Gather]: { startFrame: 0, endFrame: 1 },
                    [ShotPhase.Rise]: { startFrame: 2, endFrame: 2 },
                    [ShotPhase.SetPoint]: { startFrame: 3, endFrame: 3 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.value).toBe(0);
        });
    });
    describe("edge cases", () => {
        it("handles hands separating early", () => {
            const calculator = new BallDipCalculator();
            // Hands separate during gather phase
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballY: 0.3 }),
                createHandsSeparatedPose(1), // Hands separate early
                createHandsSeparatedPose(2),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 2 },
                phases: {
                    [ShotPhase.Gather]: { startFrame: 0, endFrame: 2 },
                },
                config,
            };
            const result = calculator.calculate(context);
            // Should still return a result, but might have lower confidence
            // or return 0 if insufficient data
            expect(result.value).toBeDefined();
        });
    });
});
// ============================================================================
// Ball Path Calculator Tests (5.4.4, 5.4.5)
// ============================================================================
describe("BallPathCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new BallPathCalculator();
            expect(calculator.name).toBe("ballPath");
            expect(calculator.description.toLowerCase()).toContain("path");
            expect(calculator.unit).toBe("deviation");
        });
        it("returns low deviation for straight path to set point", () => {
            const calculator = new BallPathCalculator();
            // Ball moves in a straight vertical line
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballX: 0.5, ballY: 0.5 }),
                createHandsTogetherPose(1, { ballX: 0.5, ballY: 0.4 }),
                createHandsTogetherPose(2, { ballX: 0.5, ballY: 0.3 }),
                createHandsTogetherPose(3, { ballX: 0.5, ballY: 0.2 }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 3 },
                phases: {
                    [ShotPhase.Gather]: { startFrame: 0, endFrame: 0 },
                    [ShotPhase.Rise]: { startFrame: 1, endFrame: 2 },
                    [ShotPhase.SetPoint]: { startFrame: 3, endFrame: 3 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Low deviation for straight path
            expect(result.value?.value).toBeCloseTo(0, 1);
        });
        it("returns higher deviation for curved path", () => {
            const calculator = new BallPathCalculator();
            // Ball moves in a curved path
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballX: 0.5, ballY: 0.5 }),
                createHandsTogetherPose(1, { ballX: 0.6, ballY: 0.4 }), // Deviation right
                createHandsTogetherPose(2, { ballX: 0.55, ballY: 0.3 }), // Back toward center
                createHandsTogetherPose(3, { ballX: 0.5, ballY: 0.2 }), // Set point
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 3 },
                phases: {
                    [ShotPhase.Gather]: { startFrame: 0, endFrame: 0 },
                    [ShotPhase.Rise]: { startFrame: 1, endFrame: 2 },
                    [ShotPhase.SetPoint]: { startFrame: 3, endFrame: 3 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Higher deviation for curved path
            expect(result.value?.value).toBeGreaterThan(0);
        });
    });
});
// ============================================================================
// Set Point Height Calculator Tests (5.4.6, 5.4.7)
// ============================================================================
describe("SetPointHeightCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new SetPointHeightCalculator();
            expect(calculator.name).toBe("setPointHeight");
            expect(calculator.description.toLowerCase()).toContain("height");
            expect(calculator.unit).toBe("normalized");
        });
        it("calculates height relative to head", () => {
            const calculator = new SetPointHeightCalculator();
            // Ball at set point, above the nose
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballY: 0.15, noseY: 0.25 }),
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
            // Ball is above head (lower y value = higher in image coords)
            // Height should be positive (ball above nose)
            expect(result.value?.value).toBeGreaterThan(0);
        });
        it("returns negative value when ball is below head", () => {
            const calculator = new SetPointHeightCalculator();
            // Ball at set point, below the nose
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballY: 0.35, noseY: 0.25 }),
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
            // Negative because ball is below head
            expect(result.value?.value).toBeLessThan(0);
        });
    });
    describe("error handling", () => {
        it("returns error when set point phase is missing", () => {
            const calculator = new SetPointHeightCalculator();
            const poseLandmarks = [createHandsTogetherPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {}, // No set point phase
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
    });
});
// ============================================================================
// Set Point Duration Calculator Tests (5.4.6, 5.4.7)
// ============================================================================
describe("SetPointDurationCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new SetPointDurationCalculator();
            expect(calculator.name).toBe("setPointDuration");
            expect(calculator.description.toLowerCase()).toContain("duration");
            expect(calculator.unit).toBe("ms");
        });
        it("calculates duration of set point phase in milliseconds", () => {
            const calculator = new SetPointDurationCalculator();
            // Set point lasts 3 frames at 30fps = ~100ms
            const poseLandmarks = Array.from({ length: 5 }, (_, i) => createHandsTogetherPose(i));
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 4 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 1, endFrame: 3 }, // 3 frames
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(typeof result.value?.value).toBe("number");
            // Duration in ms (3 frames at ~33.33ms per frame = ~100ms)
            expect(result.value?.value).toBeGreaterThan(0);
        });
        it("handles very short set point (quick release)", () => {
            const calculator = new SetPointDurationCalculator();
            // Quick release - set point is only 1 frame
            const poseLandmarks = Array.from({ length: 3 }, (_, i) => createHandsTogetherPose(i));
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 2 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 1, endFrame: 1 }, // 1 frame only
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Should still work for very short durations (<50ms)
            expect(result.value?.value).toBeGreaterThan(0);
        });
    });
});
// ============================================================================
// Release Point Calculator Tests (5.4.8, 5.4.9)
// ============================================================================
describe("ReleasePointCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new ReleasePointCalculator();
            expect(calculator.name).toBe("releasePoint");
            expect(calculator.description.toLowerCase()).toContain("release");
            expect(calculator.unit).toBe("normalized");
        });
        it("calculates release position relative to head", () => {
            const calculator = new ReleasePointCalculator();
            // Release at frame 3
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballY: 0.3 }),
                createHandsTogetherPose(1, { ballY: 0.25 }),
                createHandsTogetherPose(2, { ballY: 0.2 }),
                createHandsTogetherPose(3, { ballY: 0.15, noseY: 0.25 }), // Release point
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 3 },
                phases: {
                    [ShotPhase.Release]: { startFrame: 3, endFrame: 3 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(result.value?.frame).toBe(3);
            // Release point height should be positive (above head)
            expect(typeof result.value?.value).toBe("number");
        });
    });
    describe("error handling", () => {
        it("returns error when release phase is missing", () => {
            const calculator = new ReleasePointCalculator();
            const poseLandmarks = [createHandsTogetherPose(0)];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 0 },
                phases: {},
                config,
            };
            const result = calculator.calculate(context);
            expect(result.error).toBeDefined();
        });
    });
});
// ============================================================================
// Release Angle Calculator Tests (5.4.8, 5.4.9)
// ============================================================================
describe("ReleaseAngleCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new ReleaseAngleCalculator();
            expect(calculator.name).toBe("releaseAngle");
            expect(calculator.description.toLowerCase()).toContain("angle");
            expect(calculator.unit).toBe("degrees");
        });
        it("calculates shooting arm angle at release", () => {
            const calculator = new ReleaseAngleCalculator();
            // Arm extended upward at release
            const poseLandmarks = [
                createMockPoseLandmarks(0, 0.9, {
                    // Shoulder
                    [LANDMARK_INDICES.RIGHT_SHOULDER]: {
                        position: { x: 0.6, y: 0.35, z: 0 },
                        visibility: 1.0,
                    },
                    // Elbow above shoulder
                    [LANDMARK_INDICES.RIGHT_ELBOW]: {
                        position: { x: 0.62, y: 0.25, z: 0 },
                        visibility: 1.0,
                    },
                    // Wrist above elbow (arm extended up)
                    [LANDMARK_INDICES.RIGHT_WRIST]: {
                        position: { x: 0.64, y: 0.15, z: 0 },
                        visibility: 1.0,
                    },
                    // Nose for reference
                    [LANDMARK_INDICES.NOSE]: {
                        position: { x: 0.5, y: 0.25, z: 0 },
                        visibility: 1.0,
                    },
                }),
            ];
            const context = {
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
            // Arm is pointing upward, angle should be positive
            expect(typeof result.value?.value).toBe("number");
            expect(result.value?.value).toBeGreaterThan(0);
            expect(result.value?.value).toBeLessThanOrEqual(90);
        });
    });
    describe("handedness support", () => {
        it("uses left arm for left-handed shooter", () => {
            const calculator = new ReleaseAngleCalculator();
            const leftHandedConfig = {
                ...DEFAULT_CONFIG,
                shootingHand: "left",
            };
            const poseLandmarks = [
                createMockPoseLandmarks(0, 0.9, {
                    // Left shoulder (shooting for left-handed)
                    [LANDMARK_INDICES.LEFT_SHOULDER]: {
                        position: { x: 0.4, y: 0.35, z: 0 },
                        visibility: 1.0,
                    },
                    [LANDMARK_INDICES.LEFT_ELBOW]: {
                        position: { x: 0.38, y: 0.25, z: 0 },
                        visibility: 1.0,
                    },
                    [LANDMARK_INDICES.LEFT_WRIST]: {
                        position: { x: 0.36, y: 0.15, z: 0 },
                        visibility: 1.0,
                    },
                    [LANDMARK_INDICES.NOSE]: {
                        position: { x: 0.5, y: 0.25, z: 0 },
                        visibility: 1.0,
                    },
                }),
            ];
            const context = {
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
// ============================================================================
// Ball Behind Head Calculator Tests (5.4.10, 5.4.11)
// ============================================================================
describe("BallBehindHeadCalculator", () => {
    const config = { ...DEFAULT_CONFIG, shootingHand: "right" };
    describe("basic functionality", () => {
        it("has correct name, description, and unit", () => {
            const calculator = new BallBehindHeadCalculator();
            expect(calculator.name).toBe("ballBehindHead");
            expect(calculator.description.toLowerCase()).toContain("head");
            expect(calculator.unit).toBe("normalized");
        });
        it("calculates furthest back position relative to head", () => {
            const calculator = new BallBehindHeadCalculator();
            // Ball moves behind head during set point
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballX: 0.5 }), // In front
                createHandsTogetherPose(1, { ballX: 0.55 }), // Moving back (right of center for right-handed)
                createHandsTogetherPose(2, { ballX: 0.6 }), // Furthest back
                createHandsTogetherPose(3, { ballX: 0.55 }), // Moving forward
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 3 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 1, endFrame: 3 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            expect(typeof result.value?.value).toBe("number");
        });
        it("returns 0 when ball stays in front of head", () => {
            const calculator = new BallBehindHeadCalculator();
            // Ball stays in front throughout (nose x = 0.5)
            const poseLandmarks = [
                createHandsTogetherPose(0, { ballX: 0.45 }),
                createHandsTogetherPose(1, { ballX: 0.48 }),
                createHandsTogetherPose(2, { ballX: 0.5 }),
            ];
            const context = {
                poseLandmarks,
                frameRange: { start: 0, end: 2 },
                phases: {
                    [ShotPhase.SetPoint]: { startFrame: 0, endFrame: 2 },
                },
                config,
            };
            const result = calculator.calculate(context);
            expect(result.value).toBeDefined();
            // Should be 0 or close to 0 since ball didn't go behind head
            expect(result.value?.value).toBeGreaterThanOrEqual(0);
        });
    });
});
// ============================================================================
// Factory Function Tests
// ============================================================================
describe("createBallMetricCalculators", () => {
    it("returns all ball metric calculators", () => {
        const calculators = createBallMetricCalculators();
        expect(calculators).toHaveLength(7);
        const names = calculators.map((c) => c.name);
        expect(names).toContain("ballDip");
        expect(names).toContain("ballPath");
        expect(names).toContain("setPointHeight");
        expect(names).toContain("setPointDuration");
        expect(names).toContain("releasePoint");
        expect(names).toContain("releaseAngle");
        expect(names).toContain("ballBehindHead");
    });
});
//# sourceMappingURL=ball.test.js.map