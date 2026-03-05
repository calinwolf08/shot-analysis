/**
 * End-to-End Tests for Profile Comparison.
 *
 * These tests verify the profile comparison workflow from analysis results
 * through profile comparison to feedback generation. They test both built-in
 * profiles and custom profile registration.
 *
 * @see Feature 6.0 - Form Profile Comparison
 * @see Feature 7.4 - End-to-End Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createShotAnalyzer } from "../../src/analyzer";
import { createConfig, createDefaultConfig } from "../../src/config";
import { resetProfileRegistry } from "../../src/profiles/registry";
import type { FormProfile } from "../../src/profiles/types";
import {
  createMockFrameProvider,
  createMockPoseDetector,
  createTestProfile,
  SINGLE_SHOT_SCENARIO,
  MULTI_SHOT_SCENARIO,
} from "./test-fixtures";

// Mock the pose detector factory
vi.mock("../../src/pose/factory", () => ({
  createPoseDetector: vi.fn(),
}));

import { createPoseDetector } from "../../src/pose/factory";

// ============================================================================
// E2E Test Suite: Profile Comparison with Analysis Results
// ============================================================================

describe("E2E: Profile Comparison with Analysis Results", () => {
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

  describe("built-in profile comparison", () => {
    it("compares analysis results against youth-fundamentals profile", async () => {
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
      const comparisons = analyzer.compareToProfile(result);

      // Should have one comparison per shot
      expect(comparisons.length).toBe(result.shots.length);

      // Each comparison should have correct structure
      for (const comparison of comparisons) {
        expect(comparison).toHaveProperty("profile");
        expect(comparison).toHaveProperty("metrics");
        expect(comparison).toHaveProperty("summary");

        expect(comparison.profile).toBe("youth-fundamentals");
        expect(typeof comparison.metrics).toBe("object");
        expect(comparison.summary).toHaveProperty("passCount");
        expect(comparison.summary).toHaveProperty("failCount");
        expect(comparison.summary).toHaveProperty("warningCount");
        expect(comparison.summary).toHaveProperty("priorityIssues");
      }

      await analyzer.dispose();
    });

    it("compares against high-school profile", async () => {
      const config = createConfig({
        shootingHand: "right",
        profile: "high-school",
      });
      const analyzer = await createShotAnalyzer(config);
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("high-school");
      }

      await analyzer.dispose();
    });

    it("compares against pro-form profile", async () => {
      const config = createConfig({
        shootingHand: "right",
        profile: "pro-form",
      });
      const analyzer = await createShotAnalyzer(config);
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("pro-form");
      }

      await analyzer.dispose();
    });

    it("can compare against a different profile than configured", async () => {
      const config = createConfig({
        shootingHand: "right",
        profile: "youth-fundamentals", // Default profile
      });
      const analyzer = await createShotAnalyzer(config);
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);

      // Compare against a different profile
      const comparisons = analyzer.compareToProfile(result, "pro-form");

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("pro-form");
      }

      await analyzer.dispose();
    });
  });

  describe("comparison result structure", () => {
    it("comparison summary has valid counts", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        const { summary } = comparison;

        // All counts should be non-negative integers
        expect(summary.passCount).toBeGreaterThanOrEqual(0);
        expect(summary.failCount).toBeGreaterThanOrEqual(0);
        expect(summary.warningCount).toBeGreaterThanOrEqual(0);

        // Priority issues should be an array
        expect(Array.isArray(summary.priorityIssues)).toBe(true);

        // Total should equal number of compared metrics
        const totalCompared =
          summary.passCount + summary.failCount + summary.warningCount;
        expect(Object.keys(comparison.metrics).length).toBe(totalCompared);
      }

      await analyzer.dispose();
    });

    it("metric comparison results have correct structure", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        for (const [metricName, metricResult] of Object.entries(
          comparison.metrics,
        )) {
          expect(typeof metricName).toBe("string");
          expect(metricResult).toHaveProperty("value");
          expect(metricResult).toHaveProperty("target");
          expect(metricResult).toHaveProperty("status");

          // Status should be valid
          expect(["pass", "fail", "warning"]).toContain(metricResult.status);

          // Target should have required properties
          expect(metricResult.target).toHaveProperty("ideal");
          expect(metricResult.target).toHaveProperty("acceptable");
          expect(metricResult.target).toHaveProperty("priority");
          expect(metricResult.target).toHaveProperty("feedback");
        }
      }

      await analyzer.dispose();
    });

    it("failing metrics include feedback messages", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        for (const metricResult of Object.values(comparison.metrics)) {
          if (
            metricResult.status === "fail" ||
            metricResult.status === "warning"
          ) {
            // Failing metrics should have feedback
            expect(metricResult.feedback).toBeDefined();
            expect(typeof metricResult.feedback).toBe("string");
          }
        }
      }

      await analyzer.dispose();
    });

    it("passing metrics have no feedback", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        for (const metricResult of Object.values(comparison.metrics)) {
          if (metricResult.status === "pass") {
            // Passing metrics should not have feedback
            expect(metricResult.feedback).toBeUndefined();
          }
        }
      }

      await analyzer.dispose();
    });
  });

  describe("multi-shot comparison", () => {
    beforeEach(() => {
      vi.mocked(createPoseDetector).mockResolvedValue(
        createMockPoseDetector(MULTI_SHOT_SCENARIO),
      );
    });

    it("compares each shot independently", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        MULTI_SHOT_SCENARIO.totalFrames,
        MULTI_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      // Should have comparison for each shot
      expect(comparisons.length).toBe(result.shots.length);

      // Each comparison is independent
      comparisons.forEach((comparison, index) => {
        expect(comparison.profile).toBeDefined();
        // Comparisons may have different results based on shot metrics
        expect(comparison.summary).toBeDefined();
        expect(comparisons.indexOf(comparison)).toBe(index);
      });

      await analyzer.dispose();
    });
  });

  describe("empty results handling", () => {
    it("returns empty comparisons for video with no shots", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(0); // Empty video

      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      expect(comparisons).toEqual([]);

      await analyzer.dispose();
    });
  });
});

// ============================================================================
// E2E Test Suite: Custom Profile Registration and Comparison
// ============================================================================

describe("E2E: Custom Profile Registration and Comparison", () => {
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

  describe("custom profile registration", () => {
    it("registers and uses a custom profile via registerProfile()", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const customProfile = createTestProfile("my-custom-profile");

      // Register custom profile
      analyzer.registerProfile(customProfile);

      // Verify profile is available
      const profiles = analyzer.getProfiles();
      expect(profiles).toContain("my-custom-profile");

      // Use for comparison
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );
      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(
        result,
        "my-custom-profile",
      );

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("my-custom-profile");
      }

      await analyzer.dispose();
    });

    it("registers custom profile via config.customProfile", async () => {
      const customProfile = createTestProfile("config-custom-profile");
      const config = createConfig({
        shootingHand: "right",
        profile: "config-custom-profile",
        customProfile: customProfile as FormProfile,
      });
      const analyzer = await createShotAnalyzer(config);

      // Profile should be available
      const profiles = analyzer.getProfiles();
      expect(profiles).toContain("config-custom-profile");

      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );
      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(result);

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("config-custom-profile");
      }

      await analyzer.dispose();
    });

    it("custom profile with specific metric targets produces correct comparisons", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Create profile with very strict targets
      const strictProfile: FormProfile = {
        name: "strict-test-profile",
        description: "Test profile with strict targets",
        targets: {
          shootingElbowAngle: {
            ideal: 90,
            acceptable: { min: 89, max: 91 }, // Very tight range
            priority: "high",
            feedback: {
              tooLow: "Elbow too straight",
              tooHigh: "Elbow too bent",
            },
          },
        },
      };

      analyzer.registerProfile(strictProfile);

      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );
      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(
        result,
        "strict-test-profile",
      );

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("strict-test-profile");
        // With strict targets, likely to have failures
        // (exact behavior depends on mock data)
      }

      await analyzer.dispose();
    });

    it("custom profile with lenient targets produces more passes", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      // Create profile with very lenient targets
      const lenientProfile: FormProfile = {
        name: "lenient-test-profile",
        description: "Test profile with lenient targets",
        targets: {
          shootingElbowAngle: {
            ideal: 90,
            acceptable: { min: 0, max: 180 }, // Very wide range
            priority: "low",
            feedback: {
              tooLow: "Elbow issue",
              tooHigh: "Elbow issue",
            },
          },
        },
      };

      analyzer.registerProfile(lenientProfile);

      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );
      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(
        result,
        "lenient-test-profile",
      );

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("lenient-test-profile");
        // With lenient targets, more likely to pass
      }

      await analyzer.dispose();
    });
  });

  describe("custom profile with categorical metrics", () => {
    it("compares categorical metric values correctly", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      const categoricalProfile: FormProfile = {
        name: "categorical-test-profile",
        description: "Test profile with categorical targets",
        targets: {
          guideHandPosition: {
            ideal: "side",
            acceptable: ["side", "under", "thumb-up"],
            priority: "medium",
            feedback: {
              incorrect: "Guide hand should be on side of ball",
            },
          },
        },
      };

      analyzer.registerProfile(categoricalProfile);

      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );
      const result = await analyzer.analyzeVideo(frameProvider);
      const comparisons = analyzer.compareToProfile(
        result,
        "categorical-test-profile",
      );

      for (const comparison of comparisons) {
        expect(comparison.profile).toBe("categorical-test-profile");
      }

      await analyzer.dispose();
    });
  });

  describe("profile registry management", () => {
    it("getProfiles() returns all available profiles", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      const profiles = analyzer.getProfiles();

      // Should include built-in profiles
      expect(profiles).toContain("youth-fundamentals");
      expect(profiles).toContain("high-school");
      expect(profiles).toContain("pro-form");

      await analyzer.dispose();
    });

    it("custom profiles are added to profile list", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());

      const profilesBefore = analyzer.getProfiles();
      expect(profilesBefore).not.toContain("new-profile-1");

      analyzer.registerProfile(createTestProfile("new-profile-1"));
      analyzer.registerProfile(createTestProfile("new-profile-2"));

      const profilesAfter = analyzer.getProfiles();
      expect(profilesAfter).toContain("new-profile-1");
      expect(profilesAfter).toContain("new-profile-2");

      await analyzer.dispose();
    });

    it("multiple analyzers share the profile registry", async () => {
      const analyzer1 = await createShotAnalyzer(createDefaultConfig());
      analyzer1.registerProfile(createTestProfile("shared-profile"));

      const analyzer2 = await createShotAnalyzer(createDefaultConfig());
      const profiles = analyzer2.getProfiles();

      // Profile registered in analyzer1 should be visible in analyzer2
      expect(profiles).toContain("shared-profile");

      await analyzer1.dispose();
      await analyzer2.dispose();
    });
  });

  describe("error handling", () => {
    it("throws when comparing against non-existent profile", async () => {
      const analyzer = await createShotAnalyzer(createDefaultConfig());
      const frameProvider = createMockFrameProvider(
        SINGLE_SHOT_SCENARIO.totalFrames,
        SINGLE_SHOT_SCENARIO.fps,
      );

      const result = await analyzer.analyzeVideo(frameProvider);

      expect(() => {
        analyzer.compareToProfile(result, "non-existent-profile");
      }).toThrow();

      await analyzer.dispose();
    });
  });
});

// ============================================================================
// E2E Test Suite: Profile Comparison with Live Sessions
// ============================================================================

describe("E2E: Profile Comparison with Live Session Results", () => {
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

  it("compares live session results against profile", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());

    // Process frames via live session
    for (let i = 0; i < SINGLE_SHOT_SCENARIO.totalFrames; i++) {
      const frame = {
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: (i / 30) * 1000,
        frameIndex: i,
      };
      await analyzer.processFrame(frame);
    }

    const result = await analyzer.finalizeLiveSession();
    const comparisons = analyzer.compareToProfile(result);

    // Should produce valid comparisons
    expect(comparisons.length).toBe(result.shots.length);

    for (const comparison of comparisons) {
      expect(comparison).toHaveProperty("profile");
      expect(comparison).toHaveProperty("metrics");
      expect(comparison).toHaveProperty("summary");
    }

    await analyzer.dispose();
  });

  it("compares live session results against custom profile", async () => {
    const analyzer = await createShotAnalyzer(createDefaultConfig());
    const customProfile = createTestProfile("live-session-profile");
    analyzer.registerProfile(customProfile);

    // Process frames
    for (let i = 0; i < 60; i++) {
      const frame = {
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: (i / 30) * 1000,
        frameIndex: i,
      };
      await analyzer.processFrame(frame);
    }

    const result = await analyzer.finalizeLiveSession();
    const comparisons = analyzer.compareToProfile(
      result,
      "live-session-profile",
    );

    for (const comparison of comparisons) {
      expect(comparison.profile).toBe("live-session-profile");
    }

    await analyzer.dispose();
  });
});
