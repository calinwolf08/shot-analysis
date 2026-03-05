/**
 * Guide arm metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring guide arm mechanics:
 * - guideElbowFlare: angle of guide elbow relative to body plane at set point
 * - guideHandPosition: position of guide hand relative to shooting hand (categorical)
 * - guideHandRelease: when guide hand separates from ball (% of shot)
 *
 * @see Feature 5.3 - Guide Arm Metrics
 */
import type { MetricCalculator, MetricCalculatorContext, MetricCalculatorResult } from "./types";
/**
 * Guide hand position categories.
 */
export type GuideHandPositionCategory = "side" | "under" | "front" | "thumb-up";
/**
 * Calculator for guide elbow flare angle.
 *
 * Measures the angle of the guide elbow relative to the body plane
 * at the set point. A lower angle indicates the elbow is tucked in,
 * while a higher angle indicates the elbow is flared out.
 */
export declare class GuideElbowFlareCalculator implements MetricCalculator {
    readonly name = "guideElbowFlare";
    readonly description = "Angle of guide elbow relative to body plane at set point (degrees)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for guide hand position relative to shooting hand/ball.
 *
 * Classifies the position of the guide hand at set point into one of four
 * categories: 'side', 'under', 'front', or 'thumb-up'. This is determined
 * by the relative position of the guide wrist to the shooting wrist.
 */
export declare class GuideHandPositionCalculator implements MetricCalculator {
    readonly name = "guideHandPosition";
    readonly description = "Position of guide hand relative to ball/shooting hand at set point";
    readonly unit = "category";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
    /**
     * Classifies the guide hand position into a category.
     */
    private classifyPosition;
}
/**
 * Calculator for guide hand release timing.
 *
 * Measures when the guide hand separates from the ball/shooting hand
 * as a percentage of the total shot duration. This is detected by
 * measuring the distance between index fingers and detecting when
 * it exceeds a threshold.
 */
export declare class GuideHandReleaseCalculator implements MetricCalculator {
    readonly name = "guideHandRelease";
    readonly description = "When guide hand releases from ball (% of shot duration)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates all guide arm calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export declare function createGuideArmCalculators(): readonly MetricCalculator[];
//# sourceMappingURL=guide-arm.d.ts.map