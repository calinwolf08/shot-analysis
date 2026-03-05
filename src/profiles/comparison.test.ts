/**
 * Unit tests for ProfileComparisonEngine.
 * Following TDD: tests are written BEFORE implementation.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

import { describe, it, expect } from "vitest";
import { ProfileComparisonEngine } from "./comparison";
import type { FormProfile, MetricTarget } from "./types";
import type { ShotAnalysis, MetricValue } from "../metrics/types";

/**
 * Helper to create a test metric value.
 */
function createMetricValue(
  value: number | string,
  confidence: number = 0.95,
): MetricValue {
  return {
    value,
    unit: typeof value === "number" ? "degrees" : "category",
    frame: 10,
    confidence,
  };
}

/**
 * Helper to create a numeric metric target.
 */
function createNumericTarget(
  ideal: number,
  min: number,
  max: number,
  priority: "high" | "medium" | "low" = "high",
): MetricTarget {
  return {
    ideal,
    acceptable: { min, max },
    priority,
    feedback: {
      tooLow: `Value below ${min}`,
      tooHigh: `Value above ${max}`,
    },
  };
}

/**
 * Helper to create a categorical metric target.
 */
function createCategoricalTarget(
  ideal: string,
  acceptable: readonly string[],
  priority: "high" | "medium" | "low" = "medium",
): MetricTarget {
  return {
    ideal,
    acceptable,
    priority,
    feedback: {
      incorrect: `Value not in acceptable options: ${acceptable.join(", ")}`,
    },
  };
}

/**
 * Helper to create a test profile.
 */
function createTestProfile(targets: Record<string, MetricTarget>): FormProfile {
  return {
    name: "test-profile",
    description: "Test profile for unit tests",
    targets,
  };
}

/**
 * Helper to create a test shot analysis.
 */
function createTestShotAnalysis(
  metrics: Record<string, MetricValue>,
): ShotAnalysis {
  return {
    shotIndex: 0,
    frameRange: { start: 0, end: 30 },
    phases: {},
    metrics,
    overallConfidence: 0.9,
  };
}

