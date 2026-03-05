/**
 * Coordinate normalization utility functions for converting raw landmark
 * positions to body-scale-normalized values.
 *
 * Known Limitations:
 * - Relies on shoulder width as sole body-scale reference; extreme shoulder
 *   positions (arms raised, hunched) may distort normalization
 * - No validation that shoulder width value is physiologically reasonable
 * - Does not account for perspective foreshortening in z-axis depth values
 */
import type { Point3D } from '../types';
/**
 * Normalizes a distance measurement using shoulder width as a body-scale reference.
 * This allows comparisons across different body sizes and camera distances.
 *
 * @param distance - The distance to normalize
 * @param shoulderWidth - The shoulder width (distance between landmarks 11 and 12)
 * @returns Normalized distance as a unitless ratio (1.0 = one shoulder width)
 * @throws Error if shoulderWidth is zero or negative
 *
 * @example
 * ```ts
 * // Normalize arm reach using shoulder width
 * const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);
 * const normalizedReach = normalizeToBodyScale(armReach, shoulderWidth);
 * ```
 */
export declare function normalizeToBodyScale(distance: number, shoulderWidth: number): number;
/**
 * Calculates the position of a point relative to a reference point.
 * Useful for expressing landmark positions relative to a body anchor (e.g., head, hip).
 *
 * @param point - The point to calculate relative position for
 * @param reference - The reference point (e.g., head position)
 * @returns A new Point3D representing the relative position (point - reference)
 *
 * @example
 * ```ts
 * // Calculate wrist position relative to head
 * const relativeWrist = calculateRelativePosition(wrist, head);
 * // Positive y means wrist is above head, negative means below
 * ```
 */
export declare function calculateRelativePosition(point: Point3D, reference: Point3D): Point3D;
//# sourceMappingURL=coordinates.d.ts.map