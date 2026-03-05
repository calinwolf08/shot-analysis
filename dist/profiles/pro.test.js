/**
 * Unit tests for pro-form profile validation.
 *
 * Tests that the pro-form profile:
 * - Passes validation with the formProfileSchema
 * - Has elite-level tight tolerances
 * - Includes all relevant metrics
 * - Includes precise technical feedback messages
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
import { describe, it, expect } from "vitest";
import { proFormProfile } from "./pro";
import { formProfileSchema, safeValidateProfile } from "./schemas";
import { isNumericTarget, isCategoricalTarget } from "./types";
describe("proFormProfile", () => {
    describe("schema validation", () => {
        it("passes formProfileSchema validation", () => {
            const result = formProfileSchema.safeParse(proFormProfile);
            expect(result.success).toBe(true);
        });
        it("passes safeValidateProfile", () => {
            const result = safeValidateProfile(proFormProfile);
            expect(result.success).toBe(true);
        });
    });
    describe("profile metadata", () => {
        it("has correct name", () => {
            expect(proFormProfile.name).toBe("pro-form");
        });
        it("has non-empty description", () => {
            expect(proFormProfile.description).toBeTruthy();
            expect(proFormProfile.description.length).toBeGreaterThan(10);
        });
        it("includes elite/pro level in description", () => {
            expect(proFormProfile.description.toLowerCase()).toMatch(/elite|pro|professional|advanced|college/);
        });
    });
    describe("comprehensive metrics coverage", () => {
        it("includes shootingElbowAngle target", () => {
            expect(proFormProfile.targets.shootingElbowAngle).toBeDefined();
        });
        it("includes followThroughHold target", () => {
            expect(proFormProfile.targets.followThroughHold).toBeDefined();
        });
        it("includes setPointHeight target", () => {
            expect(proFormProfile.targets.setPointHeight).toBeDefined();
        });
        it("includes timing metrics", () => {
            expect(proFormProfile.targets.ballLegSync).toBeDefined();
        });
        it("includes wristSnapAngle target", () => {
            expect(proFormProfile.targets.wristSnapAngle).toBeDefined();
        });
        it("has more targets than high school profile", () => {
            const targetCount = Object.keys(proFormProfile.targets).length;
            // Pro profile should be comprehensive
            expect(targetCount).toBeGreaterThanOrEqual(15);
        });
    });
    describe("tightest acceptable ranges (elite precision)", () => {
        it("has tightest range for shootingElbowAngle", () => {
            const target = proFormProfile.targets.shootingElbowAngle;
            expect(target).toBeDefined();
            if (target && isNumericTarget(target)) {
                const range = target.acceptable.max - target.acceptable.min;
                // Pro should have very tight range (around 10-15 degrees)
                expect(range).toBeLessThan(20);
                expect(range).toBeGreaterThanOrEqual(5);
            }
        });
        it("has tight range for releaseAngle", () => {
            const target = proFormProfile.targets.releaseAngle;
            if (target && isNumericTarget(target)) {
                const range = target.acceptable.max - target.acceptable.min;
                // Should be tighter than high school
                expect(range).toBeLessThan(18);
            }
        });
        it("has tight range for ballLegSync", () => {
            const target = proFormProfile.targets.ballLegSync;
            if (target && isNumericTarget(target)) {
                const range = target.acceptable.max - target.acceptable.min;
                // Elite timing should be precise
                expect(range).toBeLessThan(20);
            }
        });
        it("has tighter ranges than high school for numeric targets", () => {
            // Spot check that ranges are generally tighter
            const target = proFormProfile.targets.shootingElbowFlare;
            if (target && isNumericTarget(target)) {
                const range = target.acceptable.max - target.acceptable.min;
                // Should be tighter than high school's 25-degree range
                expect(range).toBeLessThan(25);
            }
        });
    });
    describe("feedback messages", () => {
        it("has feedback for all key metrics", () => {
            const keyMetrics = [
                "shootingElbowAngle",
                "releaseAngle",
                "followThroughHold",
                "ballLegSync",
            ];
            for (const metric of keyMetrics) {
                const target = proFormProfile.targets[metric];
                expect(target).toBeDefined();
                if (target) {
                    expect(target.feedback.tooLow ||
                        target.feedback.tooHigh ||
                        target.feedback.incorrect).toBeTruthy();
                }
            }
        });
        it("feedback messages are technical and precise", () => {
            const allFeedback = [];
            const targets = proFormProfile.targets;
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
            expect(allFeedback.length).toBeGreaterThan(10);
            // Feedback should be substantive
            allFeedback.forEach((msg) => {
                expect(msg.length).toBeGreaterThan(10);
            });
        });
    });
    describe("priority levels", () => {
        it("has high priority for precision mechanics", () => {
            const elbowTarget = proFormProfile.targets.shootingElbowAngle;
            if (elbowTarget) {
                expect(elbowTarget.priority).toBe("high");
            }
        });
        it("has high priority for timing at pro level", () => {
            const syncTarget = proFormProfile.targets.ballLegSync;
            if (syncTarget) {
                expect(syncTarget.priority).toBe("high");
            }
        });
        it("has many high priority targets for elite performance", () => {
            const targets = proFormProfile.targets;
            const highPriorityCount = Object.keys(targets).filter((key) => {
                const t = targets[key];
                return t && t.priority === "high";
            }).length;
            // Pro should have numerous high-priority targets
            expect(highPriorityCount).toBeGreaterThanOrEqual(5);
        });
    });
    describe("metric value types", () => {
        it("numeric targets have valid ranges", () => {
            const targets = proFormProfile.targets;
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
            const targets = proFormProfile.targets;
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
    describe("categorical targets have restricted values", () => {
        it("handCupVsHinge should prefer cup only", () => {
            const target = proFormProfile.targets.handCupVsHinge;
            if (target && isCategoricalTarget(target)) {
                // Pro level should primarily accept cup
                expect(target.acceptable).toContain("cup");
                expect(target.acceptable.length).toBeLessThanOrEqual(2);
            }
        });
        it("guideHandPosition should have strict options", () => {
            const target = proFormProfile.targets.guideHandPosition;
            if (target && isCategoricalTarget(target)) {
                // Pro level should have limited acceptable positions
                expect(target.acceptable.length).toBeLessThanOrEqual(2);
            }
        });
    });
});
//# sourceMappingURL=pro.test.js.map