/**
 * Unit tests for profile types and schema validation.
 * Following TDD: tests are written BEFORE implementation is verified.
 */

import { describe, it, expect } from "vitest";
import type { ZodIssue } from "zod";
import {
  formProfileSchema,
  metricTargetSchema,
  metricFeedbackSchema,
  numericRangeSchema,
  profileComparisonSchema,
  comparisonSummarySchema,
  metricComparisonResultSchema,
  validateProfile,
  safeValidateProfile,
} from "./schemas";
import {
  createEmptyComparisonSummary,
  createEmptyProfileComparison,
  isNumericTarget,
  isCategoricalTarget,
  getFeedbackMessage,
  DEFAULT_FEEDBACK_MESSAGES,
  type MetricTarget,
} from "./types";

describe("numericRangeSchema", () => {
  it("accepts valid numeric range", () => {
    const range = { min: 0, max: 100 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(true);
  });

  it("accepts range where min equals max", () => {
    const range = { min: 50, max: 50 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(true);
  });

  it("accepts negative ranges", () => {
    const range = { min: -100, max: -50 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(true);
  });

  it("rejects range where min is greater than max", () => {
    const range = { min: 100, max: 50 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(false);
    if (!result.success && result.error.issues[0]) {
      expect(result.error.issues[0].message).toContain("less than or equal");
    }
  });

  it("rejects non-numeric min", () => {
    const range = { min: "0", max: 100 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric max", () => {
    const range = { min: 0, max: "100" };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(false);
  });

  it("rejects missing min", () => {
    const range = { max: 100 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(false);
  });

  it("rejects missing max", () => {
    const range = { min: 0 };
    const result = numericRangeSchema.safeParse(range);
    expect(result.success).toBe(false);
  });
});

describe("metricFeedbackSchema", () => {
  it("accepts feedback with all messages", () => {
    const feedback = {
      tooLow: "Value too low",
      tooHigh: "Value too high",
      incorrect: "Incorrect value",
    };
    const result = metricFeedbackSchema.safeParse(feedback);
    expect(result.success).toBe(true);
  });

  it("accepts empty feedback (all optional)", () => {
    const feedback = {};
    const result = metricFeedbackSchema.safeParse(feedback);
    expect(result.success).toBe(true);
  });

  it("accepts partial feedback", () => {
    const feedback = { tooLow: "Value too low" };
    const result = metricFeedbackSchema.safeParse(feedback);
    expect(result.success).toBe(true);
  });

  it("rejects non-string feedback messages", () => {
    const feedback = { tooLow: 123 };
    const result = metricFeedbackSchema.safeParse(feedback);
    expect(result.success).toBe(false);
  });
});

describe("metricTargetSchema", () => {
  describe("numeric targets", () => {
    it("accepts valid numeric target", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: { tooLow: "Too low", tooHigh: "Too high" },
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });

    it("accepts numeric target with empty feedback", () => {
      const target = {
        ideal: 45,
        acceptable: { min: 40, max: 50 },
        priority: "medium",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });
  });

  describe("categorical targets", () => {
    it("accepts valid categorical target with string ideal", () => {
      const target = {
        ideal: "cup",
        acceptable: ["cup", "hinge", "neutral"],
        priority: "low",
        feedback: { incorrect: "Invalid hand position" },
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });

    it("accepts categorical target with empty array", () => {
      const target = {
        ideal: "any",
        acceptable: [],
        priority: "low",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });
  });

  describe("priority validation", () => {
    it("accepts high priority", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });

    it("accepts medium priority", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "medium",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });

    it("accepts low priority", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "low",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(true);
    });

    it("rejects invalid priority", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "critical",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid targets", () => {
    it("rejects missing ideal", () => {
      const target = {
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });

    it("rejects missing acceptable", () => {
      const target = {
        ideal: 90,
        priority: "high",
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });

    it("rejects missing priority", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        feedback: {},
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });

    it("rejects missing feedback", () => {
      const target = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
      };
      const result = metricTargetSchema.safeParse(target);
      expect(result.success).toBe(false);
    });
  });
});

describe("formProfileSchema", () => {
  describe("valid profiles", () => {
    it("accepts valid profile with targets", () => {
      const profile = {
        name: "youth-fundamentals",
        description: "Basic form for young players",
        targets: {
          shootingElbowAngle: {
            ideal: 90,
            acceptable: { min: 85, max: 100 },
            priority: "high",
            feedback: { tooLow: "Elbow too closed", tooHigh: "Elbow too open" },
          },
        },
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it("accepts profile with empty targets (edge case)", () => {
      const profile = {
        name: "empty-profile",
        description: "Profile with no targets",
        targets: {},
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it("accepts profile with multiple targets", () => {
      const profile = {
        name: "comprehensive",
        description: "Full analysis profile",
        targets: {
          shootingElbowAngle: {
            ideal: 90,
            acceptable: { min: 85, max: 95 },
            priority: "high",
            feedback: {},
          },
          handPosition: {
            ideal: "cup",
            acceptable: ["cup", "hinge"],
            priority: "medium",
            feedback: { incorrect: "Fix hand position" },
          },
          releaseAngle: {
            ideal: 52,
            acceptable: { min: 45, max: 55 },
            priority: "high",
            feedback: { tooLow: "Too flat", tooHigh: "Too steep" },
          },
        },
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe("invalid profiles", () => {
    it("rejects empty profile name", () => {
      const profile = {
        name: "",
        description: "Description",
        targets: {},
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue: ZodIssue) =>
            issue.message.includes("empty"),
          ),
        ).toBe(true);
      }
    });

    it("rejects missing name", () => {
      const profile = {
        description: "Description",
        targets: {},
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it("rejects missing description", () => {
      const profile = {
        name: "test",
        targets: {},
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it("rejects missing targets", () => {
      const profile = {
        name: "test",
        description: "Description",
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });

    it("rejects invalid target in targets", () => {
      const profile = {
        name: "test",
        description: "Description",
        targets: {
          badTarget: {
            ideal: 90,
            // missing acceptable, priority, feedback
          },
        },
      };
      const result = formProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });
});

describe("comparisonSummarySchema", () => {
  it("accepts valid summary", () => {
    const summary = {
      passCount: 5,
      failCount: 2,
      warningCount: 1,
      priorityIssues: ["Fix elbow angle", "Adjust release point"],
    };
    const result = comparisonSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it("accepts summary with empty priority issues", () => {
    const summary = {
      passCount: 10,
      failCount: 0,
      warningCount: 0,
      priorityIssues: [],
    };
    const result = comparisonSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it("rejects negative counts", () => {
    const summary = {
      passCount: -1,
      failCount: 0,
      warningCount: 0,
      priorityIssues: [],
    };
    const result = comparisonSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer counts", () => {
    const summary = {
      passCount: 5.5,
      failCount: 0,
      warningCount: 0,
      priorityIssues: [],
    };
    const result = comparisonSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });
});

describe("metricComparisonResultSchema", () => {
  it("accepts passing numeric result", () => {
    const result = {
      value: 90,
      target: {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      },
      status: "pass",
    };
    const parseResult = metricComparisonResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it("accepts failing result with deviation and feedback", () => {
    const result = {
      value: 80,
      target: {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: { tooLow: "Value too low" },
      },
      status: "fail",
      deviation: -10,
      feedback: "Value too low",
    };
    const parseResult = metricComparisonResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it("accepts warning result", () => {
    const result = {
      value: 85,
      target: {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "medium",
        feedback: {},
      },
      status: "warning",
      deviation: -5,
    };
    const parseResult = metricComparisonResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it("accepts categorical result", () => {
    const result = {
      value: "cup",
      target: {
        ideal: "cup",
        acceptable: ["cup", "hinge"],
        priority: "low",
        feedback: {},
      },
      status: "pass",
    };
    const parseResult = metricComparisonResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = {
      value: 90,
      target: {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      },
      status: "unknown",
    };
    const parseResult = metricComparisonResultSchema.safeParse(result);
    expect(parseResult.success).toBe(false);
  });
});

describe("profileComparisonSchema", () => {
  it("accepts valid comparison result", () => {
    const comparison = {
      profile: "youth-fundamentals",
      metrics: {
        shootingElbowAngle: {
          value: 90,
          target: {
            ideal: 90,
            acceptable: { min: 85, max: 95 },
            priority: "high",
            feedback: {},
          },
          status: "pass",
        },
      },
      summary: {
        passCount: 1,
        failCount: 0,
        warningCount: 0,
        priorityIssues: [],
      },
    };
    const result = profileComparisonSchema.safeParse(comparison);
    expect(result.success).toBe(true);
  });

  it("accepts comparison with empty metrics", () => {
    const comparison = {
      profile: "empty",
      metrics: {},
      summary: {
        passCount: 0,
        failCount: 0,
        warningCount: 0,
        priorityIssues: [],
      },
    };
    const result = profileComparisonSchema.safeParse(comparison);
    expect(result.success).toBe(true);
  });

  it("rejects empty profile name", () => {
    const comparison = {
      profile: "",
      metrics: {},
      summary: {
        passCount: 0,
        failCount: 0,
        warningCount: 0,
        priorityIssues: [],
      },
    };
    const result = profileComparisonSchema.safeParse(comparison);
    expect(result.success).toBe(false);
  });
});

describe("validateProfile", () => {
  it("returns validated profile for valid input", () => {
    const profile = {
      name: "test",
      description: "Test profile",
      targets: {},
    };
    const result = validateProfile(profile);
    expect(result.name).toBe("test");
  });

  it("throws ZodError for invalid input", () => {
    const profile = {
      name: "",
      description: "Test",
      targets: {},
    };
    expect(() => validateProfile(profile)).toThrow();
  });
});

describe("safeValidateProfile", () => {
  it("returns success for valid profile", () => {
    const profile = {
      name: "test",
      description: "Test profile",
      targets: {},
    };
    const result = safeValidateProfile(profile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test");
    }
  });

  it("returns error for invalid profile", () => {
    const profile = {
      name: "",
      description: "Test",
      targets: {},
    };
    const result = safeValidateProfile(profile);
    expect(result.success).toBe(false);
  });
});

describe("type helper functions", () => {
  describe("isNumericTarget", () => {
    it("returns true for numeric range target", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      };
      expect(isNumericTarget(target)).toBe(true);
    });

    it("returns false for categorical target", () => {
      const target: MetricTarget = {
        ideal: "cup",
        acceptable: ["cup", "hinge"],
        priority: "low",
        feedback: {},
      };
      expect(isNumericTarget(target)).toBe(false);
    });
  });

  describe("isCategoricalTarget", () => {
    it("returns true for categorical target", () => {
      const target: MetricTarget = {
        ideal: "cup",
        acceptable: ["cup", "hinge"],
        priority: "low",
        feedback: {},
      };
      expect(isCategoricalTarget(target)).toBe(true);
    });

    it("returns false for numeric target", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      };
      expect(isCategoricalTarget(target)).toBe(false);
    });

    it("returns true for empty array (edge case)", () => {
      const target: MetricTarget = {
        ideal: "any",
        acceptable: [],
        priority: "low",
        feedback: {},
      };
      expect(isCategoricalTarget(target)).toBe(true);
    });
  });

  describe("getFeedbackMessage", () => {
    it("returns undefined for pass status", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: { tooLow: "Too low" },
      };
      expect(getFeedbackMessage(target, "pass", true)).toBeUndefined();
    });

    it("returns tooLow message for numeric target below range", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: { tooLow: "Elbow angle too low" },
      };
      expect(getFeedbackMessage(target, "fail", true, true)).toBe(
        "Elbow angle too low",
      );
    });

    it("returns tooHigh message for numeric target above range", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: { tooHigh: "Elbow angle too high" },
      };
      expect(getFeedbackMessage(target, "fail", true, false)).toBe(
        "Elbow angle too high",
      );
    });

    it("returns incorrect message for categorical target", () => {
      const target: MetricTarget = {
        ideal: "cup",
        acceptable: ["cup", "hinge"],
        priority: "medium",
        feedback: { incorrect: "Invalid hand position" },
      };
      expect(getFeedbackMessage(target, "fail", false)).toBe(
        "Invalid hand position",
      );
    });

    it("returns default tooLow message when not specified", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      };
      expect(getFeedbackMessage(target, "fail", true, true)).toBe(
        DEFAULT_FEEDBACK_MESSAGES.tooLow,
      );
    });

    it("returns default tooHigh message when not specified", () => {
      const target: MetricTarget = {
        ideal: 90,
        acceptable: { min: 85, max: 95 },
        priority: "high",
        feedback: {},
      };
      expect(getFeedbackMessage(target, "fail", true, false)).toBe(
        DEFAULT_FEEDBACK_MESSAGES.tooHigh,
      );
    });

    it("returns default incorrect message when not specified", () => {
      const target: MetricTarget = {
        ideal: "cup",
        acceptable: ["cup", "hinge"],
        priority: "medium",
        feedback: {},
      };
      expect(getFeedbackMessage(target, "fail", false)).toBe(
        DEFAULT_FEEDBACK_MESSAGES.incorrect,
      );
    });
  });

  describe("createEmptyComparisonSummary", () => {
    it("returns summary with all counts at zero", () => {
      const summary = createEmptyComparisonSummary();
      expect(summary.passCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(summary.warningCount).toBe(0);
      expect(summary.priorityIssues).toEqual([]);
    });
  });

  describe("createEmptyProfileComparison", () => {
    it("returns empty comparison with given profile name", () => {
      const comparison = createEmptyProfileComparison("test-profile");
      expect(comparison.profile).toBe("test-profile");
      expect(comparison.metrics).toEqual({});
      expect(comparison.summary.passCount).toBe(0);
      expect(comparison.summary.failCount).toBe(0);
      expect(comparison.summary.warningCount).toBe(0);
    });
  });
});
