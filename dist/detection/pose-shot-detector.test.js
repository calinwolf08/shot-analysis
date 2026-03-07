/**
 * Unit tests for pose-based shot detector.
 *
 * @see Feature 10.0 - Algorithm Iteration
 * @see Task 10.1 - Shot Boundary Detection Algorithm
 */
import { describe, it, expect } from "vitest";
import { calculateKneeAngle, detectShots, detectOrientation, createPoseShotDetector, } from "./pose-shot-detector";
import { LANDMARK_INDEX } from "../pose/types";
// ============================================================================
// Test Helpers
// ============================================================================
/**
 * Creates a test landmark with the given position.
 */
function createLandmark(x, y, z = 0, visibility = 0.95) {
    return { x, y, z, visibility };
}
/**
 * Creates 33 default landmarks at neutral positions.
 */
function createDefaultLandmarks() {
    const landmarks = [];
    for (let i = 0; i < 33; i++) {
        landmarks.push(createLandmark(0.5, 0.5, 0));
    }
    return landmarks;
}
/**
 * Creates a frame with the given landmarks and confidence.
 */
function createFrame(frameIndex, landmarks, poseConfidence = 0.95) {
    return {
        frameIndex,
        timestamp: frameIndex / 30,
        poseConfidence,
        landmarks,
    };
}
/**
 * Creates a PoseData object with the given frames.
 */
function createPoseData(frames) {
    return {
        video: "test.mp4",
        fps: 30,
        totalFrames: frames.length,
        width: 1920,
        height: 1080,
        extractedAt: new Date().toISOString(),
        frames,
    };
}
/**
 * Creates landmarks for a standing pose.
 */
function createStandingLandmarks() {
    const landmarks = createDefaultLandmarks();
    // Shoulders
    landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.4, 0.3);
    landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.6, 0.3);
    // Hips
    landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, 0.55);
    landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, 0.55);
    // Knees (straight legs = 180 degrees)
    landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.45, 0.75);
    landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.55, 0.75);
    // Ankles
    landmarks[LANDMARK_INDEX.LEFT_ANKLE] = createLandmark(0.45, 0.95);
    landmarks[LANDMARK_INDEX.RIGHT_ANKLE] = createLandmark(0.55, 0.95);
    // Wrists at neutral
    landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.35, 0.5);
    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.65, 0.5);
    return landmarks;
}
/**
 * Creates landmarks for a shooting pose (wrists above shoulders).
 */
function createShootingLandmarks() {
    const landmarks = createStandingLandmarks();
    // Wrists raised high
    landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.45, 0.1);
    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.55, 0.1);
    return landmarks;
}
/**
 * Creates a complete shot sequence.
 */
