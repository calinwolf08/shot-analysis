/**
 * Tests for detection execution and comparison functions.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 * @see Task 9.2 - Detection Execution & Comparison
 */
import { describe, it, expect } from "vitest";
import { adaptPoseDataToDetector, detectOrientation, runDetection, compareResults, runAndCompare, } from "./detection";
// ============================================================================
// Test Helpers
// ============================================================================
/**
 * Creates a test landmark with default values.
 */
function createTestLandmark(x, y, z = 0, visibility = 0.99) {
    return { x, y, z, visibility };
}
/**
 * Creates an array of 33 default landmarks.
 */
function createDefaultLandmarks() {
    return Array.from({ length: 33 }, () => createTestLandmark(0.5, 0.5, 0, 0.99));
}
/**
 * Creates a test frame with specified wrist Y positions.
 */
function createFrameWithWrists(frameIndex, leftWristY, rightWristY, options = {}) {
    const landmarks = createDefaultLandmarks();
    // Set wrists (15 = left, 16 = right)
    landmarks[15] = createTestLandmark(0.3, leftWristY);
    landmarks[16] = createTestLandmark(0.7, rightWristY);
    // Set shoulders for arm return detection (11 = left, 12 = right)
    landmarks[11] = createTestLandmark(options.leftShoulderX ?? 0.35, 0.3, options.shoulderZ ?? 0);
    landmarks[12] = createTestLandmark(options.rightShoulderX ?? 0.65, 0.3, -(options.shoulderZ ?? 0));
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
function createPoseData(frames) {
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
 * Creates minimal LabelData for testing.
 */
function createLabelData(shots, orientation = "front") {
    return {
        video: "test-video.mp4",
        labeledBy: "test",
        labeledAt: new Date().toISOString(),
        orientation,
        shots: shots.map((shot, index) => ({
            shotNumber: index + 1,
            startFrame: shot.startFrame,
            endFrame: shot.endFrame,
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
        expect(result).toHaveLength(2);
        expect(result[0].landmarks).toHaveLength(33);
        expect(result[0].poseConfidence).toBe(0.95);
    });
    it("adds confidence property to landmarks", () => {
        const frames = [createFrameWithWrists(0, 0.5, 0.5)];
        const poseData = createPoseData(frames);
        const result = adaptPoseDataToDetector(poseData);
        // Test landmarks now have confidence (same as visibility)
        const landmark = result[0].landmarks[0];
        expect(landmark).toHaveProperty("confidence");
        expect(landmark.confidence).toBe(landmark.visibility);
    });
    it("handles empty frames array", () => {
        const poseData = createPoseData([]);
        const result = adaptPoseDataToDetector(poseData);
        expect(result).toHaveLength(0);
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
    it("returns 'unknown' for too few frames", () => {
        const frames = [
            createFrameWithWrists(0, 0.5, 0.5),
            createFrameWithWrists(1, 0.5, 0.5),
        ];
        const poseData = createPoseData(frames);
        expect(detectOrientation(poseData)).toBe("unknown");
    });
    it("detects 'front' orientation with clear shoulder separation", () => {
        // Create frames with shoulders clearly separated (left at 0.3, right at 0.7)
        const frames = [];
        for (let i = 0; i < 30; i++) {
            frames.push(createFrameWithWrists(i, 0.5, 0.5, {
                leftShoulderX: 0.3,
                rightShoulderX: 0.7,
                leftHipX: 0.35,
                rightHipX: 0.65,
            }));
        }
        const poseData = createPoseData(frames);
        expect(detectOrientation(poseData)).toBe("front");
    });
    it("detects 'side-left' orientation with aligned shoulders and depth difference", () => {
        // Create frames with shoulders nearly aligned in X but different Z
        const frames = [];
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
        const frames = [];
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
    it("passes with diff <= 3 (base tolerance)", () => {
        const detection = {
            shots: [{ startFrame: 10, endFrame: 50 }],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 12, endFrame: 48 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("pass");
        expect(result.shots[0].startFrame.diff).toBe(2);
        expect(result.shots[0].endFrame.diff).toBe(2);
    });
    it("fails with diff > 5 even with expansion", () => {
        const detection = {
            shots: [{ startFrame: 10, endFrame: 50 }],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 57 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.shots[0].endFrame.diff).toBe(7);
        expect(result.shots[0].endFrame.pass).toBe(false);
    });
    it("expands tolerance when diff is exactly 4", () => {
        // Diff of 4 should trigger expansion to ±5
        const detection = {
            shots: [{ startFrame: 10, endFrame: 54 }],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("pass");
        expect(result.shots[0].endFrame.diff).toBe(4);
        expect(result.shots[0].endFrame.pass).toBe(true);
    });
    it("passes with diff of 5 when tolerance is expanded", () => {
        // Diff of 4 triggers expansion, then diff of 5 should pass
        const detection = {
            shots: [{ startFrame: 14, endFrame: 55 }], // start diff = 4, end diff = 5
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("pass");
        expect(result.shots[0].startFrame.diff).toBe(4);
        expect(result.shots[0].endFrame.diff).toBe(5);
    });
    it("does not expand tolerance if no diff is exactly 4", () => {
        // Diff of 5 without a 4 should fail
        const detection = {
            shots: [{ startFrame: 10, endFrame: 55 }],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.shots[0].endFrame.diff).toBe(5);
        expect(result.shots[0].endFrame.pass).toBe(false);
    });
});
// ============================================================================
// Tests: Shot Count Mismatch
// ============================================================================
describe("compareResults - shot count mismatch", () => {
    it("fails when no shots detected", () => {
        const detection = {
            shots: [],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.failureReason).toBe("no shots detected");
        expect(result.shots).toHaveLength(0);
    });
    it("fails when detected more shots than labeled", () => {
        const detection = {
            shots: [
                { startFrame: 10, endFrame: 50 },
                { startFrame: 60, endFrame: 100 },
            ],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.failureReason).toContain("shot count mismatch");
        expect(result.failureReason).toContain("detected 2, expected 1");
    });
    it("fails when detected fewer shots than labeled", () => {
        const detection = {
            shots: [{ startFrame: 10, endFrame: 50 }],
            orientation: "front",
        };
        const labels = createLabelData([
            { startFrame: 10, endFrame: 50 },
            { startFrame: 60, endFrame: 100 },
        ], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.failureReason).toContain("shot count mismatch");
        expect(result.failureReason).toContain("detected 1, expected 2");
    });
});
// ============================================================================
// Tests: Orientation Mismatch
// ============================================================================
describe("compareResults - orientation mismatch", () => {
    it("fails when orientation does not match", () => {
        const detection = {
            shots: [{ startFrame: 10, endFrame: 50 }],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "side-left");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.orientation.match).toBe(false);
        expect(result.orientation.detected).toBe("front");
        expect(result.orientation.expected).toBe("side-left");
        expect(result.failureReason).toContain("orientation mismatch");
    });
    it("fails when orientation is unknown", () => {
        const detection = {
            shots: [{ startFrame: 10, endFrame: 50 }],
            orientation: "unknown",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.orientation.match).toBe(false);
        expect(result.failureReason).toContain("orientation mismatch");
    });
    it("passes when orientation matches", () => {
        const detection = {
            shots: [{ startFrame: 10, endFrame: 50 }],
            orientation: "front",
        };
        const labels = createLabelData([{ startFrame: 10, endFrame: 50 }], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("pass");
        expect(result.orientation.match).toBe(true);
    });
});
// ============================================================================
// Tests: Multiple Shots
// ============================================================================
describe("compareResults - multiple shots", () => {
    it("passes when all shots are within tolerance", () => {
        const detection = {
            shots: [
                { startFrame: 11, endFrame: 48 },
                { startFrame: 61, endFrame: 99 },
            ],
            orientation: "front",
        };
        const labels = createLabelData([
            { startFrame: 10, endFrame: 50 },
            { startFrame: 60, endFrame: 100 },
        ], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("pass");
        expect(result.shots).toHaveLength(2);
        expect(result.shots[0].startFrame.pass).toBe(true);
        expect(result.shots[0].endFrame.pass).toBe(true);
        expect(result.shots[1].startFrame.pass).toBe(true);
        expect(result.shots[1].endFrame.pass).toBe(true);
    });
    it("fails if any shot frame exceeds tolerance", () => {
        const detection = {
            shots: [
                { startFrame: 10, endFrame: 50 },
                { startFrame: 60, endFrame: 110 }, // end diff = 10
            ],
            orientation: "front",
        };
        const labels = createLabelData([
            { startFrame: 10, endFrame: 50 },
            { startFrame: 60, endFrame: 100 },
        ], "front");
        const result = compareResults(detection, labels);
        expect(result.status).toBe("fail");
        expect(result.shots[0].startFrame.pass).toBe(true);
        expect(result.shots[1].endFrame.pass).toBe(false);
        expect(result.shots[1].endFrame.diff).toBe(10);
    });
});
// ============================================================================
// Tests: runAndCompare Integration
// ============================================================================
describe("runAndCompare", () => {
    it("runs detection and comparison in one call", () => {
        // This test just verifies the function works without testing actual detection
        const frames = [];
        for (let i = 0; i < 30; i++) {
            frames.push(createFrameWithWrists(i, 0.5, 0.5));
        }
        const poseData = createPoseData(frames);
        const labels = createLabelData([{ startFrame: 10, endFrame: 20 }], "front");
        // runAndCompare should return a ComparisonResult
        const result = runAndCompare(poseData, labels);
        expect(result).toHaveProperty("video");
        expect(result).toHaveProperty("status");
        expect(result).toHaveProperty("orientation");
        expect(result).toHaveProperty("shots");
    });
});
// ============================================================================
// Tests: runDetection
// ============================================================================
describe("runDetection", () => {
    it("returns DetectionResult structure", () => {
        const frames = [];
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
        const frames = [];
        for (let i = 0; i < 30; i++) {
            frames.push(createFrameWithWrists(i, 0.5, 0.5));
        }
        const poseData = createPoseData(frames);
        const result = runDetection(poseData);
        expect(result.shots).toHaveLength(0);
    });
});
//# sourceMappingURL=detection.test.js.map