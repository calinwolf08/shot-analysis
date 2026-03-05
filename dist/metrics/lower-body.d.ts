/**
 * Lower body metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring lower body mechanics:
 * - hipDrop: how far hips drop in load phase (normalized to shoulder width)
 * - kneeFlexion: maximum knee bend angle at load (degrees, 180 = straight)
 * - legExtensionStart: when legs begin extending (% of total shot duration)
 *
 * @see Feature 5.5 - Lower Body Metrics
 */
import type { MetricCalculator, MetricCalculatorContext, MetricCalculatorResult } from "./types";
/**
 * Calculator for hip drop during load phase.
 *
 * Measures how far the hips drop from the initial standing position
 * to the lowest point in the load phase. The distance is normalized
 * to shoulder width to account for different camera distances.
 */
export declare class HipDropCalculator implements MetricCalculator {
    readonly name = "hipDrop";
    readonly description = "How far hips drop in load phase (normalized to shoulder width)";
    readonly unit = "ratio";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for maximum knee flexion during load phase.
 *
 * Measures the minimum knee angle (maximum bend) achieved during the
 * load phase. Uses the hip-knee-ankle angle, where 180 degrees is
 * a straight leg and smaller angles indicate more bend.
 */
export declare class KneeFlexionCalculator implements MetricCalculator {
    readonly name = "kneeFlexion";
    readonly description = "Maximum knee bend angle at load phase (degrees, 180 = straight)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for leg extension start timing.
 *
 * Detects when the legs begin extending (knee angle starts increasing)
 * and reports this as a percentage of the total shot duration.
 * This indicates the timing of the explosive upward motion.
 */
export declare class LegExtensionStartCalculator implements MetricCalculator {
    readonly name = "legExtensionStart";
    readonly description = "When legs begin extending (% of shot duration)";
    readonly unit = "percent";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates all lower body calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export declare function createLowerBodyCalculators(): readonly MetricCalculator[];
//# sourceMappingURL=lower-body.d.ts.map