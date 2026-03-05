/**
 * Timing and synchronization metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring shot timing and coordination:
 * - ballRiseStart: when ball begins upward motion (% of shot)
 * - legRiseStart: when legs begin extending (% of shot)
 * - ballLegSync: difference between ball and leg rise (%, negative = ball first)
 * - releaseStart: when release motion begins (% of shot)
 * - totalShotDuration: full shot from gather to follow-through (ms)
 *
 * @see Feature 5.7 - Timing & Synchronization Metrics
 */
import type { MetricCalculator, MetricCalculatorContext, MetricCalculatorResult } from "./types";
/**
 * Calculator for ball rise start timing.
 *
 * Detects when the ball begins its upward motion using wrist position
 * as a proxy. Reports the timing as a percentage of the total shot duration.
 */
export declare class BallRiseStartCalculator implements MetricCalculator {
    readonly name = "ballRiseStart";
    readonly description = "When ball begins upward motion (% of shot duration)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for leg rise start timing.
 *
 * Detects when the legs begin extending (knee angle starts increasing)
 * and reports the timing as a percentage of the total shot duration.
 */
export declare class LegRiseStartCalculator implements MetricCalculator {
    readonly name = "legRiseStart";
    readonly description = "When legs begin extending (% of shot duration)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for ball-leg synchronization.
 *
 * Calculates the difference between ball rise start and leg rise start
 * as a percentage of total shot duration. Negative values indicate
 * ball rises first; positive values indicate legs rise first.
 */
export declare class BallLegSyncCalculator implements MetricCalculator {
    readonly name = "ballLegSync";
    readonly description = "Ball-leg sync: difference between ball and leg rise (%, negative = ball first)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for release start timing.
 *
 * Reports when the release motion begins as a percentage of the
 * total shot duration. Uses the release phase start frame.
 */
export declare class ReleaseStartCalculator implements MetricCalculator {
    readonly name = "releaseStart";
    readonly description = "When release motion begins (% of shot duration)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for total shot duration.
 *
 * Calculates the total duration of the shot from gather to follow-through
 * in milliseconds, using pose timestamps for accurate timing.
 */
export declare class TotalShotDurationCalculator implements MetricCalculator {
    readonly name = "totalShotDuration";
    readonly description = "Full shot duration from gather to follow-through (ms)";
    readonly unit = "ms";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates all timing calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export declare function createTimingCalculators(): readonly MetricCalculator[];
//# sourceMappingURL=timing.d.ts.map