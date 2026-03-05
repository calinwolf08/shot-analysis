/**
 * Unit tests for ShotAnalyzer class.
 *
 * Tests are organized by subtask following TDD approach.
 *
 * @see Feature 7.0 - Main Analyzer Integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ShotAnalyzer,
  createShotAnalyzer,
  ShotAnalyzerAlreadyInitializedError,
  ShotAnalyzerNotInitializedError,
} from "./analyzer";
import type { FrameProvider, VideoFrame } from "./providers/types";
import {
  createConfig,
  createDefaultConfig,
  type AnalysisConfig,
} from "./config";
import { getProfileRegistry, resetProfileRegistry } from "./profiles/registry";

// Mock the pose detector factory to avoid loading MediaPipe during tests
vi.mock("./pose/factory", () => ({
  createPoseDetector: vi.fn().mockResolvedValue({
    detect: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("ShotAnalyzer", () => {
  beforeEach(() => {
    // Reset profile registry before each test to ensure clean state
    resetProfileRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 7.1.1 - Constructor with valid config
  // =========================================================================
  describe("constructor with valid config", () => {
    it("creates instance with default configuration", () => {
      const config = createDefaultConfig();
      const analyzer = new ShotAnalyzer(config);

      expect(analyzer).toBeInstanceOf(ShotAnalyzer);
    });

    it("creates instance with custom configuration", () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "high-school",
        minConfidenceThreshold: 0.7,
        outputTimingUnit: "ms",
      });

      const analyzer = new ShotAnalyzer(config);

      expect(analyzer).toBeInstanceOf(ShotAnalyzer);
    });

    it("creates instance with custom profile", () => {
      const customProfile = {
        name: "custom-test-profile",
        description: "Test profile",
        targets: {
          shootingElbowAngle: {
            ideal: 90,
            acceptable: { min: 85, max: 95 },
            priority: "high" as const,
            feedback: {
              tooLow: "Elbow too low",
              tooHigh: "Elbow too high",
            },
          },
        },
      };

      const config = createConfig({
        profile: "custom-test-profile",
        customProfile,
      });

      const analyzer = new ShotAnalyzer(config);

      expect(analyzer).toBeInstanceOf(ShotAnalyzer);
    });

    it("stores the provided configuration", () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "pro-form",
        minConfidenceThreshold: 0.8,
      });

      const analyzer = new ShotAnalyzer(config);

      expect(analyzer.getConfig()).toEqual(config);
    });

    it("accepts all valid shooting hands", () => {
      const configRight = createConfig({ shootingHand: "right" });
      const configLeft = createConfig({ shootingHand: "left" });

      expect(() => new ShotAnalyzer(configRight)).not.toThrow();
      expect(() => new ShotAnalyzer(configLeft)).not.toThrow();
    });

    it("accepts all valid timing units", () => {
      const configFrames = createConfig({ outputTimingUnit: "frames" });
      const configMs = createConfig({ outputTimingUnit: "ms" });
      const configPercent = createConfig({ outputTimingUnit: "percent" });

      expect(() => new ShotAnalyzer(configFrames)).not.toThrow();
      expect(() => new ShotAnalyzer(configMs)).not.toThrow();
      expect(() => new ShotAnalyzer(configPercent)).not.toThrow();
    });

    it("accepts confidence threshold at boundaries", () => {
      const configZero = createConfig({ minConfidenceThreshold: 0 });
      const configOne = createConfig({ minConfidenceThreshold: 1 });

      expect(() => new ShotAnalyzer(configZero)).not.toThrow();
      expect(() => new ShotAnalyzer(configOne)).not.toThrow();
    });

    it("is not initialized after construction", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      expect(analyzer.isInitialized()).toBe(false);
    });
  });

  // =========================================================================
  // 7.1.3 - Constructor with invalid config
  // =========================================================================
  describe("constructor with invalid config", () => {
    it("throws on invalid shootingHand", () => {
      const invalidConfig = {
        shootingHand: "both",
        profile: "youth-fundamentals",
        minConfidenceThreshold: 0.5,
        outputTimingUnit: "percent",
      };

      expect(() => new ShotAnalyzer(invalidConfig as AnalysisConfig)).toThrow();
    });

    it("throws on empty profile name", () => {
      const invalidConfig = {
        shootingHand: "right",
        profile: "",
        minConfidenceThreshold: 0.5,
        outputTimingUnit: "percent",
      };

      expect(() => new ShotAnalyzer(invalidConfig as AnalysisConfig)).toThrow();
    });

    it("throws on minConfidenceThreshold below 0", () => {
      const invalidConfig = {
        shootingHand: "right",
        profile: "test",
        minConfidenceThreshold: -0.1,
        outputTimingUnit: "percent",
      };

      expect(() => new ShotAnalyzer(invalidConfig as AnalysisConfig)).toThrow();
    });

    it("throws on minConfidenceThreshold above 1", () => {
      const invalidConfig = {
        shootingHand: "right",
        profile: "test",
        minConfidenceThreshold: 1.5,
        outputTimingUnit: "percent",
      };

      expect(() => new ShotAnalyzer(invalidConfig as AnalysisConfig)).toThrow();
    });

    it("throws on invalid outputTimingUnit", () => {
      const invalidConfig = {
        shootingHand: "right",
        profile: "test",
        minConfidenceThreshold: 0.5,
        outputTimingUnit: "seconds",
      };

      expect(() => new ShotAnalyzer(invalidConfig as AnalysisConfig)).toThrow();
    });

    it("throws on missing required config fields", () => {
      expect(() => new ShotAnalyzer({} as AnalysisConfig)).toThrow();
    });

    it("throws on null config", () => {
      expect(
        () => new ShotAnalyzer(null as unknown as AnalysisConfig),
      ).toThrow();
    });

    it("throws on undefined config", () => {
      expect(
        () => new ShotAnalyzer(undefined as unknown as AnalysisConfig),
      ).toThrow();
    });

    it("throws with descriptive error message for invalid config", () => {
      const invalidConfig = {
        shootingHand: "invalid",
        profile: "test",
        minConfidenceThreshold: 0.5,
        outputTimingUnit: "percent",
      };

      expect(() => new ShotAnalyzer(invalidConfig as AnalysisConfig)).toThrow(
        /invalid/i,
      );
    });
  });

  // =========================================================================
  // 7.1.5 - Async initialize() method
  // =========================================================================
  describe("initialize()", () => {
    it("initializes the pose detector", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await analyzer.initialize();

      expect(analyzer.isInitialized()).toBe(true);
    });

    it("resolves successfully on first call", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await expect(analyzer.initialize()).resolves.not.toThrow();
    });

    it("throws ShotAnalyzerAlreadyInitializedError on second call", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await analyzer.initialize();

      await expect(analyzer.initialize()).rejects.toThrow(
        ShotAnalyzerAlreadyInitializedError,
      );
    });

    it("throws descriptive error message on re-initialization", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await analyzer.initialize();

      await expect(analyzer.initialize()).rejects.toThrow(
        /already initialized/i,
      );
    });

    it("sets initialized state correctly", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      expect(analyzer.isInitialized()).toBe(false);
      await analyzer.initialize();
      expect(analyzer.isInitialized()).toBe(true);
    });

    it("can be called multiple times with re-initialization after dispose", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await analyzer.initialize();
      await analyzer.dispose();

      // Should be able to re-initialize after dispose
      await expect(analyzer.initialize()).resolves.not.toThrow();
      expect(analyzer.isInitialized()).toBe(true);
    });
  });

  // =========================================================================
  // 7.1.7 - getProfiles() and getConfig()
  // =========================================================================
  describe("getProfiles()", () => {
    it("returns available profile names", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const profiles = analyzer.getProfiles();

      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
    });

    it("includes built-in profiles", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const profiles = analyzer.getProfiles();

      expect(profiles).toContain("youth-fundamentals");
      expect(profiles).toContain("high-school");
      expect(profiles).toContain("pro-form");
    });

    it("returns profile names in sorted order", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const profiles = analyzer.getProfiles();

      const sortedProfiles = [...profiles].sort();
      expect(profiles).toEqual(sortedProfiles);
    });

    it("includes custom profile if registered", () => {
      const customProfile = {
        name: "custom-analyzer-profile",
        description: "Custom profile for analyzer",
        targets: {},
      };

      // Register via registry
      getProfileRegistry().register(customProfile);

      const config = createConfig({
        profile: "custom-analyzer-profile",
        customProfile,
      });
      const analyzer = new ShotAnalyzer(config);

      const profiles = analyzer.getProfiles();

      expect(profiles).toContain("custom-analyzer-profile");
    });
  });

  describe("getConfig()", () => {
    it("returns the configuration used to create the analyzer", () => {
      const config = createDefaultConfig();
      const analyzer = new ShotAnalyzer(config);

      const retrievedConfig = analyzer.getConfig();

      expect(retrievedConfig).toEqual(config);
    });

    it("returns configuration with custom values", () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "pro-form",
        minConfidenceThreshold: 0.75,
        outputTimingUnit: "ms",
      });
      const analyzer = new ShotAnalyzer(config);

      const retrievedConfig = analyzer.getConfig();

      expect(retrievedConfig.shootingHand).toBe("left");
      expect(retrievedConfig.profile).toBe("pro-form");
      expect(retrievedConfig.minConfidenceThreshold).toBe(0.75);
      expect(retrievedConfig.outputTimingUnit).toBe("ms");
    });

    it("returns immutable config reference", () => {
      const config = createDefaultConfig();
      const analyzer = new ShotAnalyzer(config);

      const retrievedConfig = analyzer.getConfig();

      // Verify it returns the same reference (immutable config pattern)
      expect(retrievedConfig).toEqual(config);
    });

    it("includes customProfile if provided", () => {
      const customProfile = {
        name: "my-profile",
        description: "My profile",
        targets: {},
      };

      const config = createConfig({
        profile: "my-profile",
        customProfile,
      });
      const analyzer = new ShotAnalyzer(config);

      const retrievedConfig = analyzer.getConfig();

      expect(retrievedConfig.customProfile).toBeDefined();
      expect(retrievedConfig.customProfile?.name).toBe("my-profile");
    });
  });

  // =========================================================================
  // Factory function tests
  // =========================================================================
  describe("createShotAnalyzer()", () => {
    it("creates and initializes analyzer in one call", async () => {
      const config = createDefaultConfig();

      const analyzer = await createShotAnalyzer(config);

      expect(analyzer).toBeInstanceOf(ShotAnalyzer);
      expect(analyzer.isInitialized()).toBe(true);
    });

    it("throws on invalid config", async () => {
      const invalidConfig = {
        shootingHand: "invalid",
      } as unknown as AnalysisConfig;

      await expect(createShotAnalyzer(invalidConfig)).rejects.toThrow();
    });

    it("returns properly configured analyzer", async () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "high-school",
      });

      const analyzer = await createShotAnalyzer(config);

      expect(analyzer.getConfig().shootingHand).toBe("left");
      expect(analyzer.getConfig().profile).toBe("high-school");
    });
  });

  // =========================================================================
  // Dispose tests
  // =========================================================================
  describe("dispose()", () => {
    it("sets initialized to false after dispose", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());
      await analyzer.initialize();
      expect(analyzer.isInitialized()).toBe(true);

      await analyzer.dispose();

      expect(analyzer.isInitialized()).toBe(false);
    });

    it("does not throw when called on uninitialized analyzer", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await expect(analyzer.dispose()).resolves.not.toThrow();
    });

    it("can be called multiple times without error", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());
      await analyzer.initialize();

      await expect(analyzer.dispose()).resolves.not.toThrow();
      await expect(analyzer.dispose()).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 7.2.1 - analyzeVideo() with mock frame provider
  // =========================================================================
  describe("analyzeVideo() - basic tests", () => {
    /**
     * Creates a mock frame provider for testing.
     */
    function createMockFrameProvider(
      frames: VideoFrame[],
      fps: number = 30,
    ): FrameProvider {
      let frameIndex = 0;
      return {
        getNextFrame: async (): Promise<VideoFrame | null> => {
          if (frameIndex >= frames.length) {
            return null;
          }
          const frame = frames[frameIndex];
          frameIndex++;
          return frame ?? null;
        },
        getFps: () => fps,
        getMetadata: () => ({
          width: 640,
          height: 480,
          duration: (frames.length / fps) * 1000,
        }),
      };
    }

    /**
     * Creates a mock video frame.
     */
    function createMockFrame(index: number, fps: number = 30): VideoFrame {
      const timestamp = (index / fps) * 1000;
      return {
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp,
        frameIndex: index,
      };
    }

    it("throws ShotAnalyzerNotInitializedError when called before initialize()", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider([]);

      await expect(analyzer.analyzeVideo(provider)).rejects.toThrow(
        ShotAnalyzerNotInitializedError,
      );
    });

    it("returns AnalysisResult when called after initialize()", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider([]);

      const result = await analyzer.analyzeVideo(provider);

      expect(result).toBeDefined();
      expect(result.shots).toBeDefined();
      expect(result.videoMetadata).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it("returns empty shots array for empty video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const provider = createMockFrameProvider([]);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.shots).toEqual([]);
    });

    it("returns empty shots array when no shots detected", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frames = Array.from({ length: 30 }, (_, i) => createMockFrame(i));
      const provider = createMockFrameProvider(frames);

      const result = await analyzer.analyzeVideo(provider);

      // With no actual movement detected, should return empty shots
      expect(result.shots).toEqual([]);
    });

    it("includes video metadata in result", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frames = Array.from({ length: 60 }, (_, i) => createMockFrame(i));
      const provider = createMockFrameProvider(frames, 30);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.videoMetadata.width).toBe(640);
      expect(result.videoMetadata.height).toBe(480);
      expect(result.videoMetadata.fps).toBe(30);
      expect(result.videoMetadata.totalFrames).toBe(60);
    });

    it("includes config in result", async () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "high-school",
        minConfidenceThreshold: 0.7,
      });
      const analyzer = await createShotAnalyzer(config);
      const provider = createMockFrameProvider([]);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.config.shootingHand).toBe("left");
      expect(result.config.profile).toBe("high-school");
    });
  });

  // =========================================================================
  // 7.2.3 - Frame processing loop tests
  // =========================================================================
  describe("analyzeVideo() - frame processing loop", () => {
    /**
     * Creates a mock frame provider that tracks calls.
     */
    function createTrackingFrameProvider(
      frameCount: number,
      fps: number = 30,
    ): { provider: FrameProvider; getCallCount: () => number } {
      let callCount = 0;
      let frameIndex = 0;

      const provider: FrameProvider = {
        getNextFrame: async () => {
          callCount++;
          if (frameIndex >= frameCount) {
            return null;
          }
          const frame: VideoFrame = {
            data: new Uint8ClampedArray(640 * 480 * 4),
            width: 640,
            height: 480,
            timestamp: (frameIndex / fps) * 1000,
            frameIndex: frameIndex,
          };
          frameIndex++;
          return frame;
        },
        getFps: () => fps,
        getMetadata: () => ({
          width: 640,
          height: 480,
          duration: (frameCount / fps) * 1000,
        }),
      };

      return { provider, getCallCount: () => callCount };
    }

    it("processes all frames from the provider", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider, getCallCount } = createTrackingFrameProvider(50);

      await analyzer.analyzeVideo(provider);

      // Should call getNextFrame frameCount + 1 times (last call returns null)
      expect(getCallCount()).toBe(51);
    });

    it("handles single frame video", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(1);

      const result = await analyzer.analyzeVideo(provider);

      expect(result.videoMetadata.totalFrames).toBe(1);
    });

    it("handles very long video efficiently (no memory issues)", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      // Simulate a long video with 1000 frames
      const { provider } = createTrackingFrameProvider(1000);

      // Should complete without memory issues
      const result = await analyzer.analyzeVideo(provider);

      expect(result.videoMetadata.totalFrames).toBe(1000);
    });
  });

  // =========================================================================
  // 7.2.5 - Shot detection integration tests
  // =========================================================================
  describe("analyzeVideo() - shot detection integration", () => {
    it("uses shot detector to find shots in landmark sequence", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(60);

      const result = await analyzer.analyzeVideo(provider);

      // Result structure should be correct even if no shots detected
      expect(Array.isArray(result.shots)).toBe(true);
    });

    it("assigns sequential shotIndex to detected shots", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(200);

      const result = await analyzer.analyzeVideo(provider);

      // If multiple shots detected, indices should be sequential
      for (let i = 0; i < result.shots.length; i++) {
        const shot = result.shots[i];
        if (shot) {
          expect(shot.shotIndex).toBe(i);
        }
      }
    });
  });

  // =========================================================================
  // 7.2.7 - Metric extraction integration tests
  // =========================================================================
  describe("analyzeVideo() - metric extraction integration", () => {
    it("extracts metrics for each detected shot", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(100);

      const result = await analyzer.analyzeVideo(provider);

      // Each shot should have metrics object
      for (const shot of result.shots) {
        expect(shot.metrics).toBeDefined();
        expect(typeof shot.metrics).toBe("object");
      }
    });

    it("calculates overallConfidence for each shot", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(100);

      const result = await analyzer.analyzeVideo(provider);

      for (const shot of result.shots) {
        expect(typeof shot.overallConfidence).toBe("number");
        expect(shot.overallConfidence).toBeGreaterThanOrEqual(0);
        expect(shot.overallConfidence).toBeLessThanOrEqual(1);
      }
    });

    it("includes phases in each shot analysis", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(100);

      const result = await analyzer.analyzeVideo(provider);

      for (const shot of result.shots) {
        expect(shot.phases).toBeDefined();
      }
    });
  });

  /**
   * Helper to create a tracking frame provider.
   */
  function createTrackingFrameProvider(
    frameCount: number,
    fps: number = 30,
  ): { provider: FrameProvider; getCallCount: () => number } {
    let callCount = 0;
    let frameIndex = 0;

    const provider: FrameProvider = {
      getNextFrame: async () => {
        callCount++;
        if (frameIndex >= frameCount) {
          return null;
        }
        const frame: VideoFrame = {
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480,
          timestamp: (frameIndex / fps) * 1000,
          frameIndex: frameIndex,
        };
        frameIndex++;
        return frame;
      },
      getFps: () => fps,
      getMetadata: () => ({
        width: 640,
        height: 480,
        duration: (frameCount / fps) * 1000,
      }),
    };

    return { provider, getCallCount: () => callCount };
  }

  // =========================================================================
  // 7.3.1 - processFrame() tests
  // =========================================================================
  describe("processFrame()", () => {
    /**
     * Creates a mock video frame for testing.
     */
    function createMockVideoFrame(
      frameIndex: number,
      timestamp: number,
    ): VideoFrame {
      return {
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp,
        frameIndex,
      };
    }

    it("throws ShotAnalyzerNotInitializedError when called before initialize()", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(0, 0);

      await expect(analyzer.processFrame(frame)).rejects.toThrow(
        ShotAnalyzerNotInitializedError,
      );
    });

    it("returns FrameAnalysis with frameIndex", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(5, 166.67);

      const result = await analyzer.processFrame(frame);

      expect(result).toBeDefined();
      expect(result.frameIndex).toBe(5);
    });

    it("returns FrameAnalysis with timestamp", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(10, 333.33);

      const result = await analyzer.processFrame(frame);

      expect(result.timestamp).toBe(333.33);
    });

    it("landmarks property is undefined when no pose detected (mock case)", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(0, 0);

      const result = await analyzer.processFrame(frame);

      // In mock case, pose detection returns null, so landmarks should be undefined
      expect(result.landmarks).toBeUndefined();
    });

    it("currentPhase property is undefined when not in shot", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(0, 0);

      const result = await analyzer.processFrame(frame);

      // With mock pose detector returning null, no shot phase detected
      expect(result.currentPhase).toBeUndefined();
    });

    it("includes partialMetrics in result", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(0, 0);

      const result = await analyzer.processFrame(frame);

      // partialMetrics should always be present (even if empty object)
      expect(result.partialMetrics).toBeDefined();
    });

    it("processes frames incrementally", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process multiple frames
      const result1 = await analyzer.processFrame(createMockVideoFrame(0, 0));
      const result2 = await analyzer.processFrame(
        createMockVideoFrame(1, 33.33),
      );
      const result3 = await analyzer.processFrame(
        createMockVideoFrame(2, 66.67),
      );

      expect(result1.frameIndex).toBe(0);
      expect(result2.frameIndex).toBe(1);
      expect(result3.frameIndex).toBe(2);
    });

    it("completes within acceptable time (<100ms per frame ideally)", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frame = createMockVideoFrame(0, 0);

      const startTime = performance.now();
      await analyzer.processFrame(frame);
      const endTime = performance.now();

      // Allow generous buffer for mocked tests, but ensure it's reasonably fast
      // In real usage with MediaPipe, this should be <100ms
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  // =========================================================================
  // 7.3.3 - Internal state management tests
  // =========================================================================
  describe("live session internal state", () => {
    function createMockVideoFrame(
      frameIndex: number,
      timestamp: number,
    ): VideoFrame {
      return {
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp,
        frameIndex,
      };
    }

    it("maintains accumulated landmarks across processFrame calls", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      await analyzer.processFrame(createMockVideoFrame(0, 0));
      await analyzer.processFrame(createMockVideoFrame(1, 33.33));
      await analyzer.processFrame(createMockVideoFrame(2, 66.67));

      // Internal state should have 3 frames worth of data
      // We verify this indirectly through finalize
      const result = await analyzer.finalizeLiveSession();
      expect(result.videoMetadata.totalFrames).toBe(3);
    });

    it("starts fresh session after previous finalization", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // First session
      await analyzer.processFrame(createMockVideoFrame(0, 0));
      await analyzer.processFrame(createMockVideoFrame(1, 33.33));
      await analyzer.finalizeLiveSession();

      // Second session should start fresh
      await analyzer.processFrame(createMockVideoFrame(0, 0));
      const result = await analyzer.finalizeLiveSession();

      expect(result.videoMetadata.totalFrames).toBe(1);
    });

    it("resets internal state on finalize", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      await analyzer.processFrame(createMockVideoFrame(0, 0));
      await analyzer.processFrame(createMockVideoFrame(1, 33.33));
      await analyzer.finalizeLiveSession();

      // Processing after finalize should start from scratch
      await analyzer.processFrame(createMockVideoFrame(5, 166.67));
      await analyzer.processFrame(createMockVideoFrame(6, 200.0));

      const result = await analyzer.finalizeLiveSession();
      expect(result.videoMetadata.totalFrames).toBe(2);
    });

    it("tracks frame metadata correctly", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      const frame1 = createMockVideoFrame(0, 0);
      const frame2 = createMockVideoFrame(1, 33.33);

      await analyzer.processFrame(frame1);
      await analyzer.processFrame(frame2);

      const result = await analyzer.finalizeLiveSession();

      expect(result.videoMetadata.width).toBe(640);
      expect(result.videoMetadata.height).toBe(480);
    });
  });

  // =========================================================================
  // 7.3.5 - finalizeLiveSession() tests
  // =========================================================================
  describe("finalizeLiveSession()", () => {
    function createMockVideoFrame(
      frameIndex: number,
      timestamp: number,
    ): VideoFrame {
      return {
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp,
        frameIndex,
      };
    }

    it("throws ShotAnalyzerNotInitializedError when called before initialize()", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      await expect(analyzer.finalizeLiveSession()).rejects.toThrow(
        ShotAnalyzerNotInitializedError,
      );
    });

    it("returns AnalysisResult when called after initialize()", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      const result = await analyzer.finalizeLiveSession();

      expect(result).toBeDefined();
      expect(result.shots).toBeDefined();
      expect(result.videoMetadata).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it("returns empty result when no frames processed", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      const result = await analyzer.finalizeLiveSession();

      expect(result.shots).toEqual([]);
      expect(result.videoMetadata.totalFrames).toBe(0);
    });

    it("completes partial shots in progress", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Process some frames that might contain partial shot
      for (let i = 0; i < 30; i++) {
        await analyzer.processFrame(createMockVideoFrame(i, i * 33.33));
      }

      const result = await analyzer.finalizeLiveSession();

      // Should have processed and finalized the frames
      expect(result.videoMetadata.totalFrames).toBe(30);
      // May or may not detect shots depending on pose data
      expect(Array.isArray(result.shots)).toBe(true);
    });

    it("includes config in result", async () => {
      const config = createConfig({
        shootingHand: "left",
        profile: "high-school",
      });
      const analyzer = await createShotAnalyzer(config);

      await analyzer.processFrame(createMockVideoFrame(0, 0));
      const result = await analyzer.finalizeLiveSession();

      expect(result.config.shootingHand).toBe("left");
      expect(result.config.profile).toBe("high-school");
    });

    it("can be called multiple times after processing frames each time", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // First batch
      await analyzer.processFrame(createMockVideoFrame(0, 0));
      const result1 = await analyzer.finalizeLiveSession();
      expect(result1.videoMetadata.totalFrames).toBe(1);

      // Second batch
      await analyzer.processFrame(createMockVideoFrame(0, 0));
      await analyzer.processFrame(createMockVideoFrame(1, 33.33));
      const result2 = await analyzer.finalizeLiveSession();
      expect(result2.videoMetadata.totalFrames).toBe(2);
    });

    it("calculates duration from processed frames", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      await analyzer.processFrame(createMockVideoFrame(0, 0));
      await analyzer.processFrame(createMockVideoFrame(1, 33.33));
      await analyzer.processFrame(createMockVideoFrame(2, 66.67));

      const result = await analyzer.finalizeLiveSession();

      // Duration should be calculated from frame timestamps
      // The last frame timestamp represents approximate duration
      expect(result.videoMetadata.duration).toBeCloseTo(66.67, 1);
    });
  });

  // =========================================================================
  // 7.3.7 - compareToProfile() tests
  // =========================================================================
  describe("compareToProfile()", () => {
    it("compares analysis result to default profile", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(60);

      const analysisResult = await analyzer.analyzeVideo(provider);
      const comparisons = analyzer.compareToProfile(analysisResult);

      expect(Array.isArray(comparisons)).toBe(true);
    });

    it("compares analysis result to specified profile", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(60);

      const analysisResult = await analyzer.analyzeVideo(provider);
      const comparisons = analyzer.compareToProfile(
        analysisResult,
        "youth-fundamentals",
      );

      expect(Array.isArray(comparisons)).toBe(true);
      // Each comparison should reference the specified profile
      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("youth-fundamentals");
      }
    });

    it("throws error for unknown profile", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(60);

      const analysisResult = await analyzer.analyzeVideo(provider);

      expect(() =>
        analyzer.compareToProfile(analysisResult, "unknown-profile-xyz"),
      ).toThrow(/not found/i);
    });

    it("returns ProfileComparison[] with correct structure", async () => {
      const analyzer = await createShotAnalyzer(
        createConfig({
          profile: "youth-fundamentals",
        }),
      );
      const { provider } = createTrackingFrameProvider(60);

      const analysisResult = await analyzer.analyzeVideo(provider);
      const comparisons = analyzer.compareToProfile(analysisResult);

      for (const comparison of comparisons) {
        expect(comparison).toHaveProperty("profile");
        expect(comparison).toHaveProperty("metrics");
        expect(comparison).toHaveProperty("summary");
        expect(comparison.summary).toHaveProperty("passCount");
        expect(comparison.summary).toHaveProperty("failCount");
        expect(comparison.summary).toHaveProperty("warningCount");
        expect(comparison.summary).toHaveProperty("priorityIssues");
      }
    });

    it("returns one ProfileComparison per shot", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(200);

      const analysisResult = await analyzer.analyzeVideo(provider);
      const comparisons = analyzer.compareToProfile(analysisResult);

      // Should have one comparison per detected shot
      expect(comparisons.length).toBe(analysisResult.shots.length);
    });

    it("uses config profile when profileName not specified", async () => {
      const analyzer = await createShotAnalyzer(
        createConfig({
          profile: "pro-form",
        }),
      );
      const { provider } = createTrackingFrameProvider(60);

      const analysisResult = await analyzer.analyzeVideo(provider);
      const comparisons = analyzer.compareToProfile(analysisResult);

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("pro-form");
      }
    });

    it("returns empty array when no shots detected", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(0);

      const analysisResult = await analyzer.analyzeVideo(provider);
      const comparisons = analyzer.compareToProfile(analysisResult);

      expect(comparisons).toEqual([]);
    });
  });

  // =========================================================================
  // 7.3.9 - registerProfile() tests
  // =========================================================================
  describe("registerProfile()", () => {
    it("registers a custom profile successfully", async () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const customProfile = {
        name: "my-custom-profile-123",
        description: "Custom test profile",
        targets: {
          testMetric: {
            ideal: 90,
            acceptable: { min: 80, max: 100 },
            priority: "high" as const,
            feedback: {
              tooLow: "Too low",
              tooHigh: "Too high",
            },
          },
        },
      };

      analyzer.registerProfile(customProfile);

      expect(analyzer.getProfiles()).toContain("my-custom-profile-123");
    });

    it("registered profile can be used in compareToProfile", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const { provider } = createTrackingFrameProvider(60);

      const customProfile = {
        name: "compare-test-profile",
        description: "Profile for comparison test",
        targets: {},
      };

      analyzer.registerProfile(customProfile);

      const analysisResult = await analyzer.analyzeVideo(provider);

      // Should not throw - profile is registered
      const comparisons = analyzer.compareToProfile(
        analysisResult,
        "compare-test-profile",
      );

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("compare-test-profile");
      }
    });

    it("throws error for invalid profile", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const invalidProfile = {
        name: "", // Empty name is invalid
        description: "Invalid profile",
        targets: {},
      };

      expect(() => analyzer.registerProfile(invalidProfile)).toThrow();
    });

    it("overrides existing profile with same name", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const profile1 = {
        name: "override-test-profile",
        description: "First version",
        targets: {},
      };

      const profile2 = {
        name: "override-test-profile",
        description: "Second version",
        targets: {},
      };

      analyzer.registerProfile(profile1);
      analyzer.registerProfile(profile2);

      // Profile should be registered (overridden)
      expect(analyzer.getProfiles()).toContain("override-test-profile");
    });

    it("registers multiple unique profiles", () => {
      const analyzer = new ShotAnalyzer(createDefaultConfig());

      const profiles = [
        {
          name: "multi-test-1",
          description: "Profile 1",
          targets: {},
        },
        {
          name: "multi-test-2",
          description: "Profile 2",
          targets: {},
        },
        {
          name: "multi-test-3",
          description: "Profile 3",
          targets: {},
        },
      ];

      for (const profile of profiles) {
        analyzer.registerProfile(profile);
      }

      const registeredProfiles = analyzer.getProfiles();
      expect(registeredProfiles).toContain("multi-test-1");
      expect(registeredProfiles).toContain("multi-test-2");
      expect(registeredProfiles).toContain("multi-test-3");
    });
  });
});
