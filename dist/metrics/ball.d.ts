/**
 * Ball position metric calculators for basketball shot analysis.
 *
 * This module provides calculators for measuring inferred ball position metrics:
 * - ballDip: how far ball drops before rising (normalized distance)
 * - ballPath: straightness of path to set point (deviation score)
 * - setPointHeight: height of set point relative to head (normalized)
 * - setPointDuration: how long ball stays at set point (ms)
 * - releasePoint: height/position at release (normalized coords)
 * - releaseAngle: angle of shooting arm at release (degrees)
 * - ballBehindHead: furthest back position relative to head (normalized)
 *
 * Ball center is inferred as midpoint of index fingers (landmarks 19, 20)
 * when hands are together. All distances normalized to shoulder width.
 * Heights relative to head (nose landmark 0).
 *
 * Note: Ball position tracking is only valid when hands are together.
 * After hands separate (release), ball cannot be tracked.
 * Ball metrics have lower confidence than body metrics.
 *
 * @see Feature 5.4 - Ball Position Metrics (Inferred)
 */
import type { MetricCalculator, MetricCalculatorContext, MetricCalculatorResult } from "./types";
import type { PoseLandmarks, Point3D } from "../types";
/**
 * Inferred ball position result.
 */
export interface InferredBallPosition {
    /** Inferred ball center position */
    readonly position: Point3D;
    /** Confidence score (0-1), based on index finger visibility */
    readonly confidence: number;
}
/**
 * Determines if hands are together (holding the ball).
 * Based on distance between index fingers.
 *
 * @param pose - The pose to check
 * @param threshold - Maximum distance for hands to be considered together (default: 0.08)
 * @returns true if hands are together, false otherwise
 */
export declare function areHandsTogether(pose: PoseLandmarks, threshold?: number): boolean;
/**
 * Infers the ball center position from index finger positions.
 * Ball center is the midpoint between left and right index fingers.
 *
 * @param pose - The pose to infer ball position from
 * @returns Inferred ball position with confidence, or null if hands are separated
 */
export declare function inferBallCenter(pose: PoseLandmarks): InferredBallPosition | null;
/**
 * Calculator for ball dip distance.
 *
 * Measures how far the ball drops from its initial position before rising
 * to the set point. Normalized to shoulder width.
 * A dip of 0 means the ball only rises (no dip shooting style).
 */
export declare class BallDipCalculator implements MetricCalculator {
    readonly name = "ballDip";
    readonly description = "How far ball drops before rising to set point (normalized to shoulder width)";
    readonly unit = "normalized";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for ball path straightness.
 *
 * Measures the deviation of the ball path from a straight line between
 * starting position and set point. A score of 0 means perfectly straight.
 */
export declare class BallPathCalculator implements MetricCalculator {
    readonly name = "ballPath";
    readonly description = "Straightness of ball path to set point (deviation score, 0 = straight)";
    readonly unit = "deviation";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for set point height.
 *
 * Measures the height of the ball at set point relative to the head (nose).
 * Positive values mean above head, negative means below.
 * Normalized to shoulder width.
 */
export declare class SetPointHeightCalculator implements MetricCalculator {
    readonly name = "setPointHeight";
    readonly description = "Height of ball at set point relative to head (normalized to shoulder width)";
    readonly unit = "normalized";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for set point duration.
 *
 * Measures how long the ball stays at the set point in milliseconds.
 * Uses the duration of the SetPoint phase.
 */
export declare class SetPointDurationCalculator implements MetricCalculator {
    readonly name = "setPointDuration";
    readonly description = "Duration ball stays at set point (milliseconds)";
    readonly unit = "ms";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for release point position.
 *
 * Measures the ball position at release relative to the head.
 * Returns the height (y position) normalized to shoulder width.
 */
export declare class ReleasePointCalculator implements MetricCalculator {
    readonly name = "releasePoint";
    readonly description = "Ball height at release point relative to head (normalized to shoulder width)";
    readonly unit = "normalized";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for release angle.
 *
 * Measures the angle of the shooting arm at release point.
 * The angle is measured from horizontal (0° = horizontal, 90° = straight up).
 */
export declare class ReleaseAngleCalculator implements MetricCalculator {
    readonly name = "releaseAngle";
    readonly description = "Angle of shooting arm at release point (degrees from horizontal)";
    readonly unit = "degrees";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Calculator for ball behind head position.
 *
 * Measures the furthest back position of the ball relative to the head
 * during the shot. Normalized to shoulder width.
 * This indicates how far back the shooter brings the ball.
 */
export declare class BallBehindHeadCalculator implements MetricCalculator {
    readonly name = "ballBehindHead";
    readonly description = "Furthest back position of ball relative to head (normalized to shoulder width)";
    readonly unit = "normalized";
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates all ball position metric calculators.
 * Convenience function for registering all calculators with the orchestrator.
 */
export declare function createBallMetricCalculators(): readonly MetricCalculator[];
//# sourceMappingURL=ball.d.ts.map