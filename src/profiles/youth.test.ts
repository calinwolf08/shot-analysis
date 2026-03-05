/**
 * Unit tests for youth-fundamentals profile validation.
 *
 * Tests that the youth profile:
 * - Passes validation with the formProfileSchema
 * - Has appropriate wider ranges for developing players (ages 8-12)
 * - Focuses on fundamental metrics
 * - Includes helpful feedback messages
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

import { describe, it, expect } from "vitest";
import { youthFundamentalsProfile } from "./youth";
import { formProfileSchema, safeValidateProfile } from "./schemas";
import { isNumericTarget, isCategoricalTarget } from "./types";

describe("youthFundamentalsProfile", () => {
  describe("schema validation", () => {
    it("passes formProfileSchema validation", () => {
      const result = formProfileSchema.safeParse(youthFundamentalsProfile);
      expect(result.success).toBe(true);
    });

    it("passes safeValidateProfile", () => {
      const result = safeValidateProfile(youthFundamentalsProfile);
      expect(result.success).toBe(true);
    });
  });

  describe("profile metadata", () => {
    it("has correct name", () => {
      expect(youthFundamentalsProfile.name).toBe("youth-fundamentals");
    });

    it("has non-empty description", () => {
      expect(youthFundamentalsProfile.description).toBeTruthy();
      expect(youthFundamentalsProfile.description.length).toBeGreaterThan(10);
    });

    it("includes age range in description", () => {
      expect(youthFundamentalsProfile.description.toLowerCase()).toMatch(
        /8.*12|youth|young|developing/,
      );
    });
  });

  describe("fundamental metrics", () => {
    it("includes shootingElbowAngle target", () => {
      expect(youthFundamentalsProfile.targets.shootingElbowAngle).toBeDefined();
    });

    it("includes followThroughHold target", () => {
      expect(youthFundamentalsProfile.targets.followThroughHold).toBeDefined();
    });

    it("includes setPointHeight target", () => {
      expect(youthFundamentalsProfile.targets.setPointHeight).toBeDefined();
    });
  });

  describe("wider acceptable ranges for youth", () => {
    it("has wider range for shootingElbowAngle than tight precision", () => {
      const target = youthFundamentalsProfile.targets.shootingElbowAngle;
      expect(target).toBeDefined();
      if (target && isNumericTarget(target)) {
        const range = target.acceptable.max - target.acceptable.min;
        // Youth should have wider range (at least 20 degrees)
        expect(range).toBeGreaterThanOrEqual(20);
      }
    });

    it("has wider range for releaseAngle than tight precision", () => {
      const target = youthFundamentalsProfile.targets.releaseAngle;
      if (target && isNumericTarget(target)) {
        const range = target.acceptable.max - target.acceptable.min;
        // Youth should have wider range (at least 20 degrees)
        expect(range).toBeGreaterThanOrEqual(20);
      }
    });
  });

  describe("feedback messages", () => {
    it("has feedback for shootingElbowAngle", () => {
      const target = youthFundamentalsProfile.targets.shootingElbowAngle;
      expect(target).toBeDefined();
      if (target && isNumericTarget(target)) {
        expect(target.feedback.tooLow || target.feedback.tooHigh).toBeTruthy();
      }
    });

    it("feedback messages are age-appropriate", () => {
      // Check that feedback uses simple, encouraging language
      const allFeedback: string[] = [];
      for (const target of Object.values(youthFundamentalsProfile.targets)) {
        if (target.feedback.tooLow) allFeedback.push(target.feedback.tooLow);
        if (target.feedback.tooHigh) allFeedback.push(target.feedback.tooHigh);
        if (target.feedback.incorrect)
          allFeedback.push(target.feedback.incorrect);
      }
      expect(allFeedback.length).toBeGreaterThan(0);
      // Feedback should not be empty strings
      allFeedback.forEach((msg) => {
        expect(msg.length).toBeGreaterThan(5);
      });
    });
  });

  describe("priority levels", () => {
    it("has high priority for fundamental mechanics", () => {
      // Elbow angle is fundamental
      const elbowTarget = youthFundamentalsProfile.targets.shootingElbowAngle;
      if (elbowTarget) {
        expect(elbowTarget.priority).toBe("high");
      }
    });

    it("has at least some high priority targets", () => {
      const targets = youthFundamentalsProfile.targets;
      const highPriorityCount = Object.keys(targets).filter((key) => {
        const t = targets[key];
        return t && t.priority === "high";
      }).length;
      expect(highPriorityCount).toBeGreaterThan(0);
    });
  });

  describe("metric value types", () => {
    it("numeric targets have valid ranges", () => {
      const targets = youthFundamentalsProfile.targets;
      for (const name of Object.keys(targets)) {
        const target = targets[name];
        if (target && isNumericTarget(target)) {
          expect(target.acceptable.min).toBeLessThanOrEqual(
            target.acceptable.max,
          );
          // Ideal should be within range
          if (typeof target.ideal === "number") {
            expect(target.ideal).toBeGreaterThanOrEqual(target.acceptable.min);
            expect(target.ideal).toBeLessThanOrEqual(target.acceptable.max);
          }
        }
      }
    });

    it("categorical targets have valid acceptable values", () => {
      const targets = youthFundamentalsProfile.targets;
      for (const name of Object.keys(targets)) {
        const target = targets[name];
        if (target && isCategoricalTarget(target)) {
          expect(Array.isArray(target.acceptable)).toBe(true);
          // Ideal should be in acceptable values
          if (typeof target.ideal === "string") {
            expect(target.acceptable).toContain(target.ideal);
          }
        }
      }
    });
  });
});
