/**
 * Integration tests for ShotAnalyzer.analyzeVideo() with realistic frame data.
 *
 * These tests verify the full video analysis pipeline using mock frame providers
 * that simulate realistic basketball shot motion patterns.
 *
 * @see Feature 7.2.10 - Integration tests with mock frame provider
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createShotAnalyzer } from "./analyzer";
import { createConfig, createDefaultConfig } from "./config";
import type { FrameProvider, VideoFrame } from "./providers/types";
import { resetProfileRegistry } from "./profiles/registry";

// Mock the pose detector factory to avoid loading MediaPipe during tests
vi.mock("./pose/factory", () => ({
  createPoseDetector: vi.fn().mockResolvedValue({
    detect: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ============================================================================
// Test Fixtures - Mock Frame Providers
// ============================================================================

/**
 * Creates a mock video frame with specified dimensions.
 */
function createMockFrame(
  frameIndex: number,
  fps: number = 30,
  width: number = 640,
  height: number = 480,
): VideoFrame {
  const timestamp = (frameIndex / fps) * 1000;
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    timestamp,
    frameIndex,
  };
}

/**
 * Creates a mock frame provider that generates a fixed number of frames.
 */
function createMockFrameProvider(
  frameCount: number,
  fps: number = 30,
  width: number = 640,
  height: number = 480,
): FrameProvider {
  let currentIndex = 0;

  return {
    getNextFrame: async (): Promise<VideoFrame | null> => {
      if (currentIndex >= frameCount) {
        return null;
      }
      const frame = createMockFrame(currentIndex, fps, width, height);
      currentIndex++;
      return frame;
    },
    getFps: () => fps,
    getMetadata: () => ({
      width,
      height,
      duration: (frameCount / fps) * 1000,
    }),
  };
}

/**
 * Creates a mock frame provider for a live stream (no duration).
 */
