/**
 * End-to-End Tests for Live Session Workflow.
 *
 * These tests verify the live session analysis pipeline where frames
 * are processed incrementally (one at a time) rather than from a
 * complete video file. This workflow is typical for real-time camera
 * feeds in browser applications.
 *
 * @see Feature 7.3 - Live Session Support
 * @see Feature 7.4 - End-to-End Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createShotAnalyzer } from "../../src/analyzer";
import { createConfig, createDefaultConfig } from "../../src/config";
import { resetProfileRegistry } from "../../src/profiles/registry";
import {
  createMockFrame,
  createMockPoseDetector,
  createLiveStreamFrameProvider,
  LIVE_SESSION_SCENARIO,
  SINGLE_SHOT_SCENARIO,
  MULTI_SHOT_SCENARIO,
} from "./test-fixtures";

// Mock the pose detector factory
vi.mock("../../src/pose/factory", () => ({
  createPoseDetector: vi.fn(),
}));

import { createPoseDetector } from "../../src/pose/factory";

// ============================================================================
// E2E Test Suite: Live Session Workflow
// ============================================================================

describe("E2E: Live Session Workflow", () => {
  beforeEach(() => {
    resetProfileRegistry();
    vi.clearAllMocks();

    // Configure mock pose detector for live session scenario
    vi.mocked(createPoseDetector).mockResolvedValue(
      createMockPoseDetector(LIVE_SESSION_SCENARIO),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("basic frame processing", () => {
    it("processes frames incrementally and returns frame analysis", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process first frame
      const frame1 = createMockFrame(0);
      const analysis1 = await analyzer.processFrame(frame1);

      expect(analysis1).toHaveProperty("frameIndex");
      expect(analysis1).toHaveProperty("timestamp");
      expect(analysis1.frameIndex).toBe(0);
      expect(analysis1.timestamp).toBe(0);

      // Process second frame
      const frame2 = createMockFrame(1);
      const analysis2 = await analyzer.processFrame(frame2);

      expect(analysis2.frameIndex).toBe(1);

      await analyzer.dispose();
    });

    it("accumulates landmarks for processed frames", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process multiple frames
      for (let i = 0; i < 30; i++) {
        const frame = createMockFrame(i);
        const analysis = await analyzer.processFrame(frame);

        expect(analysis.frameIndex).toBe(i);
        // Landmarks may or may not be present depending on pose detection
        if (analysis.landmarks) {
          expect(analysis.landmarks).toHaveProperty("landmarks");
          expect(analysis.landmarks).toHaveProperty("confidence");
        }
      }

      await analyzer.dispose();
    });

    it("detects current phase during shot motion", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process frames covering a shot
      const shotStartFrame = LIVE_SESSION_SCENARIO.shotPatterns[0]!.startFrame;
      const shotDuration = LIVE_SESSION_SCENARIO.shotPatterns[0]!.duration;

      // Process frames before, during, and after shot
      for (let i = 0; i < shotStartFrame + shotDuration + 10; i++) {
        const frame = createMockFrame(i);
        const analysis = await analyzer.processFrame(frame);

        // During shot, may detect current phase
        if (
          i >= shotStartFrame &&
          i < shotStartFrame + shotDuration &&
          analysis.currentPhase
        ) {
          expect([
            "gather",
            "load",
            "rise",
            "setPoint",
            "release",
            "followThrough",
          ]).toContain(analysis.currentPhase);
        }
      }

      await analyzer.dispose();
    });
  });

  describe("session finalization", () => {
    it("returns complete analysis result when session is finalized", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process frames covering the live session
      for (let i = 0; i < LIVE_SESSION_SCENARIO.totalFrames; i++) {
        const frame = createMockFrame(i);
        await analyzer.processFrame(frame);
      }

      // Finalize session
      const result = await analyzer.finalizeLiveSession();

      // Verify result structure
      expect(result).toHaveProperty("shots");
      expect(result).toHaveProperty("videoMetadata");
      expect(result).toHaveProperty("config");

      // Verify video metadata
      expect(result.videoMetadata.totalFrames).toBe(
        LIVE_SESSION_SCENARIO.totalFrames,
      );

      await analyzer.dispose();
    });

    it("returns empty result when no frames processed", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Finalize without processing any frames
      const result = await analyzer.finalizeLiveSession();

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(0);

      await analyzer.dispose();
    });

    it("returns empty result with minimal frames", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process just one frame
      const frame = createMockFrame(0);
      await analyzer.processFrame(frame);

      const result = await analyzer.finalizeLiveSession();

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(1);

      await analyzer.dispose();
    });

    it("resets internal state after finalization", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // First session
      for (let i = 0; i < 30; i++) {
        await analyzer.processFrame(createMockFrame(i));
      }
      const result1 = await analyzer.finalizeLiveSession();

      // Second session should start fresh
      for (let i = 0; i < 20; i++) {
        await analyzer.processFrame(createMockFrame(i));
      }
      const result2 = await analyzer.finalizeLiveSession();

      // Each session should have its own frame count
      expect(result1.videoMetadata.totalFrames).toBe(30);
      expect(result2.videoMetadata.totalFrames).toBe(20);

      await analyzer.dispose();
    });
  });

  describe("live stream metadata", () => {
    it("handles live stream without duration in metadata", async () => {
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(SINGLE_SHOT_SCENARIO),
      );

      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createLiveStreamFrameProvider(60, 30);

      // Simulate consuming frames like a live stream
      let frame = await frameProvider.getNextFrame();
      while (frame !== null) {
        await analyzer.processFrame(frame);
        frame = await frameProvider.getNextFrame();
      }

      const result = await analyzer.finalizeLiveSession();

      expect(result.videoMetadata.totalFrames).toBe(60);
      // Duration is calculated from timestamps in live session
      expect(result.videoMetadata.duration).toBeDefined();

      await analyzer.dispose();
    });

    it("calculates FPS from processed frame timestamps", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process frames at 30fps
      for (let i = 0; i < 30; i++) {
        const frame = createMockFrame(i, 30); // 30fps
        await analyzer.processFrame(frame);
      }

      const result = await analyzer.finalizeLiveSession();

      // FPS should be approximately 30 (calculated from timestamps)
      expect(result.videoMetadata.fps).toBeGreaterThan(0);

      await analyzer.dispose();
    });
  });

  describe("shot detection in live session", () => {
    it("detects shots from accumulated frame data", async () => {
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(MULTI_SHOT_SCENARIO),
      );

      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process frames covering multiple shots
      for (let i = 0; i < MULTI_SHOT_SCENARIO.totalFrames; i++) {
        const frame = createMockFrame(i);
        await analyzer.processFrame(frame);
      }

      const result = await analyzer.finalizeLiveSession();

      // Should detect shots after finalization
      expect(Array.isArray(result.shots)).toBe(true);

      // Each shot should have proper structure
      for (const shot of result.shots) {
        expect(shot).toHaveProperty("shotIndex");
        expect(shot).toHaveProperty("frameRange");
        expect(shot).toHaveProperty("phases");
        expect(shot).toHaveProperty("metrics");
        expect(shot).toHaveProperty("overallConfidence");
      }

      await analyzer.dispose();
    });

    it("extracts metrics for shots in live session", async () => {
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(SINGLE_SHOT_SCENARIO),
      );

      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process frames
      for (let i = 0; i < SINGLE_SHOT_SCENARIO.totalFrames; i++) {
        const frame = createMockFrame(i);
        await analyzer.processFrame(frame);
      }

      const result = await analyzer.finalizeLiveSession();

      // Metrics should be present for detected shots
      for (const shot of result.shots) {
        expect(shot.metrics).toBeDefined();
        expect(typeof shot.metrics).toBe("object");

        for (const metric of Object.values(shot.metrics)) {
          expect(metric).toHaveProperty("value");
          expect(metric).toHaveProperty("unit");
          expect(metric).toHaveProperty("frame");
          expect(metric).toHaveProperty("confidence");
        }
      }

      await analyzer.dispose();
    });
  });

  describe("interruption handling", () => {
    it("handles session finalization at any point gracefully", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process only a few frames (simulating interruption)
      for (let i = 0; i < 5; i++) {
        const frame = createMockFrame(i);
        await analyzer.processFrame(frame);
      }

      // Finalize early (interrupted session)
      const result = await analyzer.finalizeLiveSession();

      // Should still return valid result
      expect(result).toHaveProperty("shots");
      expect(result).toHaveProperty("videoMetadata");
      expect(result).toHaveProperty("config");
      expect(result.videoMetadata.totalFrames).toBe(5);

      await analyzer.dispose();
    });

    it("can start new session after interrupted one", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // First interrupted session
      for (let i = 0; i < 10; i++) {
        await analyzer.processFrame(createMockFrame(i));
      }
      await analyzer.finalizeLiveSession();

      // Second complete session
      for (let i = 0; i < 50; i++) {
        await analyzer.processFrame(createMockFrame(i));
      }
      const result = await analyzer.finalizeLiveSession();

      expect(result.videoMetadata.totalFrames).toBe(50);

      await analyzer.dispose();
    });

    it("handles multiple finalizations without processing", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Multiple finalizations without new frames
      const result1 = await analyzer.finalizeLiveSession();
      const result2 = await analyzer.finalizeLiveSession();
      const result3 = await analyzer.finalizeLiveSession();

      expect(result1.shots).toEqual([]);
      expect(result2.shots).toEqual([]);
      expect(result3.shots).toEqual([]);

      await analyzer.dispose();
    });
  });

  describe("configuration in live sessions", () => {
    it("respects shooting hand configuration", async () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "youth-fundamentals",
      });
      const analyzer = await createShotAnalyzer(config);

      for (let i = 0; i < 30; i++) {
        await analyzer.processFrame(createMockFrame(i));
      }

      const result = await analyzer.finalizeLiveSession();

      expect(result.config.shootingHand).toBe("left");

      await analyzer.dispose();
    });

    it("uses correct profile in live session", async () => {
      const config = createConfig({
        shootingHand: "right",
        profile: "pro-form",
      });
      const analyzer = await createShotAnalyzer(config);

      for (let i = 0; i < 30; i++) {
        await analyzer.processFrame(createMockFrame(i));
      }

      const result = await analyzer.finalizeLiveSession();

      expect(result.config.profile).toBe("pro-form");

      await analyzer.dispose();
    });
  });
});

// ============================================================================
// E2E Test Suite: Live Session Frame Analysis Structure
// ============================================================================

describe("E2E: Frame Analysis Structure", () => {
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

  it("frame analysis has correct structure", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frame = createMockFrame(15); // Frame during shot

    const analysis = await analyzer.processFrame(frame);

    // Required properties
    expect(analysis).toHaveProperty("frameIndex");
    expect(analysis).toHaveProperty("timestamp");

    // Type checks
    expect(typeof analysis.frameIndex).toBe("number");
    expect(typeof analysis.timestamp).toBe("number");

    await analyzer.dispose();
  });

  it("frame analysis includes landmarks when pose detected", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frame = createMockFrame(20); // Frame during shot

    const analysis = await analyzer.processFrame(frame);

    // Landmarks may or may not be present
    if (analysis.landmarks) {
      expect(analysis.landmarks).toHaveProperty("landmarks");
      expect(analysis.landmarks).toHaveProperty("confidence");
      expect(Array.isArray(analysis.landmarks.landmarks)).toBe(true);
      expect(typeof analysis.landmarks.confidence).toBe("number");
    }

    await analyzer.dispose();
  });

  it("frame analysis includes partial metrics", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const frame = createMockFrame(25);

    const analysis = await analyzer.processFrame(frame);

    // Partial metrics should be present (may be empty)
    expect(analysis).toHaveProperty("partialMetrics");
    expect(typeof analysis.partialMetrics).toBe("object");

    await analyzer.dispose();
  });
});
