/**
 * Geometry utility functions for calculating angles and distances
 * between body landmarks in 3D space.
 *
 * Known Limitations:
 * - calculateAngle returns 0 for degenerate cases (identical/collinear points);
 *   consumers should check for this condition if distinguishing between
 *   "no angle" and "zero angle" is important
 * - All calculations assume Euclidean space; does not account for camera
 *   perspective distortion in 2D projections
 */
import type { Point3D, Point2D } from "../types";
/**
 * Calculates the angle in degrees formed by three points (a-vertex-c).
 * The angle is measured at the vertex point.
 *
 * Uses the dot product formula: cos(θ) = (va · vc) / (|va| * |vc|)
 *
 * @param a - First point (one side of the angle)
 * @param vertex - Vertex point (where the angle is measured)
 * @param c - Third point (other side of the angle)
 * @returns Angle in degrees (0-180). Returns 0 if any two points are identical.
 *
 * @example
 * ```ts
 * // Calculate elbow angle (shoulder-elbow-wrist)
 * const angle = calculateAngle(shoulder, elbow, wrist);
 * ```
 */
export declare function calculateAngle(a: Point3D, vertex: Point3D, c: Point3D): number;
/**
 * Calculates the Euclidean distance between two 3D points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Distance as a positive number. Returns 0 for identical points.
 *
 * @example
 * ```ts
 * // Calculate distance between shoulder and wrist
 * const distance = calculateDistance(shoulder, wrist);
 * ```
 */
export declare function calculateDistance(a: Point3D, b: Point3D): number;
/**
 * Calculates the Euclidean distance between two 2D points.
 * If Point3D is provided, the z coordinate is ignored.
 *
 * @param a - First point (Point2D or Point3D)
 * @param b - Second point (Point2D or Point3D)
 * @returns Distance as a positive number. Returns 0 for identical points.
 *
 * @example
 * ```ts
 * // Calculate 2D distance (ignoring depth)
 * const distance = calculateDistance2D(point1, point2);
 * ```
 */
export declare function calculateDistance2D(a: Point2D, b: Point2D): number;
//# sourceMappingURL=geometry.d.ts.map