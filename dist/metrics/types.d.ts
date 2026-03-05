/**
 * Type definitions for metric extraction and shot analysis.
 *
 * This module defines types for calculating form metrics from detected shots
 * and organizing analysis results. It uses a strategy pattern for metric
 * calculators to allow independent, testable metric implementations.
 *
 * @see Feature 5.0 - Metric Extraction
 */
import type { AnalysisConfig } from "../config";
import type { ShotPhases } from "../detection/types";
import type { PoseLandmarks } from "../types";
/**
 * A single metric value with context and confidence.
 *
 * Each metric captures a specific measurement at a particular frame,
 * with associated unit and confidence level.
 */
export interface MetricValue {
    /** The calculated value (numeric for measurements, string for categorical) */
    readonly value: number | string;
    /** Unit of measurement (e.g., 'degrees', 'percent', 'ratio') */
    readonly unit: string;
    /** Frame index where this metric was measured */
    readonly frame: number;
    /** Confidence score for this metric (0-1) */
    readonly confidence: number;
}
/**
 * Analysis results for a single basketball shot.
 *
 * Contains the shot's frame range, phase breakdown, calculated metrics,
 * and overall confidence score.
 */
export interface ShotAnalysis {
    /** Zero-based index of this shot within the video */
    readonly shotIndex: number;
    /** Frame range spanning the entire shot */
    readonly frameRange: {
        /** Starting frame index (inclusive, 0-based) */
        readonly start: number;
        /** Ending frame index (inclusive, 0-based) */
        readonly end: number;
    };
    /** Phase ranges for each detected phase */
    readonly phases: ShotPhases;
    /** Calculated metrics keyed by metric name */
    readonly metrics: Readonly<Record<string, MetricValue>>;
    /** Overall confidence score for this shot analysis (0-1) */
    readonly overallConfidence: number;
}
/**
 * Metadata about the video that was analyzed.
 */
export interface VideoMetadata {
    /** Frame width in pixels */
    readonly width: number;
    /** Frame height in pixels */
    readonly height: number;
    /** Video duration in milliseconds (undefined for live streams) */
    readonly duration?: number;
    /** Frame rate in frames per second */
    readonly fps: number;
    /** Total number of frames in the video */
    readonly totalFrames: number;
}
/**
 * Complete analysis result for a video.
 *
 * Contains all shot analyses, video metadata, and the configuration
 * used for the analysis.
 */
export interface AnalysisResult {
    /** Analysis results for each detected shot */
    readonly shots: readonly ShotAnalysis[];
    /** Metadata about the analyzed video */
    readonly videoMetadata: VideoMetadata;
    /** Configuration used for this analysis */
    readonly config: AnalysisConfig;
}
/**
 * Context provided to metric calculators for computing metrics.
 *
 * Contains all the data needed to calculate metrics for a single shot.
 */
export interface MetricCalculatorContext {
    /** Pose landmarks for each frame in the shot */
    readonly poseLandmarks: readonly PoseLandmarks[];
    /** Phase ranges for the shot being analyzed */
    readonly phases: ShotPhases;
    /** Frame range of the shot */
    readonly frameRange: {
        readonly start: number;
        readonly end: number;
    };
    /** Configuration for the analysis */
    readonly config: AnalysisConfig;
}
/**
 * Result from a metric calculator.
 *
 * Contains the calculated metric value or indicates the metric
 * could not be calculated (e.g., due to occluded landmarks).
 */
export interface MetricCalculatorResult {
    /** The calculated metric value, or undefined if calculation failed */
    readonly value?: MetricValue | undefined;
    /** Error message if calculation failed */
    readonly error?: string | undefined;
}
/**
 * Interface for metric calculators implementing the strategy pattern.
 *
 * Each metric calculator is responsible for computing a single metric
 * from shot data. Calculators are independent and can be tested in isolation.
 *
 * @example
 * ```typescript
 * class ElbowAngleCalculator implements MetricCalculator {
 *   readonly name = 'elbowAngleAtRelease';
 *   readonly description = 'Elbow angle at the release point';
 *   readonly unit = 'degrees';
 *
 *   calculate(context: MetricCalculatorContext): MetricCalculatorResult {
 *     // Find release frame and calculate elbow angle
 *     const releasePhase = context.phases.release;
 *     if (!releasePhase) {
 *       return { error: 'Release phase not detected' };
 *     }
 *     // ... calculate angle
 *     return {
 *       value: {
 *         value: 165,
 *         unit: this.unit,
 *         frame: releasePhase.startFrame,
 *         confidence: 0.95
 *       }
 *     };
 *   }
 * }
 * ```
 */
export interface MetricCalculator {
    /** Unique identifier for this metric */
    readonly name: string;
    /** Human-readable description of what this metric measures */
    readonly description: string;
    /** Unit of measurement for this metric */
    readonly unit: string;
    /**
     * Calculates the metric value from the provided context.
     *
     * @param context - The context containing pose data and configuration
     * @returns The calculated metric result or an error
     */
    calculate(context: MetricCalculatorContext): MetricCalculatorResult;
}
/**
 * Creates an empty MetricValue with default values.
 * Useful for initialization or testing.
 *
 * @param frame - The frame index for the metric (default: 0)
 */
export declare function createEmptyMetricValue(frame?: number): MetricValue;
/**
 * Creates an empty ShotAnalysis with default values.
 * Useful for initialization or testing.
 *
 * @param shotIndex - The index of the shot (default: 0)
 */
export declare function createEmptyShotAnalysis(shotIndex?: number): ShotAnalysis;
/**
 * Creates an empty VideoMetadata with default values.
 * Useful for initialization or testing.
 */
export declare function createEmptyVideoMetadata(): VideoMetadata;
/**
 * Creates an empty AnalysisResult with default values.
 * Useful for initialization or testing.
 *
 * @param config - The analysis configuration to use
 */
export declare function createEmptyAnalysisResult(config: AnalysisConfig): AnalysisResult;
/**
 * Checks if a metric calculation was successful.
 *
 * @param result - The metric calculator result to check
 * @returns true if the result contains a valid metric value
 */
export declare function isSuccessfulMetricResult(result: MetricCalculatorResult): result is MetricCalculatorResult & {
    readonly value: MetricValue;
};
/**
 * Gets the average confidence of all metrics in a shot analysis.
 * Returns 0 if there are no metrics.
 *
 * @param analysis - The shot analysis to calculate average confidence for
 */
export declare function getAverageMetricConfidence(analysis: ShotAnalysis): number;
/**
 * Filters metrics by minimum confidence threshold.
 *
 * @param metrics - Record of metrics to filter
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @returns New record containing only metrics meeting the threshold
 */
export declare function filterMetricsByConfidence(metrics: Readonly<Record<string, MetricValue>>, minConfidence: number): Readonly<Record<string, MetricValue>>;
//# sourceMappingURL=types.d.ts.map