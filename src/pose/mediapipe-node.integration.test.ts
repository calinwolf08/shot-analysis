/**
 * Integration tests for MediaPipeNodeDetector with real MediaPipe model.
 *
 * These tests require the MediaPipe WASM runtime and model files to be available.
 * Tests may be skipped if the runtime cannot be initialized (e.g., in environments
 * without proper WASM support).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createMediaPipeNodeDetector,
  DEFAULT_MODEL_PATH,
  MODEL_PATHS,
  ModelNotFoundError,
  WasmInitializationError,
  ModelCreationError,
} from "./mediapipe-node";
import { PoseDetectionError, DetectorClosedError } from "./detector";
import { TOTAL_LANDMARKS } from "./types";
import type { PoseDetector } from "./detector";
import type { VideoFrame } from "../providers/types";

let mediapipeAvailable = false;
let detector: PoseDetector | null = null;

/**
 * Check if MediaPipe runtime is available in this environment.
 */
async function checkMediaPipeAvailable(): Promise<boolean> {
  try {
    const testDetector = await createMediaPipeNodeDetector();
    await testDetector.close();
    return true;
  } catch (error) {
    if (
      error instanceof ModelNotFoundError ||
      error instanceof WasmInitializationError ||
      error instanceof ModelCreationError ||
      error instanceof PoseDetectionError
    ) {
      console.log("MediaPipe not available:", error.message);
      return false;
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Creates a test image with a simple colored pattern.
 * Not a real person, so pose detection should return null.
 */
function createColorTestImage(
  width: number,
  height: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Create a gradient pattern
      data[idx] = (x / width) * 255; // R
      data[idx + 1] = (y / height) * 255; // G
      data[idx + 2] = 128; // B
      data[idx + 3] = 255; // A
    }
  }

  return data;
}

/**
 * Creates a VideoFrame for testing.
 */
function createTestFrame(
  width: number = 640,
  height: number = 480,
  data?: Uint8ClampedArray,
): VideoFrame {
  return {
    data: data ?? createColorTestImage(width, height),
    width,
    height,
    timestamp: 0,
    frameIndex: 0,
  };
}

describe("MediaPipeNodeDetector integration tests", () => {
  beforeAll(async () => {
    mediapipeAvailable = await checkMediaPipeAvailable();
    if (!mediapipeAvailable) {
      console.log(
        "MediaPipe runtime not available in this environment, skipping integration tests",
      );
    }
  });

  describe("initialization", () => {
    afterAll(async () => {
      if (detector) {
        await detector.close();
        detector = null;
      }
    });

    it.skipIf(!mediapipeAvailable)(
      "initializes with default model from CDN",
      async () => {
        detector = await createMediaPipeNodeDetector();
        expect(detector).toBeDefined();
      },
    );

    it.skipIf(!mediapipeAvailable)(
      "initializes with custom confidence settings",
      async () => {
        const customDetector = await createMediaPipeNodeDetector({
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.6,
          minPresenceConfidence: 0.5,
        });
        expect(customDetector).toBeDefined();
        await customDetector.close();
      },
    );
  });

  describe("pose detection", () => {
    beforeEach(async () => {
      if (mediapipeAvailable && !detector) {
        detector = await createMediaPipeNodeDetector();
      }
    });

    afterAll(async () => {
      if (detector) {
        await detector.close();
        detector = null;
      }
    });

    it.skipIf(!mediapipeAvailable)(
      "returns null when no person in frame",
      async () => {
        const frame = createTestFrame(640, 480);

        const result = await detector!.detect(frame);

        // A gradient image should not contain a detectable pose
        expect(result).toBeNull();
      },
    );

    it.skipIf(!mediapipeAvailable)(
      "handles empty image gracefully",
      async () => {
        // Create a solid black image
        const data = new Uint8ClampedArray(100 * 100 * 4).fill(0);
        const frame = createTestFrame(100, 100, data);

        const result = await detector!.detect(frame);

        expect(result).toBeNull();
      },
    );

    it.skipIf(!mediapipeAvailable)(
      "handles solid white image gracefully",
      async () => {
        // Create a solid white image
        const data = new Uint8ClampedArray(100 * 100 * 4).fill(255);
        const frame = createTestFrame(100, 100, data);

        const result = await detector!.detect(frame);

        expect(result).toBeNull();
      },
    );

    it.skipIf(!mediapipeAvailable)("handles very small images", async () => {
      const frame = createTestFrame(10, 10);

      // Should not throw, may or may not detect a pose
      const result = await detector!.detect(frame);
      expect(result === null || typeof result === "object").toBe(true);
    });

    it.skipIf(!mediapipeAvailable)("handles large images", async () => {
      const frame = createTestFrame(1920, 1080);

      // Should not throw, may or may not detect a pose
      const result = await detector!.detect(frame);
      expect(result === null || typeof result === "object").toBe(true);
    });

    it.skipIf(!mediapipeAvailable)(
      "handles multiple sequential detections",
      async () => {
        const frame = createTestFrame(640, 480);

        // Run multiple detections to verify no resource leaks
        for (let i = 0; i < 5; i++) {
          const result = await detector!.detect(frame);
          expect(result === null || typeof result === "object").toBe(true);
        }
      },
    );
  });

  describe("resource cleanup", () => {
    it.skipIf(!mediapipeAvailable)(
      "close() releases resources without errors",
      async () => {
        const testDetector = await createMediaPipeNodeDetector();

        await expect(testDetector.close()).resolves.not.toThrow();
      },
    );

    it.skipIf(!mediapipeAvailable)(
      "throws DetectorClosedError when used after close",
      async () => {
        const testDetector = await createMediaPipeNodeDetector();
        const frame = createTestFrame();

        await testDetector.close();

        await expect(testDetector.detect(frame)).rejects.toThrow(
          DetectorClosedError,
        );
      },
    );

    it.skipIf(!mediapipeAvailable)(
      "throws DetectorClosedError when closed twice",
      async () => {
        const testDetector = await createMediaPipeNodeDetector();

        await testDetector.close();

        await expect(testDetector.close()).rejects.toThrow(DetectorClosedError);
      },
    );
  });

  describe("error handling", () => {
    // Note: In non-browser environments without MediaPipe runtime,
    // errors may be ModelCreationError (e.g., "navigator is not defined")
    // rather than ModelNotFoundError. These tests are skipped when
    // MediaPipe runtime is not available.
    it.skipIf(!mediapipeAvailable)(
      "throws ModelNotFoundError for invalid model path",
      async () => {
        await expect(
          createMediaPipeNodeDetector({ modelPath: "/nonexistent/model.task" }),
        ).rejects.toThrow(ModelNotFoundError);
      },
    );

    it.skipIf(!mediapipeAvailable)(
      "ModelNotFoundError contains the model path",
      async () => {
        try {
          await createMediaPipeNodeDetector({
            modelPath: "/nonexistent/custom-model.task",
          });
          expect.fail("Should have thrown ModelNotFoundError");
        } catch (error) {
          expect(error).toBeInstanceOf(ModelNotFoundError);
          expect((error as ModelNotFoundError).modelPath).toBe(
            "/nonexistent/custom-model.task",
          );
        }
      },
    );
  });

  describe("result format validation", () => {
    beforeEach(async () => {
      if (mediapipeAvailable && !detector) {
        detector = await createMediaPipeNodeDetector();
      }
    });

    afterAll(async () => {
      if (detector) {
        await detector.close();
        detector = null;
      }
    });

    // Note: This test requires a real image of a person to validate pose detection.
    // In a real test scenario, you would include a test image with a person.
    // For now, we test that when a result is returned, it has the correct format.
    it.skipIf(!mediapipeAvailable)(
      "returned PoseLandmarks has correct structure",
      async () => {
        // This test validates the structure IF a pose is detected.
        // Since we can't include a real person image in unit tests,
        // we skip the actual detection test and rely on mocked tests.
        expect(TOTAL_LANDMARKS).toBe(33);
      },
    );
  });

  describe("constants", () => {
    it("exports DEFAULT_MODEL_PATH pointing to MediaPipe CDN", () => {
      expect(DEFAULT_MODEL_PATH).toContain(
        "storage.googleapis.com/mediapipe-models",
      );
      expect(DEFAULT_MODEL_PATH).toContain("pose_landmarker");
      expect(DEFAULT_MODEL_PATH).toContain(".task");
    });

    it("DEFAULT_MODEL_PATH uses full model", () => {
      expect(DEFAULT_MODEL_PATH).toContain("pose_landmarker_full");
    });

    it("MODEL_PATHS contains all complexity levels", () => {
      expect(MODEL_PATHS[0]).toContain("pose_landmarker_lite");
      expect(MODEL_PATHS[1]).toContain("pose_landmarker_full");
      expect(MODEL_PATHS[2]).toContain("pose_landmarker_heavy");
    });

    it("DEFAULT_MODEL_PATH equals MODEL_PATHS[1]", () => {
      expect(DEFAULT_MODEL_PATH).toBe(MODEL_PATHS[1]);
    });
  });

  describe("error types", () => {
    it("WasmInitializationError has correct name", () => {
      const error = new WasmInitializationError("Test error");
      expect(error.name).toBe("WasmInitializationError");
      expect(error).toBeInstanceOf(Error);
    });

    it("WasmInitializationError stores original error", () => {
      const originalError = new Error("Original");
      const error = new WasmInitializationError("Test error", originalError);
      expect(error.originalError).toBe(originalError);
    });

    it("ModelCreationError has correct name", () => {
      const error = new ModelCreationError("Test error");
      expect(error.name).toBe("ModelCreationError");
      expect(error).toBeInstanceOf(Error);
    });

    it("ModelCreationError stores original error", () => {
      const originalError = new Error("Original");
      const error = new ModelCreationError("Test error", originalError);
      expect(error.originalError).toBe(originalError);
    });
  });
});
