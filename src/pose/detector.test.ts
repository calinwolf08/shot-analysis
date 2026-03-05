/**
 * Type tests for PoseDetector interface and related error classes.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import type { PoseDetector } from "./detector";
import { PoseDetectionError, DetectorClosedError } from "./detector";
import type { VideoFrame } from "../providers/types";
import type { PoseDetectionResult, PoseLandmarks } from "./types";

describe("PoseDetector interface", () => {
  describe("method signatures", () => {
    it("defines detect returning Promise<PoseDetectionResult>", () => {
      type DetectReturn = ReturnType<PoseDetector["detect"]>;
      expectTypeOf<DetectReturn>().toEqualTypeOf<
        Promise<PoseDetectionResult>
      >();
    });

    it("defines detect accepting VideoFrame parameter", () => {
      type DetectParams = Parameters<PoseDetector["detect"]>;
      expectTypeOf<DetectParams>().toEqualTypeOf<[VideoFrame]>();
    });

    it("defines close returning Promise<void>", () => {
      type CloseReturn = ReturnType<PoseDetector["close"]>;
      expectTypeOf<CloseReturn>().toEqualTypeOf<Promise<void>>();
    });
  });

  describe("mock implementation", () => {
    class MockPoseDetector implements PoseDetector {
      private closed = false;
      private readonly shouldDetect: boolean;

      constructor(shouldDetect: boolean = true) {
        this.shouldDetect = shouldDetect;
      }

      async detect(_frame: VideoFrame): Promise<PoseDetectionResult> {
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

      async close(): Promise<void> {
        if (this.closed) {
          throw new DetectorClosedError();
        }
        this.closed = true;
      }
    }

    const createMockFrame = (): VideoFrame => ({
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
        expectTypeOf(result).toEqualTypeOf<PoseLandmarks>();
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
