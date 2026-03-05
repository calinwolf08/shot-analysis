/**
 * Type tests for pose landmark types and helper functions.
 * These tests verify the type contracts and helper function behavior.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import { LANDMARK_INDEX, TOTAL_LANDMARKS, getLandmarkByIndex, getLandmarkByName, createEmptyLandmark, createEmptyPoseLandmarks, isLandmarkOccluded, } from "./types";
describe("Landmark type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const landmark = {
                x: 0.5,
                y: 0.5,
                z: 0.1,
                visibility: 0.95,
                confidence: 0.98,
            };
            expect(typeof landmark.x).toBe("number");
            expect(typeof landmark.y).toBe("number");
            expect(typeof landmark.z).toBe("number");
            expect(typeof landmark.visibility).toBe("number");
            expect(typeof landmark.confidence).toBe("number");
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("valid landmark data", () => {
        it("accepts normalized coordinates (0-1 range)", () => {
            const landmark = {
                x: 0.0,
                y: 1.0,
                z: 0.5,
                visibility: 0.99,
                confidence: 0.95,
            };
            expect(landmark.x).toBeGreaterThanOrEqual(0);
            expect(landmark.y).toBeLessThanOrEqual(1);
        });
        it("accepts zero values for undetected landmarks", () => {
            const landmark = {
                x: 0,
                y: 0,
                z: 0,
                visibility: 0,
                confidence: 0,
            };
            expect(landmark.visibility).toBe(0);
            expect(landmark.confidence).toBe(0);
        });
    });
});
describe("PoseLandmarks type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const poseLandmarks = {
                landmarks: [],
                poseConfidence: 0.95,
            };
            expect(Array.isArray(poseLandmarks.landmarks)).toBe(true);
            expect(typeof poseLandmarks.poseConfidence).toBe("number");
        });
        it("enforces readonly landmarks array at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("valid pose landmarks data", () => {
        it("accepts 33 landmarks array", () => {
            const landmarks = Array.from({ length: 33 }, () => ({
                x: 0.5,
                y: 0.5,
                z: 0,
                visibility: 1,
                confidence: 1,
            }));
            const poseLandmarks = {
                landmarks,
                poseConfidence: 0.95,
            };
            expect(poseLandmarks.landmarks.length).toBe(33);
        });
        it("accepts zero confidence for no pose detected", () => {
            const poseLandmarks = {
                landmarks: [],
                poseConfidence: 0,
            };
            expect(poseLandmarks.poseConfidence).toBe(0);
        });
    });
});
describe("PoseDetectionResult type", () => {
    it("can be PoseLandmarks", () => {
        const result = {
            landmarks: [],
            poseConfidence: 0.9,
        };
        expect(result).not.toBeNull();
        expect(result?.poseConfidence).toBe(0.9);
    });
    it("can be null for no pose detected", () => {
        const result = null;
        expect(result).toBeNull();
    });
});
describe("LANDMARK_INDEX", () => {
    describe("all 33 landmarks are defined", () => {
        it("has exactly 33 landmarks", () => {
            const landmarkCount = Object.keys(LANDMARK_INDEX).length;
            expect(landmarkCount).toBe(TOTAL_LANDMARKS);
        });
        it("has indices from 0 to 32", () => {
            const indices = Object.values(LANDMARK_INDEX);
            const uniqueIndices = new Set(indices);
            expect(uniqueIndices.size).toBe(33);
            expect(Math.min(...indices)).toBe(0);
            expect(Math.max(...indices)).toBe(32);
        });
    });
    describe("face landmarks", () => {
        it("has NOSE at index 0", () => {
            expect(LANDMARK_INDEX.NOSE).toBe(0);
        });
        it("has eye landmarks at indices 1-6", () => {
            expect(LANDMARK_INDEX.LEFT_EYE_INNER).toBe(1);
            expect(LANDMARK_INDEX.LEFT_EYE).toBe(2);
            expect(LANDMARK_INDEX.LEFT_EYE_OUTER).toBe(3);
            expect(LANDMARK_INDEX.RIGHT_EYE_INNER).toBe(4);
            expect(LANDMARK_INDEX.RIGHT_EYE).toBe(5);
            expect(LANDMARK_INDEX.RIGHT_EYE_OUTER).toBe(6);
        });
        it("has ear landmarks at indices 7-8", () => {
            expect(LANDMARK_INDEX.LEFT_EAR).toBe(7);
            expect(LANDMARK_INDEX.RIGHT_EAR).toBe(8);
        });
        it("has mouth landmarks at indices 9-10", () => {
            expect(LANDMARK_INDEX.MOUTH_LEFT).toBe(9);
            expect(LANDMARK_INDEX.MOUTH_RIGHT).toBe(10);
        });
    });
    describe("upper body landmarks", () => {
        it("has shoulder landmarks at indices 11-12", () => {
            expect(LANDMARK_INDEX.LEFT_SHOULDER).toBe(11);
            expect(LANDMARK_INDEX.RIGHT_SHOULDER).toBe(12);
        });
        it("has elbow landmarks at indices 13-14", () => {
            expect(LANDMARK_INDEX.LEFT_ELBOW).toBe(13);
            expect(LANDMARK_INDEX.RIGHT_ELBOW).toBe(14);
        });
        it("has wrist landmarks at indices 15-16", () => {
            expect(LANDMARK_INDEX.LEFT_WRIST).toBe(15);
            expect(LANDMARK_INDEX.RIGHT_WRIST).toBe(16);
        });
    });
    describe("hand landmarks", () => {
        it("has pinky landmarks at indices 17-18", () => {
            expect(LANDMARK_INDEX.LEFT_PINKY).toBe(17);
            expect(LANDMARK_INDEX.RIGHT_PINKY).toBe(18);
        });
        it("has index finger landmarks at indices 19-20", () => {
            expect(LANDMARK_INDEX.LEFT_INDEX).toBe(19);
            expect(LANDMARK_INDEX.RIGHT_INDEX).toBe(20);
        });
        it("has thumb landmarks at indices 21-22", () => {
            expect(LANDMARK_INDEX.LEFT_THUMB).toBe(21);
            expect(LANDMARK_INDEX.RIGHT_THUMB).toBe(22);
        });
    });
    describe("lower body landmarks", () => {
        it("has hip landmarks at indices 23-24", () => {
            expect(LANDMARK_INDEX.LEFT_HIP).toBe(23);
            expect(LANDMARK_INDEX.RIGHT_HIP).toBe(24);
        });
        it("has knee landmarks at indices 25-26", () => {
            expect(LANDMARK_INDEX.LEFT_KNEE).toBe(25);
            expect(LANDMARK_INDEX.RIGHT_KNEE).toBe(26);
        });
        it("has ankle landmarks at indices 27-28", () => {
            expect(LANDMARK_INDEX.LEFT_ANKLE).toBe(27);
            expect(LANDMARK_INDEX.RIGHT_ANKLE).toBe(28);
        });
        it("has heel landmarks at indices 29-30", () => {
            expect(LANDMARK_INDEX.LEFT_HEEL).toBe(29);
            expect(LANDMARK_INDEX.RIGHT_HEEL).toBe(30);
        });
        it("has foot index landmarks at indices 31-32", () => {
            expect(LANDMARK_INDEX.LEFT_FOOT_INDEX).toBe(31);
            expect(LANDMARK_INDEX.RIGHT_FOOT_INDEX).toBe(32);
        });
    });
    describe("type safety", () => {
        it("LandmarkIndexValue is a union of 0-32", () => {
            const validIndex = 0;
            const anotherValidIndex = 32;
            expect(validIndex).toBe(0);
            expect(anotherValidIndex).toBe(32);
        });
        it("LandmarkName includes all landmark names", () => {
            const validName = "NOSE";
            const anotherValidName = "RIGHT_FOOT_INDEX";
            expect(LANDMARK_INDEX[validName]).toBe(0);
            expect(LANDMARK_INDEX[anotherValidName]).toBe(32);
        });
    });
});
describe("TOTAL_LANDMARKS", () => {
    it("equals 33", () => {
        expect(TOTAL_LANDMARKS).toBe(33);
    });
});
describe("getLandmarkByIndex", () => {
    const createTestPoseLandmarks = () => {
        const landmarks = Array.from({ length: 33 }, (_, i) => ({
            x: i / 33,
            y: i / 33,
            z: 0,
            visibility: 1,
            confidence: 1,
        }));
        return { landmarks, poseConfidence: 0.95 };
    };
    it("returns the landmark at the specified index", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const shoulder = getLandmarkByIndex(poseLandmarks, LANDMARK_INDEX.LEFT_SHOULDER);
        expect(shoulder).toBeDefined();
        expect(shoulder?.x).toBeCloseTo(11 / 33);
    });
    it("returns undefined for negative index", () => {
        const poseLandmarks = createTestPoseLandmarks();
        // TypeScript would catch this at compile time, but test runtime behavior
        const result = getLandmarkByIndex(poseLandmarks, -1);
        expect(result).toBeUndefined();
    });
    it("returns undefined for index >= 33", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const result = getLandmarkByIndex(poseLandmarks, 33);
        expect(result).toBeUndefined();
    });
    it("returns first landmark for index 0", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const nose = getLandmarkByIndex(poseLandmarks, LANDMARK_INDEX.NOSE);
        expect(nose).toBeDefined();
        expect(nose?.x).toBeCloseTo(0);
    });
    it("returns last landmark for index 32", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const footIndex = getLandmarkByIndex(poseLandmarks, LANDMARK_INDEX.RIGHT_FOOT_INDEX);
        expect(footIndex).toBeDefined();
        expect(footIndex?.x).toBeCloseTo(32 / 33);
    });
});
describe("getLandmarkByName", () => {
    const createTestPoseLandmarks = () => {
        const landmarks = Array.from({ length: 33 }, (_, i) => ({
            x: i / 33,
            y: i / 33,
            z: 0,
            visibility: 1,
            confidence: 1,
        }));
        return { landmarks, poseConfidence: 0.95 };
    };
    it("returns the landmark with the specified name", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const leftShoulder = getLandmarkByName(poseLandmarks, "LEFT_SHOULDER");
        expect(leftShoulder).toBeDefined();
        expect(leftShoulder?.x).toBeCloseTo(11 / 33);
    });
    it("returns NOSE landmark correctly", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const nose = getLandmarkByName(poseLandmarks, "NOSE");
        expect(nose).toBeDefined();
        expect(nose?.x).toBeCloseTo(0);
    });
    it("returns RIGHT_FOOT_INDEX landmark correctly", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const footIndex = getLandmarkByName(poseLandmarks, "RIGHT_FOOT_INDEX");
        expect(footIndex).toBeDefined();
        expect(footIndex?.x).toBeCloseTo(32 / 33);
    });
    it("returns all upper body landmarks for shooting analysis", () => {
        const poseLandmarks = createTestPoseLandmarks();
        const rightShoulder = getLandmarkByName(poseLandmarks, "RIGHT_SHOULDER");
        const rightElbow = getLandmarkByName(poseLandmarks, "RIGHT_ELBOW");
        const rightWrist = getLandmarkByName(poseLandmarks, "RIGHT_WRIST");
        const rightIndex = getLandmarkByName(poseLandmarks, "RIGHT_INDEX");
        expect(rightShoulder).toBeDefined();
        expect(rightElbow).toBeDefined();
        expect(rightWrist).toBeDefined();
        expect(rightIndex).toBeDefined();
    });
});
describe("createEmptyLandmark", () => {
    it("returns a landmark with all zero values", () => {
        const empty = createEmptyLandmark();
        expect(empty.x).toBe(0);
        expect(empty.y).toBe(0);
        expect(empty.z).toBe(0);
        expect(empty.visibility).toBe(0);
        expect(empty.confidence).toBe(0);
    });
    it("returns a valid Landmark type", () => {
        const empty = createEmptyLandmark();
        expectTypeOf(empty).toEqualTypeOf();
    });
});
describe("createEmptyPoseLandmarks", () => {
    it("returns pose landmarks with 33 empty landmarks", () => {
        const empty = createEmptyPoseLandmarks();
        expect(empty.landmarks.length).toBe(33);
        expect(empty.poseConfidence).toBe(0);
    });
    it("all landmarks have zero confidence", () => {
        const empty = createEmptyPoseLandmarks();
        for (const landmark of empty.landmarks) {
            expect(landmark.confidence).toBe(0);
            expect(landmark.visibility).toBe(0);
        }
    });
    it("returns a valid PoseLandmarks type", () => {
        const empty = createEmptyPoseLandmarks();
        expectTypeOf(empty).toEqualTypeOf();
    });
});
describe("isLandmarkOccluded", () => {
    it("returns true for visibility below default threshold (0.5)", () => {
        const landmark = {
            x: 0.5,
            y: 0.5,
            z: 0,
            visibility: 0.3,
            confidence: 0.9,
        };
        expect(isLandmarkOccluded(landmark)).toBe(true);
    });
    it("returns false for visibility above default threshold", () => {
        const landmark = {
            x: 0.5,
            y: 0.5,
            z: 0,
            visibility: 0.8,
            confidence: 0.9,
        };
        expect(isLandmarkOccluded(landmark)).toBe(false);
    });
    it("returns true for visibility at exactly threshold", () => {
        const landmark = {
            x: 0.5,
            y: 0.5,
            z: 0,
            visibility: 0.5,
            confidence: 0.9,
        };
        // visibility < threshold, so 0.5 < 0.5 is false
        expect(isLandmarkOccluded(landmark)).toBe(false);
    });
    it("respects custom threshold parameter", () => {
        const landmark = {
            x: 0.5,
            y: 0.5,
            z: 0,
            visibility: 0.7,
            confidence: 0.9,
        };
        expect(isLandmarkOccluded(landmark, 0.8)).toBe(true);
        expect(isLandmarkOccluded(landmark, 0.6)).toBe(false);
    });
    it("returns true for zero visibility", () => {
        const landmark = {
            x: 0,
            y: 0,
            z: 0,
            visibility: 0,
            confidence: 0,
        };
        expect(isLandmarkOccluded(landmark)).toBe(true);
    });
});
describe("edge cases", () => {
    describe("no pose detected", () => {
        it("createEmptyPoseLandmarks represents undetected pose", () => {
            const noPose = createEmptyPoseLandmarks();
            expect(noPose.poseConfidence).toBe(0);
            expect(noPose.landmarks.every((l) => l.confidence === 0)).toBe(true);
        });
        it("null PoseDetectionResult represents no pose", () => {
            const result = null;
            expect(result).toBeNull();
        });
    });
    describe("partially visible pose", () => {
        it("can have mixed visibility scores", () => {
            const landmarks = [
                { x: 0.5, y: 0.5, z: 0, visibility: 0.95, confidence: 0.98 }, // visible
                { x: 0.5, y: 0.5, z: 0, visibility: 0.2, confidence: 0.3 }, // occluded
                ...Array.from({ length: 31 }, () => ({
                    x: 0.5,
                    y: 0.5,
                    z: 0,
                    visibility: 0.8,
                    confidence: 0.9,
                })),
            ];
            const poseLandmarks = {
                landmarks,
                poseConfidence: 0.7,
            };
            expect(isLandmarkOccluded(poseLandmarks.landmarks[0])).toBe(false);
            expect(isLandmarkOccluded(poseLandmarks.landmarks[1])).toBe(true);
        });
    });
});
//# sourceMappingURL=types.test.js.map