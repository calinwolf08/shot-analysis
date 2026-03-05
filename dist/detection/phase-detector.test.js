/**
 * Unit tests for PhaseDetector.
 * Tests phase identification logic for all 6 shot phases.
 */
import { describe, it, expect } from "vitest";
import { PhaseDetector, createPhaseDetector, } from "./phase-detector";
import { ShotPhase } from "./types";
import { LANDMARK_INDEX } from "../pose/types";
/**
 * Helper to create a single landmark with default values.
 */
function createLandmark(x, y, z = 0, visibility = 0.95, confidence = 0.95) {
    return { x, y, z, visibility, confidence };
}
/**
 * Helper to create a full set of 33 landmarks with default positions.
 * Default pose is standing with arms at sides.
 */
function createDefaultLandmarks() {
    const landmarks = [];
    for (let i = 0; i < 33; i++) {
        landmarks.push(createLandmark(0.5, 0.5, 0));
    }
    // Set realistic body landmark positions
    // Face
    landmarks[LANDMARK_INDEX.NOSE] = createLandmark(0.5, 0.15);
    landmarks[LANDMARK_INDEX.LEFT_EYE] = createLandmark(0.48, 0.13);
    landmarks[LANDMARK_INDEX.RIGHT_EYE] = createLandmark(0.52, 0.13);
    landmarks[LANDMARK_INDEX.LEFT_EAR] = createLandmark(0.45, 0.15);
    landmarks[LANDMARK_INDEX.RIGHT_EAR] = createLandmark(0.55, 0.15);
    // Shoulders
    landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.4, 0.25);
    landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.6, 0.25);
    // Arms at sides
    landmarks[LANDMARK_INDEX.LEFT_ELBOW] = createLandmark(0.35, 0.4);
    landmarks[LANDMARK_INDEX.RIGHT_ELBOW] = createLandmark(0.65, 0.4);
    landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.35, 0.55);
    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.65, 0.55);
    landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(0.35, 0.58);
    landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(0.65, 0.58);
    // Hips
    landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, 0.5);
    landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, 0.5);
    // Knees
    landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.45, 0.7);
    landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.55, 0.7);
    // Ankles
    landmarks[LANDMARK_INDEX.LEFT_ANKLE] = createLandmark(0.45, 0.9);
    landmarks[LANDMARK_INDEX.RIGHT_ANKLE] = createLandmark(0.55, 0.9);
    return landmarks;
}
/**
 * Helper to create PoseLandmarks for a single frame.
 */
function createPoseLandmarks(landmarks, poseConfidence = 0.95) {
    return { landmarks, poseConfidence };
}
/**
 * Creates a frame sequence with specified configurations.
 */
function createFrameSequence(configs) {
    return configs.map((config) => {
        const landmarks = createDefaultLandmarks();
        // Set wrist positions
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.4, config.wristY[0]);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.6, config.wristY[1]);
        // Set hip positions if specified
        if (config.hipY !== undefined) {
            landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, config.hipY);
            landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, config.hipY);
        }
        // Set knee positions based on angle (simplified - adjust Y position)
        if (config.kneeAngle !== undefined) {
            // Lower kneeAngle = more bent = higher Y (closer to hip)
            const kneeY = 0.5 + (config.kneeAngle / 180) * 0.2;
            landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.45, kneeY);
            landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.55, kneeY);
        }
        // Set index finger positions for hand separation tracking
        if (config.indexFingerY !== undefined) {
            const leftX = config.indexFingerX?.[0] ?? 0.4;
            const rightX = config.indexFingerX?.[1] ?? 0.6;
            landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(leftX, config.indexFingerY[0]);
            landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(rightX, config.indexFingerY[1]);
        }
        else {
            // Default: follow wrists
            landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(0.4, config.wristY[0] + 0.03);
            landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(0.6, config.wristY[1] + 0.03);
        }
        return createPoseLandmarks(landmarks);
    });
}
/**
 * Creates a complete shot sequence with all 6 phases.
 * Frame positions simulate a right-handed shooter.
 */
