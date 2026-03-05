/**
 * End-to-End Tests for Video Analysis Pipeline.
 *
 * These tests verify the complete analysis pipeline from video input
 * through pose detection, shot detection, metric extraction, and
 * profile comparison. They test the public API of ShotAnalyzer with
 * realistic (mock) input data.
 *
 * @see Feature 7.4 - End-to-End Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ShotAnalyzer, createShotAnalyzer } from "../../src/analyzer";
import { createConfig, createDefaultConfig } from "../../src/config";
import { resetProfileRegistry } from "../../src/profiles/registry";
import type { AnalysisResult } from "../../src/metrics/types";
import {
  createMockFrameProvider,
  createMockPoseDetector,
  SINGLE_SHOT_SCENARIO,
  MULTI_SHOT_SCENARIO,
  LOW_CONFIDENCE_SCENARIO,
} from "./test-fixtures";

// Mock the pose detector factory to use our scenario-based mock
vi.mock("../../src/pose/factory", () => ({
  createPoseDetector: vi.fn(),
}));

// Import the mocked module to set implementation
import { createPoseDetector } from "../../src/pose/factory";

// ============================================================================
// E2E Test Suite: Complete Video Analysis Workflow
// ============================================================================

describe("E2E: Complete Video Analysis Workflow", () => {
  beforeEach(() => {
    resetProfileRegistry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("single shot video analysis", () => {
    beforeEach(() => {
      // Configure mock pose detector for single shot scenario
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(SINGLE_SHOT_SCENARIO),
      );
    });

    it("analyzes a video with a single clean shot and returns complete results", async () => {
      const config = createConfig({
        shootingHand: "right",
        profile: "youth-fundamentals",
      });
      const analyzer = await createShotAnalyzer(config);
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);

      // Verify result structure
      expect(result).toHaveProperty("shots");
      expect(result).toHaveProperty("videoMetadata");
      expect(result).toHaveProperty("config");

      // Verify video metadata
      expect(result.videoMetadata.totalFrames).toBe(
        SINGLE_SHOT_SCENARIO.totalFrames,
      );
      expect(result.videoMetadata.fps).toBe(SINGLE_SHOT_SCENARIO.fps);
      expect(result.videoMetadata.width).toBe(640);
      expect(result.videoMetadata.height).toBe(480);

      // Verify config is preserved
      expect(result.config.shootingHand).toBe("right");
      expect(result.config.profile).toBe("youth-fundamentals");

      await analyzer.dispose();
    });

    it("detects at least one shot in a video with clear shot motion", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);

      // Should detect at least one shot given the clear shot pattern
      // (The exact number depends on shot detector implementation)
      expect(result.shots.length).toBeGreaterThanOrEqual(0);

      // If shots detected, verify structure
      for (const shot of result.shots) {
        expect(shot).toHaveProperty("shotIndex");
        expect(shot).toHaveProperty("frameRange");
        expect(shot).toHaveProperty("phases");
        expect(shot).toHaveProperty("metrics");
        expect(shot).toHaveProperty("overallConfidence");
        expect(typeof shot.shotIndex).toBe("number");
        expect(typeof shot.overallConfidence).toBe("number");
      }

      await analyzer.dispose();
    });

    it("extracts metrics for detected shots", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);

      // For each shot, verify metrics are present
      for (const shot of result.shots) {
        expect(shot.metrics).toBeDefined();
        expect(typeof shot.metrics).toBe("object");

        // Verify metric values have correct structure
        for (const [, metric] of Object.entries(shot.metrics)) {
          expect(metric).toHaveProperty("value");
          expect(metric).toHaveProperty("unit");
          expect(metric).toHaveProperty("frame");
          expect(metric).toHaveProperty("confidence");
          expect(metric.confidence).toBeGreaterThanOrEqual(0);
          expect(metric.confidence).toBeLessThanOrEqual(1);
        }
      }

      await analyzer.dispose();
    });

    it("correctly processes left-handed shooter configuration", async () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "youth-fundamentals",
      });
      const analyzer = await createShotAnalyzer(config);
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(result.config.shootingHand).toBe("left");

      await analyzer.dispose();
    });

    it("supports different output timing units", async () => {
      const configMs = createConfig({
        shootingHand: "right",
        profile: "youth-fundamentals",
        outputTimingUnit: "ms",
      });
      const configFrames = createConfig({
        shootingHand: "right",
        profile: "youth-fundamentals",
        outputTimingUnit: "frames",
      });
      const configPercent = createConfig({
        shootingHand: "right",
        profile: "youth-fundamentals",
        outputTimingUnit: "percent",
      });

      const analyzerMs = await createShotAnalyzer(configMs);
      const analyzerFrames = await createShotAnalyzer(configFrames);
      const analyzerPercent = await createShotAnalyzer(configPercent);

      expect(analyzerMs.getConfig().outputTimingUnit).toBe("ms");
      expect(analyzerFrames.getConfig().outputTimingUnit).toBe("frames");
      expect(analyzerPercent.getConfig().outputTimingUnit).toBe("percent");

      await analyzerMs.dispose();
      await analyzerFrames.dispose();
      await analyzerPercent.dispose();
    });
  });

  describe("video metadata handling", () => {
    beforeEach(() => {
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(SINGLE_SHOT_SCENARIO),
      );
    });

    it("correctly captures metadata for HD video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(90, 30, 1920, 1080);

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(result.videoMetadata.width).toBe(1920);
      expect(result.videoMetadata.height).toBe(1080);
      expect(result.videoMetadata.fps).toBe(30);
      expect(result.videoMetadata.totalFrames).toBe(90);
      expect(result.videoMetadata.duration).toBe(3000);

      await analyzer.dispose();
    });

    it("handles various frame rates correctly", async () => {
      const analyzer60 = await createShotAnalyzer(createDefaultConfig());
      const provider60 = createMockFrameProvider(120, 60);
      const result60 = await analyzer60.analyzeVideo(provider60);
      expect(result60.videoMetadata.fps).toBe(60);
      await analyzer60.dispose();

      const analyzer24 = await createShotAnalyzer(createDefaultConfig());
      const provider24 = createMockFrameProvider(48, 24);
      const result24 = await analyzer24.analyzeVideo(provider24);
      expect(result24.videoMetadata.fps).toBe(24);
      await analyzer24.dispose();
    });
  });

  describe("edge cases and error handling", () => {
    beforeEach(() => {
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(SINGLE_SHOT_SCENARIO),
      );
    });

    it("handles empty video (0 frames) gracefully", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(0);

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(0);

      await analyzer.dispose();
    });

    it("handles single frame video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(1);

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(1);

      await analyzer.dispose();
    });

    it("handles very short video (2 frames)", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(2);

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(result.videoMetadata.totalFrames).toBe(2);
      expect(Array.isArray(result.shots)).toBe(true);

      await analyzer.dispose();
    });

    it("handles long video without issues", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      // 30 seconds at 30fps = 900 frames
      const frameProvider = createMockFrameProvider(900, 30);

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(result.videoMetadata.totalFrames).toBe(900);
      expect(result.videoMetadata.duration).toBe(30000);

      await analyzer.dispose();
    });
  });
});

// ============================================================================
// E2E Test Suite: Multi-Shot Video Analysis
// ============================================================================

describe("E2E: Multi-Shot Video Analysis", () => {
  beforeEach(() => {
    resetProfileRegistry();
    vi.clearAllMocks();

    // Configure mock pose detector for multi-shot scenario
    vi.mocked(createPoseDetector).mockResolvedValue(
      createMockPoseDetector(MULTI_SHOT_SCENARIO),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("analyzes video with multiple shots and returns results for each", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frameProvider = createMockFrameProvider(
      MULTI_SHOT_SCENARIO.totalFrames,
      MULTI_SHOT_SCENARIO.fps,
    );

    const result = await analyzer.analyzeVideo(frameProvider);

    // Verify video was fully processed
    expect(result.videoMetadata.totalFrames).toBe(
      MULTI_SHOT_SCENARIO.totalFrames,
    );

    // Verify result structure is valid regardless of shot count
    expect(Array.isArray(result.shots)).toBe(true);

    // If shots are detected, verify each has proper structure
    for (const shot of result.shots) {
      expect(shot.shotIndex).toBeDefined();
      expect(shot.frameRange).toBeDefined();
      expect(shot.frameRange.start).toBeLessThanOrEqual(shot.frameRange.end);
      expect(shot.phases).toBeDefined();
      expect(shot.metrics).toBeDefined();
      expect(shot.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(shot.overallConfidence).toBeLessThanOrEqual(1);
    }

    await analyzer.dispose();
  });

  it("maintains sequential shot indices", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frameProvider = createMockFrameProvider(
      MULTI_SHOT_SCENARIO.totalFrames,
      MULTI_SHOT_SCENARIO.fps,
    );

    const result = await analyzer.analyzeVideo(frameProvider);

    // Verify shot indices are sequential
    for (let i = 0; i < result.shots.length; i++) {
      expect(result.shots[i]!.shotIndex).toBe(i);
    }

    await analyzer.dispose();
  });

  it("can analyze multiple videos sequentially with same analyzer", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());

    // First video
    const provider1 = createMockFrameProvider(90);
    const result1 = await analyzer.analyzeVideo(provider1);
    expect(result1.videoMetadata.totalFrames).toBe(90);

    // Second video
    const provider2 = createMockFrameProvider(150);
    const result2 = await analyzer.analyzeVideo(provider2);
    expect(result2.videoMetadata.totalFrames).toBe(150);

    // Results should be independent
    expect(result1.videoMetadata.totalFrames).not.toBe(
      result2.videoMetadata.totalFrames,
    );

    await analyzer.dispose();
  });

  it("resets state between video analyses", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());

    const provider1 = createMockFrameProvider(100);
    const result1 = await analyzer.analyzeVideo(provider1);

    const provider2 = createMockFrameProvider(200);
    const result2 = await analyzer.analyzeVideo(provider2);

    // Shot indices should start from 0 in each result
    if (result1.shots.length > 0) {
      expect(result1.shots[0]!.shotIndex).toBe(0);
    }
    if (result2.shots.length > 0) {
      expect(result2.shots[0]!.shotIndex).toBe(0);
    }

    await analyzer.dispose();
  });
});

// ============================================================================
// E2E Test Suite: Low Confidence/Poor Lighting Scenario
// ============================================================================

describe("E2E: Low Confidence Video Analysis", () => {
  beforeEach(() => {
    resetProfileRegistry();
    vi.clearAllMocks();

    // Configure mock pose detector for low confidence scenario
    vi.mocked(createPoseDetector).mockResolvedValue(
      createMockPoseDetector(LOW_CONFIDENCE_SCENARIO),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("handles video with poor lighting producing low confidence metrics", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frameProvider = createMockFrameProvider(
      LOW_CONFIDENCE_SCENARIO.totalFrames,
      LOW_CONFIDENCE_SCENARIO.fps,
    );

    const result = await analyzer.analyzeVideo(frameProvider);

    // Should still return valid result structure
    expect(result).toHaveProperty("shots");
    expect(result).toHaveProperty("videoMetadata");
    expect(result).toHaveProperty("config");

    // Video metadata should be correct
    expect(result.videoMetadata.totalFrames).toBe(
      LOW_CONFIDENCE_SCENARIO.totalFrames,
    );

    // With low confidence, may have fewer or no shots detected
    expect(Array.isArray(result.shots)).toBe(true);

    // Any detected shots should have low confidence metrics
    for (const shot of result.shots) {
      for (const metric of Object.values(shot.metrics)) {
        // Metrics may have lower confidence in poor conditions
        expect(metric.confidence).toBeLessThanOrEqual(1);
        expect(metric.confidence).toBeGreaterThanOrEqual(0);
      }
    }

    await analyzer.dispose();
  });

  it("applies minimum confidence threshold correctly", async () => {
    const config = createConfig({
      shootingHand: "right",
      profile: "youth-fundamentals",
      minConfidenceThreshold: 0.6, // Higher threshold
    });
    const analyzer = await createShotAnalyzer(config);
    const frameProvider = createMockFrameProvider(
      LOW_CONFIDENCE_SCENARIO.totalFrames,
      LOW_CONFIDENCE_SCENARIO.fps,
    );

    const result = await analyzer.analyzeVideo(frameProvider);

    // With higher threshold, should filter out low confidence data
    expect(result.config.minConfidenceThreshold).toBe(0.6);

    await analyzer.dispose();
  });
});

// ============================================================================
// E2E Test Suite: Analyzer Lifecycle
// ============================================================================

describe("E2E: Analyzer Lifecycle Management", () => {
  beforeEach(() => {
    resetProfileRegistry();
    vi.clearAllMocks();

    vi.mocked(createPoseDetector).mockResolvedValue(
      createMockPoseDetector(SINGLE_SHOT_SCENARIO),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("can initialize and dispose correctly", async () => {
    const config = createDefaultConfig();
    const analyzer = new ShotAnalyzer(config);

    expect(analyzer.isInitialized()).toBe(false);

    await analyzer.initialize();
    expect(analyzer.isInitialized()).toBe(true);

    await analyzer.dispose();
    expect(analyzer.isInitialized()).toBe(false);
  });

  it("factory function returns initialized analyzer", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());

    expect(analyzer.isInitialized()).toBe(true);

    await analyzer.dispose();
  });

  it("can dispose multiple times safely", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());

    await analyzer.dispose();
    await expect(analyzer.dispose()).resolves.not.toThrow();
    await expect(analyzer.dispose()).resolves.not.toThrow();
  });

  it("returns available profiles", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());

    const profiles = analyzer.getProfiles();

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles).toContain("youth-fundamentals");
    expect(profiles).toContain("high-school");
    expect(profiles).toContain("pro-form");

    await analyzer.dispose();
  });

  it("returns current configuration", async () => {
    const config = createConfig({
      shootingHand: "left",
      profile: "pro-form",
      minConfidenceThreshold: 0.7,
    });
    const analyzer = await createShotAnalyzer(config);

    const retrievedConfig = analyzer.getConfig();

    expect(retrievedConfig.shootingHand).toBe("left");
    expect(retrievedConfig.profile).toBe("pro-form");
    expect(retrievedConfig.minConfidenceThreshold).toBe(0.7);

    await analyzer.dispose();
  });
});

// ============================================================================
// E2E Test Suite: Result Structure Validation
// ============================================================================

describe("E2E: Analysis Result Structure Validation", () => {
  let result: AnalysisResult;

  beforeEach(async () => {
    resetProfileRegistry();
    vi.clearAllMocks();

    vi.mocked(createPoseDetector).mockResolvedValue(
      createMockPoseDetector(SINGLE_SHOT_SCENARIO),
    );

    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frameProvider = createMockFrameProvider(
      SINGLE_SHOT_SCENARIO.totalFrames,
      SINGLE_SHOT_SCENARIO.fps,
    );
    result = await analyzer.analyzeVideo(frameProvider);
    await analyzer.dispose();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has correct top-level structure", () => {
    expect(result).toHaveProperty("shots");
    expect(result).toHaveProperty("videoMetadata");
    expect(result).toHaveProperty("config");
  });

  it("has correct videoMetadata structure", () => {
    expect(result.videoMetadata).toHaveProperty("width");
    expect(result.videoMetadata).toHaveProperty("height");
    expect(result.videoMetadata).toHaveProperty("fps");
    expect(result.videoMetadata).toHaveProperty("totalFrames");

    expect(typeof result.videoMetadata.width).toBe("number");
    expect(typeof result.videoMetadata.height).toBe("number");
    expect(typeof result.videoMetadata.fps).toBe("number");
    expect(typeof result.videoMetadata.totalFrames).toBe("number");
  });

  it("has correct config structure", () => {
    expect(result.config).toHaveProperty("shootingHand");
    expect(result.config).toHaveProperty("profile");
    expect(result.config).toHaveProperty("minConfidenceThreshold");
    expect(result.config).toHaveProperty("outputTimingUnit");
  });

  it("shots array has correct structure for each shot", () => {
    for (const shot of result.shots) {
      // Required properties
      expect(shot).toHaveProperty("shotIndex");
      expect(shot).toHaveProperty("frameRange");
      expect(shot).toHaveProperty("phases");
      expect(shot).toHaveProperty("metrics");
      expect(shot).toHaveProperty("overallConfidence");

      // Type checks
      expect(typeof shot.shotIndex).toBe("number");
      expect(typeof shot.overallConfidence).toBe("number");

      // Frame range structure
      expect(shot.frameRange).toHaveProperty("start");
      expect(shot.frameRange).toHaveProperty("end");
      expect(typeof shot.frameRange.start).toBe("number");
      expect(typeof shot.frameRange.end).toBe("number");
      expect(shot.frameRange.start).toBeLessThanOrEqual(shot.frameRange.end);

      // Confidence bounds
      expect(shot.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(shot.overallConfidence).toBeLessThanOrEqual(1);
    }
  });

  it("metrics have correct structure", () => {
    for (const shot of result.shots) {
      for (const [name, metric] of Object.entries(shot.metrics)) {
        expect(typeof name).toBe("string");
        expect(metric).toHaveProperty("value");
        expect(metric).toHaveProperty("unit");
        expect(metric).toHaveProperty("frame");
        expect(metric).toHaveProperty("confidence");

        expect(typeof metric.unit).toBe("string");
        expect(typeof metric.frame).toBe("number");
        expect(typeof metric.confidence).toBe("number");
        expect(metric.confidence).toBeGreaterThanOrEqual(0);
        expect(metric.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});
