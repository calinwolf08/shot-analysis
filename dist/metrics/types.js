/**
 * Type definitions for metric extraction and shot analysis.
 *
 * This module defines types for calculating form metrics from detected shots
 * and organizing analysis results. It uses a strategy pattern for metric
 * calculators to allow independent, testable metric implementations.
 *
 * @see Feature 5.0 - Metric Extraction
 */
/**
 * Creates an empty MetricValue with default values.
 * Useful for initialization or testing.
 *
 * @param frame - The frame index for the metric (default: 0)
 */
export function createEmptyMetricValue(frame = 0) {
    return {
        value: 0,
        unit: "",
        frame,
        confidence: 0,
    };
}
/**
 * Creates an empty ShotAnalysis with default values.
 * Useful for initialization or testing.
 *
 * @param shotIndex - The index of the shot (default: 0)
 */
export function createEmptyShotAnalysis(shotIndex = 0) {
    return {
        shotIndex,
        frameRange: { start: 0, end: 0 },
        phases: {},
        metrics: {},
        overallConfidence: 0,
    };
}
/**
 * Creates an empty VideoMetadata with default values.
 * Useful for initialization or testing.
 */
export function createEmptyVideoMetadata() {
    return {
        width: 0,
        height: 0,
        fps: 0,
        totalFrames: 0,
    };
}
/**
 * Creates an empty AnalysisResult with default values.
 * Useful for initialization or testing.
 *
 * @param config - The analysis configuration to use
 */
export function createEmptyAnalysisResult(config) {
    return {
        shots: [],
        videoMetadata: createEmptyVideoMetadata(),
        config,
    };
}
/**
 * Checks if a metric calculation was successful.
 *
 * @param result - The metric calculator result to check
 * @returns true if the result contains a valid metric value
 */
export function isSuccessfulMetricResult(result) {
    return result.value !== undefined;
}
/**
 * Gets the average confidence of all metrics in a shot analysis.
 * Returns 0 if there are no metrics.
 *
 * @param analysis - The shot analysis to calculate average confidence for
 */
export function getAverageMetricConfidence(analysis) {
    const metrics = Object.values(analysis.metrics);
    if (metrics.length === 0) {
        return 0;
    }
    const totalConfidence = metrics.reduce((sum, metric) => sum + metric.confidence, 0);
    return totalConfidence / metrics.length;
}
/**
 * Filters metrics by minimum confidence threshold.
 *
 * @param metrics - Record of metrics to filter
 * @param minConfidence - Minimum confidence threshold (0-1)
 * @returns New record containing only metrics meeting the threshold
 */
export function filterMetricsByConfidence(metrics, minConfidence) {
    const filtered = {};
    for (const [name, metric] of Object.entries(metrics)) {
        if (metric.confidence >= minConfidence) {
            filtered[name] = metric;
        }
    }
    return filtered;
}
//# sourceMappingURL=types.js.map