function createShotSequence() {
    const frames = [];
    // Phase 1: Standing (frames 0-9)
    for (let i = 0; i < 10; i++) {
        frames.push(createFrame(i, createStandingLandmarks()));
    }
    // Phase 2: Loading (frames 10-19) - knees bend, hips drop
    for (let i = 10; i < 20; i++) {
        const landmarks = createStandingLandmarks();
        const progress = (i - 10) / 10;
        // Hips drop
        landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, 0.55 + progress * 0.05);
        landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, 0.55 + progress * 0.05);
        // Knees bend
        landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.42 - progress * 0.03, 0.75);
        landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.58 + progress * 0.03, 0.75);
        // Ball starts to come up
        const wristY = 0.5 - progress * 0.1;
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.4, wristY);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.6, wristY);
        frames.push(createFrame(i, landmarks));
    }
    // Phase 3: Rise (frames 20-34) - wrists rise, body extends
    for (let i = 20; i < 35; i++) {
        const landmarks = createStandingLandmarks();
        const progress = (i - 20) / 15;
        // Body extends back up
        landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, 0.6 - progress * 0.05);
        landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, 0.6 - progress * 0.05);
        // Wrists rise high
        const wristY = 0.4 - progress * 0.35;
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.45, wristY);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.55, wristY);
        frames.push(createFrame(i, landmarks));
    }
    // Phase 4: Peak / Release (frames 35-44) - wrists at max height then start to drop
    for (let i = 35; i < 45; i++) {
        const landmarks = createStandingLandmarks();
        const progress = (i - 35) / 10;
        // Wrists at peak then dropping
        const wristY = 0.05 + progress * 0.15;
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.45, wristY);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.55, wristY);
        frames.push(createFrame(i, landmarks));
    }
    // Phase 5: Follow-through / Landing (frames 45-59) - wrists return
    for (let i = 45; i < 60; i++) {
        const landmarks = createStandingLandmarks();
        const progress = (i - 45) / 15;
        // Wrists returning to neutral
        const wristY = 0.2 + progress * 0.3;
        landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.4, wristY);
        landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.6, wristY);
        frames.push(createFrame(i, landmarks));
    }
    return frames;
}
// ============================================================================
// Tests
// ============================================================================
describe("calculateKneeAngle", () => {
    it("returns 180 degrees for a straight leg", () => {
        const hip = { x: 0.5, y: 0.5, z: 0 };
        const knee = { x: 0.5, y: 0.75, z: 0 };
        const ankle = { x: 0.5, y: 1.0, z: 0 };
        const angle = calculateKneeAngle(hip, knee, ankle);
        expect(angle).toBeCloseTo(180, 0);
    });
    it("returns 90 degrees for a right angle", () => {
        const hip = { x: 0.5, y: 0.5, z: 0 };
        const knee = { x: 0.5, y: 0.75, z: 0 };
        const ankle = { x: 0.75, y: 0.75, z: 0 };
        const angle = calculateKneeAngle(hip, knee, ankle);
        expect(angle).toBeCloseTo(90, 0);
    });
    it("returns angle < 180 for bent knee", () => {
        const hip = { x: 0.5, y: 0.5, z: 0 };
        const knee = { x: 0.45, y: 0.75, z: 0 };
        const ankle = { x: 0.5, y: 1.0, z: 0 };
        const angle = calculateKneeAngle(hip, knee, ankle);
        expect(angle).toBeLessThan(180);
        expect(angle).toBeGreaterThan(90);
    });
    it("handles 3D points", () => {
        const hip = { x: 0.5, y: 0.5, z: 0.1 };
        const knee = { x: 0.5, y: 0.75, z: 0 };
        const ankle = { x: 0.5, y: 1.0, z: -0.1 };
        const angle = calculateKneeAngle(hip, knee, ankle);
        expect(angle).toBeLessThan(180);
        expect(angle).toBeGreaterThan(150);
    });
});
describe("detectOrientation", () => {
    it("returns 'unknown' for empty pose data", () => {
        const poseData = createPoseData([]);
        const orientation = detectOrientation(poseData);
        expect(orientation).toBe("unknown");
    });
    it("returns 'front' for front-facing pose", () => {
        const frames = [];
        for (let i = 0; i < 20; i++) {
            const landmarks = createStandingLandmarks();
            // Front view: left shoulder clearly left of right shoulder
            landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.3, 0.3, 0);
            landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.7, 0.3, 0);
            landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.35, 0.55, 0);
            landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.65, 0.55, 0);
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        const orientation = detectOrientation(poseData);
        expect(orientation).toBe("front");
    });
    it("returns 'side-left' for left-side view", () => {
        const frames = [];
        for (let i = 0; i < 20; i++) {
            const landmarks = createStandingLandmarks();
            // Side view: shoulders close together in X, left side closer (lower z)
            landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.5, 0.3, -0.1);
            landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.52, 0.3, 0.1);
            landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.5, 0.55, -0.1);
            landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.52, 0.55, 0.1);
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        const orientation = detectOrientation(poseData);
        expect(orientation).toBe("side-left");
    });
    it("returns 'side-right' for right-side view", () => {
        const frames = [];
        for (let i = 0; i < 20; i++) {
            const landmarks = createStandingLandmarks();
            // Side view: shoulders close together in X, right side closer (lower z)
            landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.52, 0.3, 0.1);
            landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.5, 0.3, -0.1);
            landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.52, 0.55, 0.1);
            landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.5, 0.55, -0.1);
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        const orientation = detectOrientation(poseData);
        expect(orientation).toBe("side-right");
    });
    it("returns 'unknown' with low visibility landmarks", () => {
        const frames = [];
        for (let i = 0; i < 20; i++) {
            const landmarks = createStandingLandmarks();
            // Very low visibility
            landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.3, 0.3, 0, 0.1);
            landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.7, 0.3, 0, 0.1);
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        const orientation = detectOrientation(poseData);
        expect(orientation).toBe("unknown");
    });
});
describe("detectShots", () => {
    it("returns empty array for empty pose data", () => {
        const poseData = createPoseData([]);
        const result = detectShots(poseData);
        expect(result.shots).toEqual([]);
    });
    it("returns empty array for static pose data (no shot motion)", () => {
        const frames = [];
        for (let i = 0; i < 50; i++) {
            frames.push(createFrame(i, createStandingLandmarks()));
        }
        const poseData = createPoseData(frames);
        const result = detectShots(poseData);
        expect(result.shots).toEqual([]);
    });
    it("detects a single shot from a complete sequence", () => {
        const frames = createShotSequence();
        const poseData = createPoseData(frames);
        const result = detectShots(poseData);
        expect(result.shots.length).toBe(1);
        expect(result.shots[0].startFrame).toBeLessThan(result.shots[0].endFrame);
    });
    it("returns orientation with detection result", () => {
        const frames = createShotSequence();
        const poseData = createPoseData(frames);
        const result = detectShots(poseData);
        expect(["front", "side-left", "side-right", "front-left", "front-right", "unknown"]).toContain(result.orientation);
    });
    it("respects minimum shot duration", () => {
        // Very short motion that shouldn't be detected
        const frames = [];
        for (let i = 0; i < 10; i++) {
            const landmarks = createStandingLandmarks();
            if (i >= 3 && i < 8) {
                landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.45, 0.1);
                landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.55, 0.1);
            }
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        const result = detectShots(poseData, { minShotDuration: 15 });
        expect(result.shots).toEqual([]);
    });
    it("handles poor pose confidence frames", () => {
        const frames = createShotSequence();
        // Make some frames have very low confidence
        for (let i = 25; i < 30; i++) {
            const oldFrame = frames[i];
            frames[i] = createFrame(i, [...oldFrame.landmarks], 0.1);
        }
        const poseData = createPoseData(frames);
        // Should not throw and should still try to detect
        expect(() => detectShots(poseData)).not.toThrow();
    });
    it("includes confidence score in detected shots", () => {
        const frames = createShotSequence();
        const poseData = createPoseData(frames);
        const result = detectShots(poseData);
        if (result.shots.length > 0) {
            expect(result.shots[0].confidence).toBeGreaterThanOrEqual(0);
            expect(result.shots[0].confidence).toBeLessThanOrEqual(1);
        }
    });
});
describe("createPoseShotDetector", () => {
    it("creates a detector function", () => {
        const detector = createPoseShotDetector();
        expect(typeof detector).toBe("function");
    });
    it("detector function accepts pose data and returns result", () => {
        const detector = createPoseShotDetector();
        const frames = createShotSequence();
        const poseData = createPoseData(frames);
        const result = detector(poseData);
        expect(result).toHaveProperty("shots");
        expect(result).toHaveProperty("orientation");
    });
    it("accepts custom configuration", () => {
        const detector = createPoseShotDetector({
            minShotDuration: 20,
            maxShotDuration: 60,
        });
        const frames = createShotSequence();
        const poseData = createPoseData(frames);
        // Should not throw
        expect(() => detector(poseData)).not.toThrow();
    });
});
describe("edge cases", () => {
    it("handles very short video (< minimum shot duration)", () => {
        const frames = [];
        for (let i = 0; i < 5; i++) {
            frames.push(createFrame(i, createShootingLandmarks()));
        }
        const poseData = createPoseData(frames);
        const result = detectShots(poseData);
        expect(result.shots).toEqual([]);
    });
    it("handles video with missing landmarks", () => {
        const frames = [];
        for (let i = 0; i < 30; i++) {
            const landmarks = createDefaultLandmarks();
            // Some landmarks have low visibility (missing)
            landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.5, 0.75, 0, 0.1);
            landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.5, 0.75, 0, 0.1);
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        // Should not throw
        expect(() => detectShots(poseData)).not.toThrow();
    });
    it("handles partial shot at end of video", () => {
        // Create frames that start rising but video ends
        const frames = [];
        for (let i = 0; i < 30; i++) {
            const landmarks = createStandingLandmarks();
            if (i >= 10) {
                const progress = (i - 10) / 20;
                landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.45, 0.5 - progress * 0.4);
                landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.55, 0.5 - progress * 0.4);
            }
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        // Should handle gracefully
        expect(() => detectShots(poseData)).not.toThrow();
    });
    it("handles noisy data (jittery landmarks)", () => {
        const frames = [];
        for (let i = 0; i < 50; i++) {
            const landmarks = createStandingLandmarks();
            // Add random noise
            const noise = (Math.random() - 0.5) * 0.05;
            landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.45 + noise, 0.5 + noise);
            landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.55 + noise, 0.5 + noise);
            frames.push(createFrame(i, landmarks));
        }
        const poseData = createPoseData(frames);
        // Should not throw and should handle noise via smoothing
        expect(() => detectShots(poseData)).not.toThrow();
    });
});
//# sourceMappingURL=pose-shot-detector.test.js.map