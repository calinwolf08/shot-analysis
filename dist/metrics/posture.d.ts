/**
 * Posture and alignment metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring body posture and alignment:
 * - backPosture: spine angle from vertical (degrees) throughout shot
 * - headTilt: head angle from neutral (degrees) at release and follow-through
 * - shoulderAlignment: shoulder rotation relative to target (degrees) at set point
 * - handCupVsHinge: whether hand cups under or hinges back (categorical) at set point
 *
 * @see Feature 5.6 - Posture & Alignment Metrics
 */
import type { MetricCalculator, MetricCalculatorContext, MetricCalculatorResult } from "./types";
/**
 * Calculator for back posture (spine angle from vertical).
 *
 * Measures the angle of the spine from vertical throughout the shot.
 * Uses the midpoint of hips and midpoint of shoulders to define the spine vector.
 * An angle of 0 means perfectly upright, positive angles indicate lean.
 */
export declare class BackPostureCalculator implements MetricCalculator {
    readonly name = "backPosture";
    readonly description = "Spine angle from vertical (degrees, 0 = perfectly upright)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for head tilt angle.
 *
 * Measures the angle of head tilt from neutral (horizontal eye line)
 * at release and follow-through phases. Uses eye landmarks to determine
 * head orientation. Positive values indicate tilt to one side.
 */
export declare class HeadTiltCalculator implements MetricCalculator {
    readonly name = "headTilt";
    readonly description = "Head angle from neutral (degrees) at release/follow-through";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for shoulder alignment (rotation relative to target).
 *
 * Measures the rotation of shoulders relative to the target direction
 * (assumed to be straight ahead/camera) at the set point.
 * Uses the Z-coordinate difference between shoulders to determine rotation.
 * An angle of 0 means shoulders are square to the target.
 */
export declare class ShoulderAlignmentCalculator implements MetricCalculator {
    readonly name = "shoulderAlignment";
    readonly description = "Shoulder rotation relative to target (degrees, 0 = square) at set point";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Hand position category for cup vs hinge classification.
 */
export type HandPositionCategory = "cup" | "hinge" | "neutral";
/**
 * Calculator for hand cup vs hinge classification.
 *
 * Determines whether the shooting hand cups under the ball or hinges back
 * at the set point. Uses the wrist angle (elbow-wrist-finger) to classify.
 * - Cup: fingers curled back under the ball (angle < 150)
 * - Hinge: wrist bent back, fingers forward (angle > 170)
 * - Neutral: in between
 */
export declare class HandCupVsHingeCalculator implements MetricCalculator {
    readonly name = "handCupVsHinge";
    readonly description = "Whether hand cups under or hinges back (categorical) at set point";
    readonly unit = "category";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates all posture and alignment calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export declare function createPostureCalculators(): readonly MetricCalculator[];
//# sourceMappingURL=posture.d.ts.map