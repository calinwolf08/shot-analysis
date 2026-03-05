/**
 * Utility functions for geometry, coordinate normalization, and smoothing.
 * Re-exports all utilities from their respective modules.
 */

export {
  calculateAngle,
  calculateDistance,
  calculateDistance2D,
} from "./geometry";

export { normalizeToBodyScale, calculateRelativePosition } from "./coordinates";

export {
  movingAverage,
  movingAveragePoint3D,
  smoothLandmarkSequence,
} from "./smoothing";
