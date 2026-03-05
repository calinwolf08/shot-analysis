/**
 * Shooting arm metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring shooting arm mechanics:
 * - shootingElbowFlare: angle of elbow relative to body plane
 * - shootingElbowAngle: bend angle at elbow at set point and release
 * - maxArmExtension: maximum elbow extension achieved
 * - wristSnapAngle: wrist flexion from set to release
 * - followThroughHold: duration arm stays extended
 *
 * @see Feature 5.2 - Shooting Arm Metrics
 */
import type { MetricCalculator, MetricCalculatorContext, MetricCalculatorResult } from "./types";
/**
 * Calculator for shooting elbow flare angle.
 *
 * Measures the angle of the shooting elbow relative to the body plane
 * at the release point. A lower angle indicates the elbow is tucked in
 * (better form), while a higher angle indicates the elbow is flared out.
 */
export declare class ShootingElbowFlareCalculator implements MetricCalculator {
    readonly name = "shootingElbowFlare";
    readonly description = "Angle of shooting elbow relative to body plane at release (degrees)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for shooting elbow angle (bend).
 *
 * Measures the angle at the elbow vertex (shoulder-elbow-wrist) at the
 * set point. An angle of 180 means straight arm, 90 means 90-degree bend.
 */
export declare class ShootingElbowAngleCalculator implements MetricCalculator {
    readonly name = "shootingElbowAngle";
    readonly description = "Bend angle at elbow (shoulder-elbow-wrist) at set point (degrees)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for maximum arm extension during follow-through.
 *
 * Finds the maximum elbow extension (straightest arm position) achieved
 * during the follow-through phase.
 */
export declare class MaxArmExtensionCalculator implements MetricCalculator {
    readonly name = "maxArmExtension";
    readonly description = "Maximum elbow extension achieved during follow-through (degrees)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for wrist snap angle.
 *
 * Measures the change in wrist flexion angle from set point to release.
 * Uses the elbow-wrist-finger angle to track wrist movement.
 */
export declare class WristSnapAngleCalculator implements MetricCalculator {
    readonly name = "wristSnapAngle";
    readonly description = "Wrist flexion change from set point to release (degrees)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for follow-through hold duration.
 *
 * Measures how long the arm stays extended after release as a percentage
 * of the total shot duration. A longer hold indicates better follow-through.
 */
export declare class FollowThroughHoldCalculator implements MetricCalculator {
    readonly name = "followThroughHold";
    readonly description = "Duration arm stays extended during follow-through (% of shot)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates all shooting arm calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export declare function createShootingArmCalculators(): readonly MetricCalculator[];
//# sourceMappingURL=shooting-arm.d.ts.map