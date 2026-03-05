/**
 * Type tests for PoseDetector interface and related error classes.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import { PoseDetectionError, DetectorClosedError } from "./detector";
describe("PoseDetector interface", () => {
    describe("method signatures", () => {
        it("defines detect returning Promise<PoseDetectionResult>", () => {
            expectTypeOf().toEqualTypeOf();
        });
        it("defines detect accepting VideoFrame parameter", () => {
            expectTypeOf().toEqualTypeOf();
        });
        it("defines close returning Promise<void>", () => {
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("mock implementation", () => {
        class MockPoseDetector {
            closed = false;
            shouldDetect;
            constructor(shouldDetect = true) {
                this.shouldDetect = shouldDetect;
            }
            async detect(_frame) {
                if (this.closed) {
                    throw new DetectorClosedError();
                }
                if (!this.shouldDetect) {
                    return null;
                }
                // Return mock pose landmarks
                const landmarks = Array.from({ length: 33 }, () => ({
                    x: 0.5,
                    y: 0.5,
                    z: 0,
                    visibility: 0.95,
                    confidence: 0.98,
                }));
                return {
                    landmarks,
                    poseConfidence: 0.95,
                };
            }
            async close() {
                if (this.closed) {
                    throw new DetectorClosedError();
                }
                this.closed = true;
            }
        }
        const createMockFrame = () => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
            timestamp: 0,
            frameIndex: 0,
        });
        it("can detect pose in frame", async () => {
            const detector = new MockPoseDetector(true);
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            expect(result).not.toBeNull();
            expect(result?.landmarks.length).toBe(33);
            expect(result?.poseConfidence).toBe(0.95);
            await detector.close();
        });
        it("returns null when no pose detected", async () => {
            const detector = new MockPoseDetector(false);
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            expect(result).toBeNull();
            await detector.close();
        });
        it("throws DetectorClosedError when used after close", async () => {
            const detector = new MockPoseDetector();
            const frame = createMockFrame();
            await detector.close();
            await expect(detector.detect(frame)).rejects.toThrow(DetectorClosedError);
        });
        it("throws DetectorClosedError when closed twice", async () => {
            const detector = new MockPoseDetector();
            await detector.close();
            await expect(detector.close()).rejects.toThrow(DetectorClosedError);
        });
        it("returns PoseLandmarks type when pose detected", async () => {
            const detector = new MockPoseDetector(true);
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            if (result !== null) {
                expectTypeOf(result).toEqualTypeOf();
            }
            await detector.close();
        });
    });
});
describe("PoseDetectionError", () => {
    it("extends Error", () => {
        const error = new PoseDetectionError("Test error");
        expect(error).toBeInstanceOf(Error);
    });
    it("has correct name", () => {
        const error = new PoseDetectionError("Test error");
        expect(error.name).toBe("PoseDetectionError");
    });
    it("includes message", () => {
        const error = new PoseDetectionError("Pose detection failed");
        expect(error.message).toBe("Pose detection failed");
    });
});
describe("DetectorClosedError", () => {
    it("extends Error", () => {
        const error = new DetectorClosedError();
        expect(error).toBeInstanceOf(Error);
    });
    it("has correct name", () => {
        const error = new DetectorClosedError();
        expect(error.name).toBe("DetectorClosedError");
    });
    it("has descriptive message", () => {
        const error = new DetectorClosedError();
        expect(error.message).toContain("closed");
    });
});
//# sourceMappingURL=detector.test.js.map