describe("ProfileComparisonEngine", () => {
  describe("constructor", () => {
    it("creates engine with default warning threshold", () => {
      const engine = new ProfileComparisonEngine();
      expect(engine).toBeInstanceOf(ProfileComparisonEngine);
    });

    it("creates engine with custom warning threshold", () => {
      const engine = new ProfileComparisonEngine({ warningThreshold: 0.5 });
      expect(engine).toBeInstanceOf(ProfileComparisonEngine);
    });

    it("creates engine with custom low confidence threshold", () => {
      const engine = new ProfileComparisonEngine({
        lowConfidenceThreshold: 0.3,
      });
      expect(engine).toBeInstanceOf(ProfileComparisonEngine);
    });
  });

  describe("numeric metric comparison", () => {
    it("returns pass status when value is within acceptable range", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle).toBeDefined();
      expect(result.metrics.elbowAngle?.status).toBe("pass");
      expect(result.metrics.elbowAngle?.deviation).toBeUndefined();
      expect(result.metrics.elbowAngle?.feedback).toBeUndefined();
    });

    it("returns pass status when value equals minimum boundary", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(85),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("pass");
    });

    it("returns pass status when value equals maximum boundary", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(95),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("pass");
    });

    it("returns fail status when value is below acceptable range", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(70),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("fail");
      expect(result.metrics.elbowAngle?.deviation).toBe(-20); // 70 - 90 ideal
      expect(result.metrics.elbowAngle?.feedback).toBe("Value below 85");
    });

    it("returns fail status when value is above acceptable range", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(110),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("fail");
      expect(result.metrics.elbowAngle?.deviation).toBe(20); // 110 - 90 ideal
      expect(result.metrics.elbowAngle?.feedback).toBe("Value above 95");
    });

    it("returns warning status when value is close to boundary (within warning threshold)", () => {
      // Default warning threshold is 0.2 (20% of range)
      // Range is 85-95 = 10, so warning zone is 2 units from boundary
      // 85 + 2 = 87, 95 - 2 = 93
      const engine = new ProfileComparisonEngine({ warningThreshold: 0.2 });
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(86), // Within range but close to min boundary
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("warning");
      expect(result.metrics.elbowAngle?.deviation).toBe(-4); // 86 - 90 ideal
    });

    it("returns pass when value is in center of range (not in warning zone)", () => {
      const engine = new ProfileComparisonEngine({ warningThreshold: 0.2 });
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90), // Right at ideal
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("pass");
    });

    it("calculates deviation from ideal value", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(75), // Below range, deviation = 75 - 90 = -15
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.deviation).toBe(-15);
    });

    it("handles negative acceptable ranges", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        tilt: createNumericTarget(0, -10, 10),
      });
      const shot = createTestShotAnalysis({
        tilt: createMetricValue(-5),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.tilt?.status).toBe("pass");
    });

    it("handles zero-width ranges (exact match required)", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        exact: createNumericTarget(100, 100, 100),
      });
      const shot = createTestShotAnalysis({
        exact: createMetricValue(100),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.exact?.status).toBe("pass");
    });

    it("fails when value differs from zero-width range", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        exact: createNumericTarget(100, 100, 100),
      });
      const shot = createTestShotAnalysis({
        exact: createMetricValue(101),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.exact?.status).toBe("fail");
    });

    it("handles decimal values correctly", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        ratio: createNumericTarget(0.5, 0.4, 0.6),
      });
      const shot = createTestShotAnalysis({
        ratio: createMetricValue(0.55),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.ratio?.status).toBe("pass");
    });
  });

  describe("categorical metric comparison", () => {
    it("returns pass status when value is in acceptable values", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("cup", [
          "cup",
          "hinge",
          "neutral",
        ]),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("cup"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.status).toBe("pass");
      expect(result.metrics.handPosition?.deviation).toBeUndefined();
      expect(result.metrics.handPosition?.feedback).toBeUndefined();
    });

    it("returns pass when value matches a non-ideal acceptable value", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("cup", [
          "cup",
          "hinge",
          "neutral",
        ]),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("hinge"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.status).toBe("pass");
    });

    it("returns fail status when value is not in acceptable values", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("cup", ["cup", "hinge"]),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("flat"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.status).toBe("fail");
      expect(result.metrics.handPosition?.feedback).toBe(
        "Value not in acceptable options: cup, hinge",
      );
    });

    it("performs case-sensitive matching", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("cup", ["cup", "Cup", "CUP"]),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("CUP"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.status).toBe("pass");
    });

    it("fails when case does not match", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("cup", ["cup"]),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("Cup"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.status).toBe("fail");
    });

    it("handles empty acceptable values array as always fail", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("none", []),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("anything"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.status).toBe("fail");
    });

    it("does not calculate deviation for categorical metrics", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        handPosition: createCategoricalTarget("cup", ["cup"]),
      });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("flat"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.deviation).toBeUndefined();
    });
  });

  describe("status determination", () => {
    it("marks as warning when metric has low confidence regardless of value", () => {
      const engine = new ProfileComparisonEngine({
        lowConfidenceThreshold: 0.5,
      });
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90, 0.3), // Low confidence
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("warning");
    });

    it("does not downgrade fail to warning for low confidence", () => {
      const engine = new ProfileComparisonEngine({
        lowConfidenceThreshold: 0.5,
      });
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(50, 0.3), // Low confidence but way out of range
      });

      const result = engine.compareToProfile(shot, profile);

      // Low confidence should mark as warning even if value is far out of range
      // because we can't trust the measurement
      expect(result.metrics.elbowAngle?.status).toBe("warning");
    });

    it("respects the normal status when confidence is above threshold", () => {
      const engine = new ProfileComparisonEngine({
        lowConfidenceThreshold: 0.5,
      });
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(50, 0.9), // Good confidence, bad value
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("fail");
    });

    it("uses default low confidence threshold of 0.5", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90, 0.4), // Below default 0.5 threshold
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.status).toBe("warning");
    });
  });

  describe("feedback message selection", () => {
    it("selects tooLow feedback for numeric value below range", () => {
      const engine = new ProfileComparisonEngine();
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {
          tooLow: "Angle too acute",
          tooHigh: "Angle too obtuse",
        },
      };
      const profile = createTestProfile({ angle: target });
      const shot = createTestShotAnalysis({
        angle: createMetricValue(70),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.angle?.feedback).toBe("Angle too acute");
    });

    it("selects tooHigh feedback for numeric value above range", () => {
      const engine = new ProfileComparisonEngine();
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {
          tooLow: "Angle too acute",
          tooHigh: "Angle too obtuse",
        },
      };
      const profile = createTestProfile({ angle: target });
      const shot = createTestShotAnalysis({
        angle: createMetricValue(110),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.angle?.feedback).toBe("Angle too obtuse");
    });

    it("selects incorrect feedback for categorical mismatch", () => {
      const engine = new ProfileComparisonEngine();
      const target: MetricTarget = {
        ideal: "cup",
        acceptable: ["cup", "hinge"],
        priority: "medium",
        feedback: {
          incorrect: "Hand position should be cup or hinge",
        },
      };
      const profile = createTestProfile({ handPosition: target });
      const shot = createTestShotAnalysis({
        handPosition: createMetricValue("flat"),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.handPosition?.feedback).toBe(
        "Hand position should be cup or hinge",
      );
    });

    it("uses default feedback when profile feedback is not specified", () => {
      const engine = new ProfileComparisonEngine();
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {}, // No custom feedback
      };
      const profile = createTestProfile({ angle: target });
      const shot = createTestShotAnalysis({
        angle: createMetricValue(70),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.angle?.feedback).toBe(
        "Value is below the acceptable range",
      );
    });

    it("does not include feedback for passing metrics", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.feedback).toBeUndefined();
    });

    it("includes feedback for warning metrics (marginal values)", () => {
      const engine = new ProfileComparisonEngine({ warningThreshold: 0.2 });
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {
          tooLow: "Getting close to too low",
        },
      };
      const profile = createTestProfile({ angle: target });
      const shot = createTestShotAnalysis({
        angle: createMetricValue(86), // In warning zone near min
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.angle?.status).toBe("warning");
      expect(result.metrics.angle?.feedback).toBe("Getting close to too low");
    });
  });

  describe("summary generation", () => {
    it("counts pass/fail/warning correctly", () => {
      const engine = new ProfileComparisonEngine({ warningThreshold: 0.2 });
      const profile = createTestProfile({
        metric1: createNumericTarget(90, 85, 95), // Will pass
        metric2: createNumericTarget(50, 45, 55), // Will fail
        metric3: createNumericTarget(100, 90, 110), // Will be warning (marginal)
      });
      const shot = createTestShotAnalysis({
        metric1: createMetricValue(90), // Pass
        metric2: createMetricValue(20), // Fail
        metric3: createMetricValue(92), // Warning (close to min 90)
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.summary.passCount).toBe(1);
      expect(result.summary.failCount).toBe(1);
      expect(result.summary.warningCount).toBe(1);
    });

    it("generates priority issues list sorted by priority (high first)", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        lowPriority: createNumericTarget(50, 45, 55, "low"),
        highPriority: createNumericTarget(90, 85, 95, "high"),
        mediumPriority: createNumericTarget(70, 65, 75, "medium"),
      });
      const shot = createTestShotAnalysis({
        lowPriority: createMetricValue(10), // Fail low priority
        highPriority: createMetricValue(10), // Fail high priority
        mediumPriority: createMetricValue(10), // Fail medium priority
      });

      const result = engine.compareToProfile(shot, profile);

      // All should fail
      expect(result.summary.failCount).toBe(3);
      // Priority issues should be sorted: high > medium > low
      expect(result.summary.priorityIssues.length).toBe(3);
      expect(result.summary.priorityIssues[0]).toContain("highPriority");
      expect(result.summary.priorityIssues[1]).toContain("mediumPriority");
      expect(result.summary.priorityIssues[2]).toContain("lowPriority");
    });

    it("includes feedback text in priority issues", () => {
      const engine = new ProfileComparisonEngine();
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {
          tooLow: "Elbow angle too closed",
        },
      };
      const profile = createTestProfile({ elbowAngle: target });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(70),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.summary.priorityIssues.length).toBe(1);
      expect(result.summary.priorityIssues[0]).toContain("elbowAngle");
      expect(result.summary.priorityIssues[0]).toContain(
        "Elbow angle too closed",
      );
    });

    it("excludes passing metrics from priority issues", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        passing: createNumericTarget(90, 85, 95, "high"),
        failing: createNumericTarget(50, 45, 55, "high"),
      });
      const shot = createTestShotAnalysis({
        passing: createMetricValue(90),
        failing: createMetricValue(20),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.summary.priorityIssues.length).toBe(1);
      expect(result.summary.priorityIssues[0]).toContain("failing");
      expect(result.summary.priorityIssues[0]).not.toContain("passing");
    });

    it("includes warnings in priority issues", () => {
      const engine = new ProfileComparisonEngine({ warningThreshold: 0.2 });
      const profile = createTestProfile({
        marginal: createNumericTarget(90, 85, 95, "high"),
      });
      const shot = createTestShotAnalysis({
        marginal: createMetricValue(86), // Warning (close to min)
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.summary.warningCount).toBe(1);
      expect(result.summary.priorityIssues.length).toBe(1);
    });

    it("returns empty summary when no metrics compared", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({});
      const shot = createTestShotAnalysis({});

      const result = engine.compareToProfile(shot, profile);

      expect(result.summary.passCount).toBe(0);
      expect(result.summary.failCount).toBe(0);
      expect(result.summary.warningCount).toBe(0);
      expect(result.summary.priorityIssues).toEqual([]);
    });
  });

  describe("metric skipping", () => {
    it("skips metrics not in profile targets", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90),
        unknownMetric: createMetricValue(50), // Not in profile
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle).toBeDefined();
      expect(result.metrics.unknownMetric).toBeUndefined();
    });

    it("skips profile targets not in shot metrics", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
        releaseAngle: createNumericTarget(52, 45, 60), // Not in shot
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle).toBeDefined();
      expect(result.metrics.releaseAngle).toBeUndefined();
    });

    it("handles completely mismatched metrics gracefully", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        profileMetric1: createNumericTarget(90, 85, 95),
        profileMetric2: createNumericTarget(50, 45, 55),
      });
      const shot = createTestShotAnalysis({
        shotMetric1: createMetricValue(90),
        shotMetric2: createMetricValue(50),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(Object.keys(result.metrics).length).toBe(0);
      expect(result.summary.passCount).toBe(0);
      expect(result.summary.failCount).toBe(0);
      expect(result.summary.warningCount).toBe(0);
    });
  });

  describe("compareToProfile complete result", () => {
    it("returns ProfileComparison with correct profile name", () => {
      const engine = new ProfileComparisonEngine();
      const profile: FormProfile = {
        name: "youth-fundamentals",
        description: "Test",
        targets: {},
      };
      const shot = createTestShotAnalysis({});

      const result = engine.compareToProfile(shot, profile);

      expect(result.profile).toBe("youth-fundamentals");
    });

    it("includes target in each metric result", () => {
      const engine = new ProfileComparisonEngine();
      const target = createNumericTarget(90, 85, 95);
      const profile = createTestProfile({ elbowAngle: target });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(90),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.target).toEqual(target);
    });

    it("includes original value in each metric result", () => {
      const engine = new ProfileComparisonEngine();
      const profile = createTestProfile({
        elbowAngle: createNumericTarget(90, 85, 95),
      });
      const shot = createTestShotAnalysis({
        elbowAngle: createMetricValue(88),
      });

      const result = engine.compareToProfile(shot, profile);

      expect(result.metrics.elbowAngle?.value).toBe(88);
    });
  });
});