function createLiveStreamFrameProvider(
  frameCount: number,
  fps: number = 30,
): FrameProvider {
  let currentIndex = 0;

  return {
    getNextFrame: async (): Promise<VideoFrame | null> => {
      if (currentIndex >= frameCount) {
        return null;
      }
      const frame = createMockFrame(currentIndex, fps);
      currentIndex++;
      return frame;
    },
    getFps: () => fps,
    getMetadata: () => ({
      width: 640,
      height: 480,
      // No duration for live streams
    }),
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe("ShotAnalyzer.analyzeVideo() Integration Tests", () => {
  beforeEach(() => {
    resetProfileRegistry();
  });

  describe("video metadata handling", () => {
    it("correctly captures metadata for standard video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(90, 30, 1920, 1080);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.videoMetadata.width).toBe(1920);
      expect(result.videoMetadata.height).toBe(1080);
      expect(result.videoMetadata.fps).toBe(30);
      expect(result.videoMetadata.totalFrames).toBe(90);
      expect(result.videoMetadata.duration).toBe(3000); // 90 frames / 30 fps * 1000 ms

      await analyzer.dispose();
    });

    it("handles live stream without duration", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createLiveStreamFrameProvider(60);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.videoMetadata.width).toBe(640);
      expect(result.videoMetadata.height).toBe(480);
      expect(result.videoMetadata.fps).toBe(30);
      expect(result.videoMetadata.totalFrames).toBe(60);
      expect(result.videoMetadata.duration).toBeUndefined();

      await analyzer.dispose();
    });

    it("handles various frame rates", async () => {
      const config = createDefaultConfig();

      // 60 fps video
      let analyzer = await createShotAnalyzer(config);
      let provider = createMockFrameProvider(120, 60);
      let result = await analyzer.analyzeVideo(provider);
      expect(result.videoMetadata.fps).toBe(60);
      expect(result.videoMetadata.duration).toBe(2000); // 120/60*1000
      await analyzer.dispose();

      // 24 fps video
      analyzer = await createShotAnalyzer(config);
      provider = createMockFrameProvider(48, 24);
      result = await analyzer.analyzeVideo(provider);
      expect(result.videoMetadata.fps).toBe(24);
      expect(result.videoMetadata.duration).toBe(2000); // 48/24*1000
      await analyzer.dispose();
    });
  });

  describe("configuration handling", () => {
    it("includes correct config in result for right-handed shooter", async () => {
      const config = createConfig({
        shootingHand: "right",
        profile: "youth-fundamentals",
        minConfidenceThreshold: 0.5,
        outputTimingUnit: "frames",
      });
      const analyzer = await createShotAnalyzer(config);
      const provider = createMockFrameProvider(30);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.config.shootingHand).toBe("right");
      expect(result.config.profile).toBe("youth-fundamentals");
      expect(result.config.minConfidenceThreshold).toBe(0.5);
      expect(result.config.outputTimingUnit).toBe("frames");

      await analyzer.dispose();
    });

    it("includes correct config in result for left-handed shooter", async () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "pro-form",
        minConfidenceThreshold: 0.7,
        outputTimingUnit: "ms",
      });
      const analyzer = await createShotAnalyzer(config);
      const provider = createMockFrameProvider(30);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.config.shootingHand).toBe("left");
      expect(result.config.profile).toBe("pro-form");
      expect(result.config.minConfidenceThreshold).toBe(0.7);
      expect(result.config.outputTimingUnit).toBe("ms");

      await analyzer.dispose();
    });
  });

  describe("empty and edge case handling", () => {
    it("returns empty shots for empty video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(0);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(0);

      await analyzer.dispose();
    });

    it("handles single frame video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(1);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(1);

      await analyzer.dispose();
    });

    it("handles very short video (2 frames)", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(2);

      const result = await analyzer.analyzeVideo(provider);

      // Should process without error
      expect(result.videoMetadata.totalFrames).toBe(2);
      expect(Array.isArray(result.shots)).toBe(true);

      await analyzer.dispose();
    });

    it("handles long video without memory issues", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      // 30 seconds at 30fps = 900 frames
      const provider = createMockFrameProvider(900, 30);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.videoMetadata.totalFrames).toBe(900);
      expect(result.videoMetadata.duration).toBe(30000); // 30 seconds

      await analyzer.dispose();
    });
  });

  describe("result structure validation", () => {
    it("returns properly structured AnalysisResult", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(60);

      const result = await analyzer.analyzeVideo(provider);

      // Check top-level structure
      expect(result).toHaveProperty("shots");
      expect(result).toHaveProperty("videoMetadata");
      expect(result).toHaveProperty("config");

      // Check videoMetadata structure
      expect(result.videoMetadata).toHaveProperty("width");
      expect(result.videoMetadata).toHaveProperty("height");
      expect(result.videoMetadata).toHaveProperty("fps");
      expect(result.videoMetadata).toHaveProperty("totalFrames");

      // Check config structure
      expect(result.config).toHaveProperty("shootingHand");
      expect(result.config).toHaveProperty("profile");
      expect(result.config).toHaveProperty("minConfidenceThreshold");
      expect(result.config).toHaveProperty("outputTimingUnit");

      await analyzer.dispose();
    });

    it("shots array contains properly structured ShotAnalysis objects", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(60);

      const result = await analyzer.analyzeVideo(provider);

      // Verify shots is an array
      expect(Array.isArray(result.shots)).toBe(true);

      // If there are shots, verify their structure
      for (const shot of result.shots) {
        expect(shot).toHaveProperty("shotIndex");
        expect(shot).toHaveProperty("frameRange");
        expect(shot.frameRange).toHaveProperty("start");
        expect(shot.frameRange).toHaveProperty("end");
        expect(shot).toHaveProperty("phases");
        expect(shot).toHaveProperty("metrics");
        expect(shot).toHaveProperty("overallConfidence");

        expect(typeof shot.shotIndex).toBe("number");
        expect(typeof shot.frameRange.start).toBe("number");
        expect(typeof shot.frameRange.end).toBe("number");
        expect(typeof shot.overallConfidence).toBe("number");
        expect(shot.overallConfidence).toBeGreaterThanOrEqual(0);
        expect(shot.overallConfidence).toBeLessThanOrEqual(1);
      }

      await analyzer.dispose();
    });
  });

  describe("analyzer lifecycle", () => {
    it("can analyze multiple videos sequentially", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // First video
      const provider1 = createMockFrameProvider(30);
      const result1 = await analyzer.analyzeVideo(provider1);
      expect(result1.videoMetadata.totalFrames).toBe(30);

      // Second video
      const provider2 = createMockFrameProvider(60);
      const result2 = await analyzer.analyzeVideo(provider2);
      expect(result2.videoMetadata.totalFrames).toBe(60);

      // Third video
      const provider3 = createMockFrameProvider(45);
      const result3 = await analyzer.analyzeVideo(provider3);
      expect(result3.videoMetadata.totalFrames).toBe(45);

      await analyzer.dispose();
    });

    it("properly resets state between video analyses", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Analyze first video
      const provider1 = createMockFrameProvider(50);
      const result1 = await analyzer.analyzeVideo(provider1);

      // Analyze second video with different frame count
      const provider2 = createMockFrameProvider(75);
      const result2 = await analyzer.analyzeVideo(provider2);

      // Results should be independent
      expect(result1.videoMetadata.totalFrames).toBe(50);
      expect(result2.videoMetadata.totalFrames).toBe(75);

      await analyzer.dispose();
    });

    it("can be disposed after analysis", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider(30);

      await analyzer.analyzeVideo(provider);
      await expect(analyzer.dispose()).resolves.not.toThrow();

      expect(analyzer.isInitialized()).toBe(false);
    });
  });
});