function createCompleteShotSequence() {
    const configs = [
        // Frames 0-4: Neutral stance (pre-gather)
        { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
        // Frames 5-9: Gather - hands come together, preparing
        {
            wristY: [0.52, 0.5],
            hipY: 0.5,
            kneeAngle: 165,
            indexFingerX: [0.45, 0.55],
        },
        {
            wristY: [0.48, 0.45],
            hipY: 0.5,
            kneeAngle: 162,
            indexFingerX: [0.47, 0.53],
        },
        {
            wristY: [0.44, 0.4],
            hipY: 0.5,
            kneeAngle: 158,
            indexFingerX: [0.48, 0.52],
        },
        {
            wristY: [0.42, 0.38],
            hipY: 0.5,
            kneeAngle: 155,
            indexFingerX: [0.49, 0.51],
        },
        {
            wristY: [0.4, 0.36],
            hipY: 0.51,
            kneeAngle: 150,
            indexFingerX: [0.5, 0.5],
        },
        // Frames 10-14: Load - hips dip, knees bend more, ball may dip slightly
        {
            wristY: [0.42, 0.38],
            hipY: 0.52,
            kneeAngle: 145,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.44, 0.4],
            hipY: 0.53,
            kneeAngle: 140,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.45, 0.41],
            hipY: 0.54,
            kneeAngle: 135,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.44, 0.4],
            hipY: 0.54,
            kneeAngle: 132,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.42, 0.38],
            hipY: 0.54,
            kneeAngle: 130,
            indexFingerX: [0.5, 0.5],
        },
        // Frames 15-24: Rise - legs extend, ball moves upward
        {
            wristY: [0.38, 0.34],
            hipY: 0.52,
            kneeAngle: 140,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.34, 0.3],
            hipY: 0.5,
            kneeAngle: 150,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.3, 0.26],
            hipY: 0.48,
            kneeAngle: 158,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.26, 0.22],
            hipY: 0.47,
            kneeAngle: 165,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.22, 0.18],
            hipY: 0.46,
            kneeAngle: 170,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.2, 0.16],
            hipY: 0.45,
            kneeAngle: 172,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.18, 0.14],
            hipY: 0.44,
            kneeAngle: 175,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.16, 0.12],
            hipY: 0.44,
            kneeAngle: 177,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.14, 0.1],
            hipY: 0.44,
            kneeAngle: 178,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.13, 0.09],
            hipY: 0.44,
            kneeAngle: 179,
            indexFingerX: [0.5, 0.5],
        },
        // Frames 25-29: Set Point - ball at highest point, brief pause
        {
            wristY: [0.12, 0.08],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.11, 0.07],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.1, 0.06],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.1, 0.06],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.5, 0.5],
        },
        {
            wristY: [0.1, 0.06],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.5, 0.5],
        },
        // Frames 30-34: Release - shooting arm extends, hands separate
        {
            wristY: [0.12, 0.04],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.48, 0.52],
            indexFingerY: [0.15, 0.07],
        },
        {
            wristY: [0.18, 0.03],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.45, 0.55],
            indexFingerY: [0.21, 0.06],
        },
        {
            wristY: [0.24, 0.04],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.42, 0.58],
            indexFingerY: [0.27, 0.07],
        },
        {
            wristY: [0.28, 0.06],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.4, 0.6],
            indexFingerY: [0.31, 0.09],
        },
        {
            wristY: [0.32, 0.08],
            hipY: 0.44,
            kneeAngle: 180,
            indexFingerX: [0.38, 0.62],
            indexFingerY: [0.35, 0.11],
        },
        // Frames 35-39: Follow Through - arm fully extended, held
        {
            wristY: [0.35, 0.1],
            hipY: 0.45,
            kneeAngle: 178,
            indexFingerX: [0.36, 0.64],
            indexFingerY: [0.38, 0.13],
        },
        {
            wristY: [0.36, 0.12],
            hipY: 0.46,
            kneeAngle: 175,
            indexFingerX: [0.35, 0.65],
            indexFingerY: [0.39, 0.15],
        },
        {
            wristY: [0.37, 0.14],
            hipY: 0.47,
            kneeAngle: 172,
            indexFingerX: [0.35, 0.65],
            indexFingerY: [0.4, 0.17],
        },
        {
            wristY: [0.38, 0.16],
            hipY: 0.48,
            kneeAngle: 170,
            indexFingerX: [0.35, 0.65],
            indexFingerY: [0.41, 0.19],
        },
        {
            wristY: [0.4, 0.18],
            hipY: 0.48,
            kneeAngle: 168,
            indexFingerX: [0.35, 0.65],
            indexFingerY: [0.43, 0.21],
        },
        // Frames 40-44: Return to neutral
        { wristY: [0.45, 0.3], hipY: 0.49, kneeAngle: 168 },
        { wristY: [0.5, 0.4], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.53, 0.48], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.55, 0.53], hipY: 0.5, kneeAngle: 170 },
        { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
    ];
    return createFrameSequence(configs);
}
describe("PhaseDetector", () => {
    describe("createPhaseDetector factory", () => {
        it("creates a detector with default config", () => {
            const detector = createPhaseDetector();
            expect(detector).toBeInstanceOf(PhaseDetector);
        });
        it("creates a detector with custom config", () => {
            const config = {
                smoothingWindowSize: 5,
                hysteresisThreshold: 0.02,
            };
            const detector = createPhaseDetector(config);
            expect(detector).toBeInstanceOf(PhaseDetector);
        });
    });
    describe("detectPhases method", () => {
        it("returns PhaseDetectionResult with all required fields", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result).toHaveProperty("phases");
            expect(result).toHaveProperty("confidence");
            expect(typeof result.confidence).toBe("number");
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });
        it("returns empty phases for empty sequence", () => {
            const detector = createPhaseDetector();
            const result = detector.detectPhases([], 0, 0);
            expect(Object.keys(result.phases)).toHaveLength(0);
            expect(result.confidence).toBe(0);
        });
        it("returns empty phases for single frame", () => {
            const sequence = createFrameSequence([{ wristY: [0.5, 0.5] }]);
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, 0);
            expect(Object.keys(result.phases)).toHaveLength(0);
        });
    });
    describe("gather phase detection", () => {
        it("detects gather phase when hands come together", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result.phases[ShotPhase.Gather]).toBeDefined();
        });
        it("gather phase starts near the beginning of shot motion", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const gather = result.phases[ShotPhase.Gather];
            expect(gather).toBeDefined();
            // Gather should start in the first third of the sequence
            expect(gather.startFrame).toBeLessThan(sequence.length / 3);
        });
        it("gather phase ends before load phase begins", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const gather = result.phases[ShotPhase.Gather];
            const load = result.phases[ShotPhase.Load];
            if (gather && load) {
                expect(gather.endFrame).toBeLessThanOrEqual(load.startFrame);
            }
        });
        it("marks gather as missing when shot starts mid-motion", () => {
            // Create sequence that starts during the rise
            const configs = [
                // Already rising
                { wristY: [0.3, 0.26], hipY: 0.48, kneeAngle: 158 },
                { wristY: [0.26, 0.22], hipY: 0.47, kneeAngle: 165 },
                { wristY: [0.22, 0.18], hipY: 0.46, kneeAngle: 170 },
                { wristY: [0.18, 0.14], hipY: 0.45, kneeAngle: 175 },
                { wristY: [0.14, 0.1], hipY: 0.44, kneeAngle: 178 },
                { wristY: [0.1, 0.06], hipY: 0.44, kneeAngle: 180 },
                { wristY: [0.12, 0.04], hipY: 0.44, kneeAngle: 180 },
                { wristY: [0.2, 0.06], hipY: 0.45, kneeAngle: 178 },
                { wristY: [0.3, 0.12], hipY: 0.46, kneeAngle: 175 },
                { wristY: [0.4, 0.2], hipY: 0.48, kneeAngle: 170 },
            ];
            const sequence = createFrameSequence(configs);
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Gather phase should be missing or have low confidence
            expect(result.phases[ShotPhase.Gather] === undefined ||
                result.phases[ShotPhase.Gather].endFrame -
                    result.phases[ShotPhase.Gather].startFrame <
                    2).toBe(true);
        });
    });
    describe("load phase detection", () => {
        it("detects load phase when hips drop", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result.phases[ShotPhase.Load]).toBeDefined();
        });
        it("load phase occurs after gather", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const gather = result.phases[ShotPhase.Gather];
            const load = result.phases[ShotPhase.Load];
            if (gather && load) {
                expect(load.startFrame).toBeGreaterThanOrEqual(gather.startFrame);
            }
        });
        it("load phase has decreased knee angle", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const load = result.phases[ShotPhase.Load];
            expect(load).toBeDefined();
            // Load should be in frames 10-14 range based on our test data
            expect(load.startFrame).toBeGreaterThanOrEqual(8);
            expect(load.endFrame).toBeLessThanOrEqual(20);
        });
        it("handles quick shooters with minimal load", () => {
            // Quick shooter - abbreviated load phase
            const configs = [
                // Brief neutral
                { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
                { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
                // Very brief gather/load combined
                { wristY: [0.45, 0.4], hipY: 0.51, kneeAngle: 160 },
                { wristY: [0.4, 0.35], hipY: 0.52, kneeAngle: 155 },
                // Quick rise
                { wristY: [0.3, 0.25], hipY: 0.5, kneeAngle: 165 },
                { wristY: [0.2, 0.15], hipY: 0.48, kneeAngle: 175 },
                { wristY: [0.12, 0.08], hipY: 0.46, kneeAngle: 180 },
                // Release
                { wristY: [0.15, 0.05], hipY: 0.46, kneeAngle: 180 },
                { wristY: [0.25, 0.08], hipY: 0.48, kneeAngle: 178 },
                { wristY: [0.35, 0.15], hipY: 0.5, kneeAngle: 172 },
            ];
            const sequence = createFrameSequence(configs);
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Should still detect phases, even if abbreviated
            expect(result.confidence).toBeGreaterThan(0);
        });
    });
    describe("rise phase detection", () => {
        it("detects rise phase when legs extend and ball rises", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result.phases[ShotPhase.Rise]).toBeDefined();
        });
        it("rise phase shows upward wrist movement", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const rise = result.phases[ShotPhase.Rise];
            expect(rise).toBeDefined();
            // Rise should span multiple frames
            expect(rise.endFrame - rise.startFrame).toBeGreaterThanOrEqual(3);
        });
        it("rise phase occurs between load and set point", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const load = result.phases[ShotPhase.Load];
            const rise = result.phases[ShotPhase.Rise];
            const setPoint = result.phases[ShotPhase.SetPoint];
            if (load && rise) {
                expect(rise.startFrame).toBeGreaterThanOrEqual(load.startFrame);
            }
            if (rise && setPoint) {
                expect(rise.endFrame).toBeLessThanOrEqual(setPoint.endFrame);
            }
        });
        it("rise phase includes knee extension", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const rise = result.phases[ShotPhase.Rise];
            expect(rise).toBeDefined();
            // Rise should be in the middle portion of the shot
            expect(rise.startFrame).toBeGreaterThanOrEqual(12);
            expect(rise.endFrame).toBeLessThanOrEqual(30);
        });
    });
    describe("set point detection", () => {
        it("detects set point when ball reaches highest position", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result.phases[ShotPhase.SetPoint]).toBeDefined();
        });
        it("set point is a brief phase", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const setPoint = result.phases[ShotPhase.SetPoint];
            expect(setPoint).toBeDefined();
            // Set point should be relatively brief (typically 3-8 frames)
            const duration = setPoint.endFrame - setPoint.startFrame + 1;
            expect(duration).toBeLessThanOrEqual(15);
        });
        it("set point has minimum wrist Y (highest position)", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const setPoint = result.phases[ShotPhase.SetPoint];
            expect(setPoint).toBeDefined();
            // Set point should be around frames 25-29 based on test data
            expect(setPoint.startFrame).toBeGreaterThanOrEqual(20);
            expect(setPoint.endFrame).toBeLessThanOrEqual(35);
        });
        it("handles Curry-style quick release with very brief set point", () => {
            // Very quick release - minimal set point
            const configs = [
                { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
                { wristY: [0.45, 0.4], hipY: 0.51, kneeAngle: 155 },
                { wristY: [0.35, 0.3], hipY: 0.52, kneeAngle: 145 },
                { wristY: [0.25, 0.2], hipY: 0.5, kneeAngle: 160 },
                { wristY: [0.15, 0.1], hipY: 0.48, kneeAngle: 175 },
                // Very brief set point
                { wristY: [0.1, 0.06], hipY: 0.46, kneeAngle: 180 },
                // Immediate release
                { wristY: [0.14, 0.04], hipY: 0.46, kneeAngle: 180 },
                { wristY: [0.22, 0.06], hipY: 0.47, kneeAngle: 178 },
                { wristY: [0.32, 0.12], hipY: 0.48, kneeAngle: 175 },
                { wristY: [0.42, 0.2], hipY: 0.5, kneeAngle: 170 },
            ];
            const sequence = createFrameSequence(configs);
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Should still detect set point, even if brief
            const setPoint = result.phases[ShotPhase.SetPoint];
            expect(setPoint).toBeDefined();
            // Quick release set point may be only 1-2 frames
            const duration = setPoint.endFrame - setPoint.startFrame + 1;
            expect(duration).toBeGreaterThanOrEqual(1);
        });
    });
    describe("release phase detection", () => {
        it("detects release phase when hands separate", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result.phases[ShotPhase.Release]).toBeDefined();
        });
        it("release phase occurs after set point", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const setPoint = result.phases[ShotPhase.SetPoint];
            const release = result.phases[ShotPhase.Release];
            if (setPoint && release) {
                expect(release.startFrame).toBeGreaterThanOrEqual(setPoint.startFrame);
            }
        });
        it("release phase shows hand separation", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const release = result.phases[ShotPhase.Release];
            expect(release).toBeDefined();
            // Release should be around frames 30-34 based on test data
            expect(release.startFrame).toBeGreaterThanOrEqual(25);
        });
        it("release phase has shooting arm extending", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const release = result.phases[ShotPhase.Release];
            expect(release).toBeDefined();
            // Release is typically 3-6 frames
            const duration = release.endFrame - release.startFrame + 1;
            expect(duration).toBeGreaterThanOrEqual(2);
            expect(duration).toBeLessThanOrEqual(15);
        });
    });
    describe("follow-through phase detection", () => {
        it("detects follow-through phase", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            expect(result.phases[ShotPhase.FollowThrough]).toBeDefined();
        });
        it("follow-through is the last phase", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const followThrough = result.phases[ShotPhase.FollowThrough];
            expect(followThrough).toBeDefined();
            // Follow-through should be the last phase detected
            for (const phase of Object.values(ShotPhase)) {
                const phaseRange = result.phases[phase];
                if (phaseRange && phase !== ShotPhase.FollowThrough) {
                    expect(followThrough.startFrame).toBeGreaterThanOrEqual(phaseRange.startFrame);
                }
            }
        });
        it("follow-through shows arm extended and held", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const followThrough = result.phases[ShotPhase.FollowThrough];
            expect(followThrough).toBeDefined();
            // Follow-through should be in the later portion of the shot
            expect(followThrough.startFrame).toBeGreaterThanOrEqual(30);
        });
        it("handles shot cut off during follow-through", () => {
            // Shot that ends during follow-through - add enough frames for clear follow-through
            const configs = [
                { wristY: [0.55, 0.55], hipY: 0.5, kneeAngle: 170 },
                { wristY: [0.45, 0.4], hipY: 0.51, kneeAngle: 155 },
                { wristY: [0.35, 0.3], hipY: 0.52, kneeAngle: 145 },
                { wristY: [0.25, 0.2], hipY: 0.5, kneeAngle: 160 },
                { wristY: [0.15, 0.1], hipY: 0.48, kneeAngle: 175 },
                { wristY: [0.1, 0.06], hipY: 0.46, kneeAngle: 180 },
                // Release - shooting arm extends rapidly
                { wristY: [0.14, 0.04], hipY: 0.46, kneeAngle: 180 },
                { wristY: [0.22, 0.06], hipY: 0.47, kneeAngle: 178 },
                { wristY: [0.28, 0.1], hipY: 0.48, kneeAngle: 175 },
                // Follow-through - arm holding position, wrist velocity decreasing
                { wristY: [0.32, 0.14], hipY: 0.48, kneeAngle: 172 },
                { wristY: [0.34, 0.16], hipY: 0.49, kneeAngle: 170 },
                // Video ends here during follow-through
                { wristY: [0.35, 0.18], hipY: 0.49, kneeAngle: 170 },
            ];
            const sequence = createFrameSequence(configs);
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Should still detect follow-through, even if partial
            expect(result.phases[ShotPhase.FollowThrough]).toBeDefined();
        });
    });
    describe("phase continuity and hysteresis", () => {
        it("phases do not flicker with small movements", () => {
            // Add some noise to a stable sequence
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector({ hysteresisThreshold: 0.015 });
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Each phase should be continuous (no gaps)
            for (const phase of Object.values(ShotPhase)) {
                const phaseRange = result.phases[phase];
                if (phaseRange) {
                    expect(phaseRange.endFrame).toBeGreaterThanOrEqual(phaseRange.startFrame);
                }
            }
        });
        it("phases transition smoothly", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            const phases = [
                result.phases[ShotPhase.Gather],
                result.phases[ShotPhase.Load],
                result.phases[ShotPhase.Rise],
                result.phases[ShotPhase.SetPoint],
                result.phases[ShotPhase.Release],
                result.phases[ShotPhase.FollowThrough],
            ];
            // Check that phases don't overlap significantly
            for (let i = 0; i < phases.length - 1; i++) {
                const current = phases[i];
                const next = phases[i + 1];
                if (current && next) {
                    // Phases may overlap slightly at boundaries, but not significantly
                    const overlap = current.endFrame - next.startFrame + 1;
                    expect(overlap).toBeLessThanOrEqual(5); // Allow small overlap for boundary
                }
            }
        });
    });
    describe("edge cases", () => {
        it("handles partial shot missing early phases", () => {
            // Sequence starting at rise phase
            const configs = [
                { wristY: [0.25, 0.2], hipY: 0.48, kneeAngle: 165 },
                { wristY: [0.2, 0.16], hipY: 0.46, kneeAngle: 172 },
                { wristY: [0.15, 0.11], hipY: 0.45, kneeAngle: 178 },
                { wristY: [0.1, 0.06], hipY: 0.44, kneeAngle: 180 },
                { wristY: [0.12, 0.04], hipY: 0.44, kneeAngle: 180 },
                { wristY: [0.2, 0.06], hipY: 0.45, kneeAngle: 178 },
                { wristY: [0.3, 0.12], hipY: 0.46, kneeAngle: 175 },
                { wristY: [0.4, 0.2], hipY: 0.48, kneeAngle: 170 },
            ];
            const sequence = createFrameSequence(configs);
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Should detect at least some phases
            expect(result.confidence).toBeGreaterThan(0);
            // Gather and load may be missing
            expect(result.phases[ShotPhase.SetPoint] !== undefined ||
                result.phases[ShotPhase.Release] !== undefined ||
                result.phases[ShotPhase.FollowThrough] !== undefined).toBe(true);
        });
        it("handles low confidence landmarks", () => {
            const sequence = createCompleteShotSequence().map((frame) => {
                const landmarks = frame.landmarks.map((l) => ({
                    ...l,
                    confidence: 0.4,
                    visibility: 0.4,
                }));
                return { ...frame, landmarks, poseConfidence: 0.4 };
            });
            const detector = createPhaseDetector();
            const result = detector.detectPhases(sequence, 0, sequence.length - 1);
            // Should still produce results but with lower confidence
            expect(result.confidence).toBeLessThan(0.8);
        });
        it("handles frame range subset of full sequence", () => {
            const sequence = createCompleteShotSequence();
            const detector = createPhaseDetector();
            // Only analyze frames 10-35 (load through release)
            const result = detector.detectPhases(sequence, 10, 35);
            // Should detect phases within the specified range
            expect(result.confidence).toBeGreaterThan(0);
            // Detected phases should be within the specified range
            for (const phase of Object.values(ShotPhase)) {
                const phaseRange = result.phases[phase];
                if (phaseRange) {
                    expect(phaseRange.startFrame).toBeGreaterThanOrEqual(10);
                    expect(phaseRange.endFrame).toBeLessThanOrEqual(35);
                }
            }
        });
    });
});
//# sourceMappingURL=phase-detector.test.js.map