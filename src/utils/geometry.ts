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
export function calculateAngle(
  a: Point3D,
  vertex: Point3D,
  c: Point3D,
): number {
  // Calculate vectors from vertex to a and c
  const va = {
    x: a.x - vertex.x,
    y: a.y - vertex.y,
    z: a.z - vertex.z,
  };

  const vc = {
    x: c.x - vertex.x,
    y: c.y - vertex.y,
    z: c.z - vertex.z,
  };

  // Calculate magnitudes
  const magnitudeVa = Math.sqrt(va.x * va.x + va.y * va.y + va.z * va.z);
  const magnitudeVc = Math.sqrt(vc.x * vc.x + vc.y * vc.y + vc.z * vc.z);

  // If either vector has zero magnitude, the angle is undefined (return 0)
  if (magnitudeVa === 0 || magnitudeVc === 0) {
    return 0;
  }

  // Calculate dot product
  const dotProduct = va.x * vc.x + va.y * vc.y + va.z * vc.z;

  // Calculate cosine of the angle
  // Clamp to [-1, 1] to handle floating point errors
  const cosAngle = Math.max(
    -1,
    Math.min(1, dotProduct / (magnitudeVa * magnitudeVc)),
  );

  // Convert to degrees
  const angleRadians = Math.acos(cosAngle);
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
}

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
export function calculateDistance(a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

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
export function calculateDistance2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  return Math.sqrt(dx * dx + dy * dy);
}
