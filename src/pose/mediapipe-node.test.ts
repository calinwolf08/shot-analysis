/**
 * Unit tests for MediaPipeNodeDetector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DetectorClosedError, PoseDetectionError } from "./detector";
import type { VideoFrame } from "../providers/types";
import { TOTAL_LANDMARKS } from "./types";

// Mock @mediapipe/tasks-vision
vi.mock("@mediapipe/tasks-vision", () => {
  const mockLandmarker = {
    detect: vi.fn(),
    close: vi.fn(),
  };

  return {
    FilesetResolver: {
      forVisionTasks: vi.fn().mockResolvedValue({}),
    },
    PoseLandmarker: {
      createFromOptions: vi.fn().mockResolvedValue(mockLandmarker),
    },
  };
});

// Import after mocking
import {
  type MediaPipeNodeConfig,
  ModelNotFoundError,
  WasmInitializationError,
  ModelCreationError,
  createMediaPipeNodeDetector,
  DEFAULT_MODEL_PATH,
  MODEL_PATHS,
} from "./mediapipe-node";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

describe("MediaPipeNodeDetector", () => {
  let mockLandmarker: {
    detect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fresh mock landmarker for each test
    mockLandmarker = {
      detect: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(
      mockLandmarker as unknown as ReturnType<
        typeof PoseLandmarker.createFromOptions
      > extends Promise<infer T>
        ? T
        : never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor and configuration", () => {
    it("exports DEFAULT_MODEL_PATH constant", () => {
      expect(DEFAULT_MODEL_PATH).toBeDefined();
      expect(typeof DEFAULT_MODEL_PATH).toBe("string");
      expect(DEFAULT_MODEL_PATH).toContain("pose_landmarker");
    });

    it("exports MODEL_PATHS with all complexity levels", () => {
      expect(MODEL_PATHS).toBeDefined();
      expect(MODEL_PATHS[0]).toContain("pose_landmarker_lite");
      expect(MODEL_PATHS[1]).toContain("pose_landmarker_full");
      expect(MODEL_PATHS[2]).toContain("pose_landmarker_heavy");
    });

    it("DEFAULT_MODEL_PATH equals MODEL_PATHS[1] (full model)", () => {
      expect(DEFAULT_MODEL_PATH).toBe(MODEL_PATHS[1]);
    });

    it("createMediaPipeNodeDetector returns a PoseDetector", async () => {
      const detector = await createMediaPipeNodeDetector();

      expect(detector).toBeDefined();
      expect(typeof detector.detect).toBe("function");
      expect(typeof detector.close).toBe("function");

      await detector.close();
    });

    it("uses default configuration when no options provided", async () => {
      await createMediaPipeNodeDetector();

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      expect(calls.length).toBe(1);
      const options = calls[0]?.[1];
      expect(options).toMatchObject({
        baseOptions: {
          modelAssetPath: DEFAULT_MODEL_PATH,
        },
        numPoses: 1,
        runningMode: "IMAGE",
      });
    });

    it("accepts custom modelPath", async () => {
      const customPath = "/custom/model.task";

      await createMediaPipeNodeDetector({ modelPath: customPath });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.baseOptions?.modelAssetPath).toBe(customPath);
    });

    it("accepts modelComplexity 0 (lite) and selects lite model", async () => {
      await createMediaPipeNodeDetector({ modelComplexity: 0 });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[0]);
      expect(options?.baseOptions?.modelAssetPath).toContain("pose_landmarker_lite");
    });

    it("accepts modelComplexity 1 (full) and selects full model", async () => {
      await createMediaPipeNodeDetector({ modelComplexity: 1 });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[1]);
      expect(options?.baseOptions?.modelAssetPath).toContain("pose_landmarker_full");
    });

    it("accepts modelComplexity 2 (heavy) and selects heavy model", async () => {
      await createMediaPipeNodeDetector({ modelComplexity: 2 });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[2]);
      expect(options?.baseOptions?.modelAssetPath).toContain("pose_landmarker_heavy");
    });

    it("custom modelPath overrides modelComplexity", async () => {
      const customPath = "/custom/model.task";
      await createMediaPipeNodeDetector({
        modelPath: customPath,
        modelComplexity: 2, // Should be ignored
      });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.baseOptions?.modelAssetPath).toBe(customPath);
    });

    it("defaults to complexity 1 (full model) when not specified", async () => {
      await createMediaPipeNodeDetector();

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[1]);
    });

    it("accepts custom minDetectionConfidence", async () => {
      await createMediaPipeNodeDetector({ minDetectionConfidence: 0.7 });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.minPoseDetectionConfidence).toBe(0.7);
    });

    it("accepts custom minTrackingConfidence", async () => {
      await createMediaPipeNodeDetector({ minTrackingConfidence: 0.8 });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.minTrackingConfidence).toBe(0.8);
    });

    it("accepts custom minPresenceConfidence", async () => {
      await createMediaPipeNodeDetector({ minPresenceConfidence: 0.6 });

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options?.minPosePresenceConfidence).toBe(0.6);
    });

    it("passes all configuration options correctly", async () => {
      const config: MediaPipeNodeConfig = {
        modelPath: "/custom/model.task",
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.7,
        minPresenceConfidence: 0.8,
      };

      await createMediaPipeNodeDetector(config);

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options).toMatchObject({
        baseOptions: {
          modelAssetPath: "/custom/model.task",
        },
        minPoseDetectionConfidence: 0.6,
        minTrackingConfidence: 0.7,
        minPosePresenceConfidence: 0.8,
      });
    });

    it("uses default confidence values when not specified", async () => {
      await createMediaPipeNodeDetector();

      const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
      const options = calls[0]?.[1];
      expect(options).toMatchObject({
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
      });
    });
  });

  describe("detect() method", () => {
    const createMockFrame = (
      width: number = 640,
      height: number = 480,
    ): VideoFrame => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      timestamp: 0,
      frameIndex: 0,
    });

    const createMockLandmarks = () =>
      Array.from({ length: TOTAL_LANDMARKS }, (_, i) => ({
        x: i / TOTAL_LANDMARKS,
        y: i / TOTAL_LANDMARKS,
        z: 0.1,
        visibility: 0.95,
      }));

    it("returns null when no pose detected", async () => {
      mockLandmarker.detect.mockReturnValue({
        landmarks: [],
        worldLandmarks: [],
      });

      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame();

      const result = await detector.detect(frame);

      expect(result).toBeNull();

      await detector.close();
    });

    it("returns PoseLandmarks when pose detected", async () => {
      const mockLandmarks = createMockLandmarks();
      mockLandmarker.detect.mockReturnValue({
        landmarks: [mockLandmarks],
        worldLandmarks: [mockLandmarks],
      });

      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame();

      const result = await detector.detect(frame);

      expect(result).not.toBeNull();
      expect(result?.landmarks).toHaveLength(TOTAL_LANDMARKS);
      expect(result?.poseConfidence).toBeGreaterThan(0);

      await detector.close();
    });

    it("maps landmark properties correctly", async () => {
      const mockLandmarks = [
        { x: 0.5, y: 0.6, z: 0.1, visibility: 0.9 },
        ...Array.from({ length: TOTAL_LANDMARKS - 1 }, () => ({
          x: 0,
          y: 0,
          z: 0,
          visibility: 0,
        })),
      ];
      mockLandmarker.detect.mockReturnValue({
        landmarks: [mockLandmarks],
        worldLandmarks: [mockLandmarks],
      });

      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame();

      const result = await detector.detect(frame);

      expect(result?.landmarks[0]).toEqual({
        x: 0.5,
        y: 0.6,
        z: 0.1,
        visibility: 0.9,
        confidence: 0.9,
      });

      await detector.close();
    });

    it("throws DetectorClosedError when detect called after close", async () => {
      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame();

      await detector.close();

      await expect(detector.detect(frame)).rejects.toThrow(DetectorClosedError);
    });

    it("passes ImageData to MediaPipe landmarker", async () => {
      mockLandmarker.detect.mockReturnValue({
        landmarks: [],
        worldLandmarks: [],
      });

      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame(100, 100);

      await detector.detect(frame);

      expect(mockLandmarker.detect).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 100,
          height: 100,
        }),
      );

      await detector.close();
    });

    it("handles MediaPipe errors gracefully", async () => {
      mockLandmarker.detect.mockImplementation(() => {
        throw new Error("MediaPipe internal error");
      });

      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame();

      await expect(detector.detect(frame)).rejects.toThrow(PoseDetectionError);

      await detector.close();
    });

    it("uses first pose when multiple detected", async () => {
      const mockLandmarks1 = createMockLandmarks();
      const mockLandmarks2 = createMockLandmarks();
      mockLandmarker.detect.mockReturnValue({
        landmarks: [mockLandmarks1, mockLandmarks2],
        worldLandmarks: [mockLandmarks1, mockLandmarks2],
      });

      const detector = await createMediaPipeNodeDetector();
      const frame = createMockFrame();

      const result = await detector.detect(frame);

      expect(result).not.toBeNull();
      // Should use first pose
      expect(result?.landmarks[0]?.x).toBe(mockLandmarks1[0]?.x);

      await detector.close();
    });
  });

  describe("close() method", () => {
    it("releases MediaPipe resources", async () => {
      const detector = await createMediaPipeNodeDetector();

      await detector.close();

      expect(mockLandmarker.close).toHaveBeenCalledTimes(1);
    });

    it("throws DetectorClosedError when closed twice", async () => {
      const detector = await createMediaPipeNodeDetector();

      await detector.close();

      await expect(detector.close()).rejects.toThrow(DetectorClosedError);
    });

    it("can be called after detect", async () => {
      mockLandmarker.detect.mockReturnValue({
        landmarks: [],
        worldLandmarks: [],
      });

      const detector = await createMediaPipeNodeDetector();
      const frame: VideoFrame = {
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
        timestamp: 0,
        frameIndex: 0,
      };

      await detector.detect(frame);
      await detector.close();

      expect(mockLandmarker.close).toHaveBeenCalled();
    });
  });

  describe("ModelNotFoundError", () => {
    it("extends Error", () => {
      const error = new ModelNotFoundError("/path/to/model");
      expect(error).toBeInstanceOf(Error);
    });

    it("has correct name", () => {
      const error = new ModelNotFoundError("/path/to/model");
      expect(error.name).toBe("ModelNotFoundError");
    });

    it("includes model path in message", () => {
      const error = new ModelNotFoundError("/path/to/model.task");
      expect(error.message).toContain("/path/to/model.task");
    });

    it("stores modelPath property", () => {
      const error = new ModelNotFoundError("/path/to/model.task");
      expect(error.modelPath).toBe("/path/to/model.task");
    });
  });

  describe("initialization errors", () => {
    it("throws ModelNotFoundError when model file not found (404)", async () => {
      vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(
        new Error("Failed to load: 404 Not Found"),
      );

      await expect(
        createMediaPipeNodeDetector({ modelPath: "/nonexistent/model.task" }),
      ).rejects.toThrow(ModelNotFoundError);
    });

    it("throws ModelNotFoundError when model file not found (ENOENT)", async () => {
      vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(
        new Error("ENOENT: no such file or directory"),
      );

      await expect(
        createMediaPipeNodeDetector({ modelPath: "/nonexistent/model.task" }),
      ).rejects.toThrow(ModelNotFoundError);
    });

    it("throws ModelNotFoundError when fetch fails", async () => {
      vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(
        new Error("Failed to fetch model"),
      );

      await expect(
        createMediaPipeNodeDetector({ modelPath: "/nonexistent/model.task" }),
      ).rejects.toThrow(ModelNotFoundError);
    });

    it("throws WasmInitializationError for WASM loading failures", async () => {
      vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValue(
        new Error("WASM loading failed"),
      );

      await expect(createMediaPipeNodeDetector()).rejects.toThrow(
        WasmInitializationError,
      );
    });

    it("WasmInitializationError contains original error", async () => {
      const originalError = new Error("WASM loading failed");
      vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValue(originalError);

      try {
        await createMediaPipeNodeDetector();
        expect.fail("Should have thrown WasmInitializationError");
      } catch (error) {
        expect(error).toBeInstanceOf(WasmInitializationError);
        expect((error as WasmInitializationError).originalError).toBe(
          originalError,
        );
      }
    });

    it("throws ModelCreationError for other model creation failures", async () => {
      vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(
        new Error("Invalid configuration"),
      );

      await expect(createMediaPipeNodeDetector()).rejects.toThrow(
        ModelCreationError,
      );
    });

    it("ModelCreationError contains original error", async () => {
      const originalError = new Error("Invalid configuration");
      vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(
        originalError,
      );

      try {
        await createMediaPipeNodeDetector();
        expect.fail("Should have thrown ModelCreationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ModelCreationError);
        expect((error as ModelCreationError).originalError).toBe(originalError);
      }
    });
  });

  describe("MediaPipeNodeConfig type", () => {
    it("allows partial configuration", async () => {
      const config: MediaPipeNodeConfig = {};
      const detector = await createMediaPipeNodeDetector(config);
      await detector.close();
    });

    it("accepts all optional properties", () => {
      const config: MediaPipeNodeConfig = {
        modelPath: "/custom/path.task",
        modelComplexity: 2,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPresenceConfidence: 0.5,
      };

      expect(config.modelPath).toBeDefined();
      expect(config.modelComplexity).toBeDefined();
      expect(config.minDetectionConfidence).toBeDefined();
      expect(config.minTrackingConfidence).toBeDefined();
      expect(config.minPresenceConfidence).toBeDefined();
    });
  });
});
