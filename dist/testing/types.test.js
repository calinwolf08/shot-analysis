/**
 * Unit tests for testing/types.ts
 */
import { describe, it, expect } from "vitest";
import { orientationSchema, testLandmarkSchema, frameSchema, poseDataSchema, labeledShotSchema, labelDataSchema, isPoseData, isLabelData, keyframeFieldSchema, KEYFRAME_IDS, } from "./types";
describe("orientationSchema", () => {
    it("accepts valid orientations", () => {
        expect(orientationSchema.safeParse("front").success).toBe(true);
        expect(orientationSchema.safeParse("side-left").success).toBe(true);
        expect(orientationSchema.safeParse("side-right").success).toBe(true);
        expect(orientationSchema.safeParse("front-left").success).toBe(true);
        expect(orientationSchema.safeParse("front-right").success).toBe(true);
    });
    it("rejects invalid orientations", () => {
        expect(orientationSchema.safeParse("back").success).toBe(false);
        expect(orientationSchema.safeParse("top").success).toBe(false);
        expect(orientationSchema.safeParse("").success).toBe(false);
        expect(orientationSchema.safeParse(123).success).toBe(false);
    });
});
describe("testLandmarkSchema", () => {
    it("accepts valid landmark", () => {
        const landmark = { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 };
        const result = testLandmarkSchema.safeParse(landmark);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual(landmark);
        }
    });
    it("accepts edge case values", () => {
        const landmark = { x: 0, y: 1, z: -0.5, visibility: 0 };
        expect(testLandmarkSchema.safeParse(landmark).success).toBe(true);
    });
    it("rejects visibility > 1", () => {
        const landmark = { x: 0.5, y: 0.5, z: 0.1, visibility: 1.5 };
        expect(testLandmarkSchema.safeParse(landmark).success).toBe(false);
    });
    it("rejects visibility < 0", () => {
        const landmark = { x: 0.5, y: 0.5, z: 0.1, visibility: -0.1 };
        expect(testLandmarkSchema.safeParse(landmark).success).toBe(false);
    });
    it("rejects missing fields", () => {
        expect(testLandmarkSchema.safeParse({ x: 0.5, y: 0.5 }).success).toBe(false);
        expect(testLandmarkSchema.safeParse({}).success).toBe(false);
    });
});
describe("frameSchema", () => {
    const validLandmark = { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 };
    it("accepts valid frame", () => {
        const frame = {
            frameIndex: 0,
            timestamp: 0.0,
            poseConfidence: 0.95,
            landmarks: [validLandmark],
        };
        const result = frameSchema.safeParse(frame);
        expect(result.success).toBe(true);
    });
    it("rejects negative frameIndex", () => {
        const frame = {
            frameIndex: -1,
            timestamp: 0.0,
            poseConfidence: 0.95,
            landmarks: [],
        };
        expect(frameSchema.safeParse(frame).success).toBe(false);
    });
    it("rejects non-integer frameIndex", () => {
        const frame = {
            frameIndex: 1.5,
            timestamp: 0.0,
            poseConfidence: 0.95,
            landmarks: [],
        };
        expect(frameSchema.safeParse(frame).success).toBe(false);
    });
    it("rejects poseConfidence > 1", () => {
        const frame = {
            frameIndex: 0,
            timestamp: 0.0,
            poseConfidence: 1.5,
            landmarks: [],
        };
        expect(frameSchema.safeParse(frame).success).toBe(false);
    });
});
describe("poseDataSchema", () => {
    const validFrame = {
        frameIndex: 0,
        timestamp: 0.0,
        poseConfidence: 0.95,
        landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }],
    };
    it("accepts valid pose data", () => {
        const poseData = {
            video: "test-video.mp4",
            fps: 30,
            totalFrames: 100,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [validFrame],
        };
        const result = poseDataSchema.safeParse(poseData);
        expect(result.success).toBe(true);
    });
    it("accepts empty frames array", () => {
        const poseData = {
            video: "test-video.mp4",
            fps: 30,
            totalFrames: 0,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [],
        };
        expect(poseDataSchema.safeParse(poseData).success).toBe(true);
    });
    it("rejects empty video name", () => {
        const poseData = {
            video: "",
            fps: 30,
            totalFrames: 100,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [],
        };
        expect(poseDataSchema.safeParse(poseData).success).toBe(false);
    });
    it("rejects non-positive fps", () => {
        const poseData = {
            video: "test.mp4",
            fps: 0,
            totalFrames: 100,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [],
        };
        expect(poseDataSchema.safeParse(poseData).success).toBe(false);
    });
    it("rejects negative width", () => {
        const poseData = {
            video: "test.mp4",
            fps: 30,
            totalFrames: 100,
            width: -1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [],
        };
        expect(poseDataSchema.safeParse(poseData).success).toBe(false);
    });
});
describe("keyframeFieldSchema", () => {
    it("accepts valid non-negative integer", () => {
        expect(keyframeFieldSchema.safeParse(0).success).toBe(true);
        expect(keyframeFieldSchema.safeParse(100).success).toBe(true);
        expect(keyframeFieldSchema.safeParse(999).success).toBe(true);
    });
    it("accepts null (not labeled)", () => {
        expect(keyframeFieldSchema.safeParse(null).success).toBe(true);
    });
    it("accepts undefined (field omitted)", () => {
        expect(keyframeFieldSchema.safeParse(undefined).success).toBe(true);
    });
    it("rejects negative frame numbers", () => {
        expect(keyframeFieldSchema.safeParse(-1).success).toBe(false);
        expect(keyframeFieldSchema.safeParse(-100).success).toBe(false);
    });
    it("rejects non-integer frame numbers", () => {
        expect(keyframeFieldSchema.safeParse(10.5).success).toBe(false);
        expect(keyframeFieldSchema.safeParse(0.1).success).toBe(false);
    });
    it("rejects non-numeric values", () => {
        expect(keyframeFieldSchema.safeParse("10").success).toBe(false);
        expect(keyframeFieldSchema.safeParse({}).success).toBe(false);
    });
});
describe("KEYFRAME_IDS", () => {
    it("contains exactly 10 keyframe IDs in order", () => {
        expect(KEYFRAME_IDS).toHaveLength(10);
        expect(KEYFRAME_IDS[0]).toBe("legs_start_bending");
        expect(KEYFRAME_IDS[9]).toBe("feet_land");
    });
    it("contains all expected keyframe IDs", () => {
        expect(KEYFRAME_IDS).toContain("legs_start_bending");
        expect(KEYFRAME_IDS).toContain("leg_bend_low_point");
        expect(KEYFRAME_IDS).toContain("ball_low_point");
        expect(KEYFRAME_IDS).toContain("legs_start_extending");
        expect(KEYFRAME_IDS).toContain("ball_starts_upward");
        expect(KEYFRAME_IDS).toContain("set_point");
        expect(KEYFRAME_IDS).toContain("release");
        expect(KEYFRAME_IDS).toContain("arms_fully_extended");
        expect(KEYFRAME_IDS).toContain("feet_leave_ground");
        expect(KEYFRAME_IDS).toContain("feet_land");
    });
});
describe("labeledShotSchema", () => {
    it("accepts valid labeled shot with cameraOrientation", () => {
        const shot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
        };
        const result = labeledShotSchema.safeParse(shot);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.shotNumber).toBe(1);
            expect(result.data.startFrame).toBe(10);
            expect(result.data.endFrame).toBe(50);
            expect(result.data.cameraOrientation).toBe("front");
        }
    });
    it("rejects non-positive shotNumber", () => {
        expect(labeledShotSchema.safeParse({
            shotNumber: 0,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
        }).success).toBe(false);
        expect(labeledShotSchema.safeParse({
            shotNumber: -1,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
        }).success).toBe(false);
    });
    it("rejects negative frame indices", () => {
        expect(labeledShotSchema.safeParse({
            shotNumber: 1,
            startFrame: -1,
            endFrame: 50,
            cameraOrientation: "front",
        }).success).toBe(false);
    });
    // Keyframe field tests
    it("accepts shot with all keyframe fields as integers", () => {
        const shot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 100,
            cameraOrientation: "front",
            legs_start_bending: 10,
            leg_bend_low_point: 20,
            ball_low_point: 25,
            legs_start_extending: 30,
            ball_starts_upward: 35,
            set_point: 50,
            release: 60,
            arms_fully_extended: 70,
            feet_leave_ground: 40,
            feet_land: 100,
        };
        const result = labeledShotSchema.safeParse(shot);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.legs_start_bending).toBe(10);
            expect(result.data.release).toBe(60);
            expect(result.data.feet_land).toBe(100);
        }
    });
    it("accepts shot with keyframe fields as null (not labeled)", () => {
        const shot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 100,
            cameraOrientation: "front",
            legs_start_bending: null,
            leg_bend_low_point: null,
            ball_low_point: null,
            legs_start_extending: null,
            ball_starts_upward: null,
            set_point: null,
            release: null,
            arms_fully_extended: null,
            feet_leave_ground: null,
            feet_land: null,
        };
        const result = labeledShotSchema.safeParse(shot);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.legs_start_bending).toBeNull();
            expect(result.data.release).toBeNull();
        }
    });
    it("accepts shot without keyframe fields (backward compatibility)", () => {
        const legacyShot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
        };
        const result = labeledShotSchema.safeParse(legacyShot);
        expect(result.success).toBe(true);
        if (result.success) {
            // Optional fields should be undefined
            expect(result.data.legs_start_bending).toBeUndefined();
            expect(result.data.release).toBeUndefined();
            expect(result.data.feet_land).toBeUndefined();
        }
    });
    it("accepts shot with partial keyframe fields", () => {
        const partialShot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
            legs_start_bending: 10,
            release: 40,
            feet_land: 50,
        };
        const result = labeledShotSchema.safeParse(partialShot);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.legs_start_bending).toBe(10);
            expect(result.data.release).toBe(40);
            expect(result.data.feet_land).toBe(50);
            expect(result.data.ball_low_point).toBeUndefined();
        }
    });
    it("rejects shot with negative keyframe frame number", () => {
        const shot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
            legs_start_bending: -5,
        };
        expect(labeledShotSchema.safeParse(shot).success).toBe(false);
    });
    it("rejects shot with non-integer keyframe frame number", () => {
        const shot = {
            shotNumber: 1,
            startFrame: 10,
            endFrame: 50,
            cameraOrientation: "front",
            release: 35.5,
        };
        expect(labeledShotSchema.safeParse(shot).success).toBe(false);
    });
    it("accepts keyframe at frame 0", () => {
        const shot = {
            shotNumber: 1,
            startFrame: 0,
            endFrame: 50,
            cameraOrientation: "front",
            legs_start_bending: 0,
        };
        const result = labeledShotSchema.safeParse(shot);
        expect(result.success).toBe(true);
    });
});
describe("labelDataSchema", () => {
    it("accepts valid label data with per-shot orientation", () => {
        const labelData = {
            video: "test-video.mp4",
            labeledBy: "tester",
            labeledAt: "2024-01-01T00:00:00Z",
            shots: [
                {
                    shotNumber: 1,
                    startFrame: 10,
                    endFrame: 50,
                    cameraOrientation: "front",
                },
            ],
        };
        const result = labelDataSchema.safeParse(labelData);
        expect(result.success).toBe(true);
    });
    it("accepts empty shots array", () => {
        const labelData = {
            video: "test-video.mp4",
            labeledBy: "tester",
            labeledAt: "2024-01-01T00:00:00Z",
            shots: [],
        };
        expect(labelDataSchema.safeParse(labelData).success).toBe(true);
    });
    it("rejects invalid shot orientation", () => {
        const labelData = {
            video: "test-video.mp4",
            labeledBy: "tester",
            labeledAt: "2024-01-01T00:00:00Z",
            shots: [
                {
                    shotNumber: 1,
                    startFrame: 10,
                    endFrame: 50,
                    cameraOrientation: "invalid",
                },
            ],
        };
        expect(labelDataSchema.safeParse(labelData).success).toBe(false);
    });
});
describe("isPoseData", () => {
    it("returns true for valid pose data", () => {
        const poseData = {
            video: "test.mp4",
            fps: 30,
            totalFrames: 100,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [],
        };
        expect(isPoseData(poseData)).toBe(true);
    });
    it("returns false for invalid data", () => {
        expect(isPoseData({})).toBe(false);
        expect(isPoseData(null)).toBe(false);
        expect(isPoseData(undefined)).toBe(false);
        expect(isPoseData("string")).toBe(false);
    });
});
describe("isLabelData", () => {
    it("returns true for valid label data", () => {
        const labelData = {
            video: "test.mp4",
            labeledBy: "tester",
            labeledAt: "2024-01-01T00:00:00Z",
            orientation: "front",
            shots: [],
        };
        expect(isLabelData(labelData)).toBe(true);
    });
    it("returns false for invalid data", () => {
        expect(isLabelData({})).toBe(false);
        expect(isLabelData(null)).toBe(false);
        expect(isLabelData(undefined)).toBe(false);
    });
});
//# sourceMappingURL=types.test.js.map