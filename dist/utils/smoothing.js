/**
 * Smoothing utility functions for reducing noise in landmark data.
 * Uses moving average techniques to smooth out jitter from pose detection.
 *
 * Known Limitations:
 * - Uses fixed window sizes; adaptive window sizing based on signal characteristics
 *   could improve results for varying frame rates or noise levels
 * - Simple moving average may introduce lag; consider exponential moving average
 *   for more responsive smoothing in live processing scenarios
 * - No built-in outlier rejection; spikes in data are averaged rather than filtered
 */
/** Default window size for smoothing operations */
const DEFAULT_WINDOW_SIZE = 3;
/**
 * Applies a moving average filter to a sequence of numeric values.
 * Uses a backward-looking window (current and previous values).
 *
 * @param values - Array of numeric values to smooth
 * @param windowSize - Number of values to include in the average (default: 3)
 * @returns Smoothed array of the same length
 * @throws Error if windowSize is less than 1
 *
 * @example
 * ```ts
 * const noisy = [10, 12, 100, 11, 9]; // spike at index 2
 * const smoothed = movingAverage(noisy, 3);
 * // smoothed[2] is now ~40 instead of 100
 * ```
 */
export function movingAverage(values, windowSize) {
    if (windowSize < 1) {
        throw new Error('Window size must be at least 1');
    }
    if (values.length === 0) {
        return [];
    }
    const result = [];
    for (let i = 0; i < values.length; i++) {
        // Determine the start of the window (can't go below 0)
        const windowStart = Math.max(0, i - windowSize + 1);
        const actualWindowSize = i - windowStart + 1;
        // Calculate sum of values in window
        let sum = 0;
        for (let j = windowStart; j <= i; j++) {
            sum += values[j];
        }
        // Calculate average
        result.push(sum / actualWindowSize);
    }
    return result;
}
/**
 * Applies a moving average filter to a sequence of 3D points.
 * Each coordinate (x, y, z) is smoothed independently.
 *
 * @param points - Array of Point3D to smooth
 * @param windowSize - Number of points to include in the average (default: 3)
 * @returns Smoothed array of Point3D of the same length
 * @throws Error if windowSize is less than 1
 *
 * @example
 * ```ts
 * const noisyLandmarks = [point1, point2, spikePoint, point3, point4];
 * const smoothed = movingAveragePoint3D(noisyLandmarks, 3);
 * ```
 */
export function movingAveragePoint3D(points, windowSize) {
    if (windowSize < 1) {
        throw new Error('Window size must be at least 1');
    }
    if (points.length === 0) {
        return [];
    }
    // Extract x, y, z arrays
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const zValues = points.map((p) => p.z);
    // Smooth each coordinate independently
    const smoothedX = movingAverage(xValues, windowSize);
    const smoothedY = movingAverage(yValues, windowSize);
    const smoothedZ = movingAverage(zValues, windowSize);
    // Reconstruct Point3D array
    const result = [];
    for (let i = 0; i < points.length; i++) {
        result.push({
            x: smoothedX[i],
            y: smoothedY[i],
            z: smoothedZ[i]
        });
    }
    return result;
}
/**
 * Smooths a sequence of landmark positions over time to reduce jitter.
 * This is a convenience wrapper around movingAveragePoint3D with a
 * sensible default window size for landmark data.
 *
 * @param sequence - Array of Point3D positions for a single landmark over time
 * @param windowSize - Number of frames to include in the average (default: 3)
 * @returns Smoothed sequence of the same length
 *
 * @example
 * ```ts
 * // Smooth wrist positions across multiple frames
 * const wristPositions = frames.map(f => f.landmarks[LANDMARK_INDICES.RIGHT_WRIST].position);
 * const smoothedWrist = smoothLandmarkSequence(wristPositions);
 * ```
 */
export function smoothLandmarkSequence(sequence, windowSize = DEFAULT_WINDOW_SIZE) {
    return movingAveragePoint3D(sequence, windowSize);
}
//# sourceMappingURL=smoothing.js.map