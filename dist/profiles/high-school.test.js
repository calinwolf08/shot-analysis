/**
 * Unit tests for high-school profile validation.
 *
 * Tests that the high-school profile:
 * - Passes validation with the formProfileSchema
 * - Has more refined mechanics expectations (ages 13-18)
 * - Includes timing and rhythm metrics
 * - Includes helpful feedback messages
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
import { describe, it, expect } from "vitest";
import { highSchoolProfile } from "./high-school";
import { formProfileSchema, safeValidateProfile } from "./schemas";
import { isNumericTarget, isCategoricalTarget } from "./types";
describe("highSchoolProfile", () => {
    describe("schema validation", () => {
        it("passes formProfileSchema validation", () => {
            const result = formProfileSchema.safeParse(highSchoolProfile);
            expect(result.success).toBe(true);
        });
        it("passes safeValidateProfile", () => {
            const result = safeValidateProfile(highSchoolProfile);
            expect(result.success).toBe(true);
        });
    });
    describe("profile metadata", () => {
        it("has correct name", () => {
            expect(highSchoolProfile.name).toBe("high-school");
        });
        it("has non-empty description", () => {
            expect(highSchoolProfile.description).toBeTruthy();
            expect(highSchoolProfile.description.length).toBeGreaterThan(10);
        });
        it("includes age range or level in description", () => {
            expect(highSchoolProfile.description.toLowerCase()).toMatch(/13.*18|high.*school|intermediate|advanced.*beginner/);
        });
    });
    describe("fundamental metrics (inherited focus)", () => {
        it("includes shootingElbowAngle target", () => {
            expect(highSchoolProfile.targets.shootingElbowAngle).toBeDefined();
        });
        it("includes followThroughHold target", () => {
            expect(highSchoolProfile.targets.followThroughHold).toBeDefined();
        });
        it("includes setPointHeight target", () => {
            expect(highSchoolProfile.targets.setPointHeight).toBeDefined();
        });
    });
    describe("timing and rhythm metrics (new for high school)", () => {
        it("includes ballLegSync target", () => {
            expect(highSchoolProfile.targets.ballLegSync).toBeDefined();
        });
        it("includes timing-related targets", () => {
            // High school level should have at least one timing metric
            const timingMetrics = [
                "ballLegSync",
                "ballRiseStart",
                "legRiseStart",
                "releaseStart",
            ];
            const hasTimingMetric = timingMetrics.some((metric) => highSchoolProfile.targets[metric] !== undefined);
            expect(hasTimingMetric).toBe(true);
        });
    });
    describe("tighter acceptable ranges than youth", () => {
        it("has tighter range for shootingElbowAngle than youth", () => {
            const target = highSchoolProfile.targets.shootingElbowAngle;
            expect(target).toBeDefined();
            if (target && isNumericTarget(target)) {
                const range = target.acceptable.max - target.acceptable.min;
                // High school should have range around 15-25 degrees (tighter than youth's 40)
                expect(range).toBeLessThan(35);
                expect(range).toBeGreaterThanOrEqual(10);
            }
        });
        it("has tighter range for releaseAngle than youth", () => {
            const target = highSchoolProfile.targets.releaseAngle;
            if (target && isNumericTarget(target)) {
                const range = target.acceptable.max - target.acceptable.min;
                // Should be tighter than youth's 35-degree range
                expect(range).toBeLessThan(30);
            }
        });
    });
    describe("feedback messages", () => {
        it("has feedback for key metrics", () => {
            const target = highSchoolProfile.targets.shootingElbowAngle;
            expect(target).toBeDefined();
            if (target && isNumericTarget(target)) {
                expect(target.feedback.tooLow || target.feedback.tooHigh).toBeTruthy();
            }
        });
        it("has feedback for timing metrics", () => {
            const target = highSchoolProfile.targets.ballLegSync;
            if (target) {
                expect(target.feedback.tooLow ||
                    target.feedback.tooHigh ||
                    target.feedback.incorrect).toBeTruthy();
            }
        });
        it("feedback messages provide technical guidance", () => {
            // Check that feedback uses more technical language appropriate for high school
            const allFeedback = [];
            const targets = highSchoolProfile.targets;
            for (const key of Object.keys(targets)) {
                const target = targets[key];
                if (target) {
                    if (target.feedback.tooLow)
                        allFeedback.push(target.feedback.tooLow);
                    if (target.feedback.tooHigh)
                        allFeedback.push(target.feedback.tooHigh);
                    if (target.feedback.incorrect)
                        allFeedback.push(target.feedback.incorrect);
                }
            }
            expect(allFeedback.length).toBeGreaterThan(0);
            // Feedback should not be empty strings
            allFeedback.forEach((msg) => {
                expect(msg.length).toBeGreaterThan(5);
            });
        });
    });
    describe("priority levels", () => {
        it("has high priority for core mechanics", () => {
            const elbowTarget = highSchoolProfile.targets.shootingElbowAngle;
            if (elbowTarget) {
                expect(elbowTarget.priority).toBe("high");
            }
        });
        it("has multiple high priority targets for refined mechanics", () => {
            const targets = highSchoolProfile.targets;
            const highPriorityCount = Object.keys(targets).filter((key) => {
                const t = targets[key];
                return t && t.priority === "high";
            }).length;
            // High school should have more high-priority targets than just basics
            expect(highPriorityCount).toBeGreaterThanOrEqual(3);
        });
    });
    describe("metric value types", () => {
        it("numeric targets have valid ranges", () => {
            const targets = highSchoolProfile.targets;
            for (const name of Object.keys(targets)) {
                const target = targets[name];
                if (target && isNumericTarget(target)) {
                    expect(target.acceptable.min).toBeLessThanOrEqual(target.acceptable.max);
                    // Ideal should be within range
                    if (typeof target.ideal === "number") {
                        expect(target.ideal).toBeGreaterThanOrEqual(target.acceptable.min);
                        expect(target.ideal).toBeLessThanOrEqual(target.acceptable.max);
                    }
                }
            }
        });
        it("categorical targets have valid acceptable values", () => {
            const targets = highSchoolProfile.targets;
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
//# sourceMappingURL=high-school.test.js.map