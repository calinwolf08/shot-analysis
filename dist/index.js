/**
 * Basketball Shot Form Analysis Module
 *
 * A TypeScript module that uses MediaPipe pose detection to analyze
 * basketball shooting form from video input.
 */
export { LANDMARK_INDICES, TOTAL_LANDMARKS } from "./types";
export { validateConfig, safeValidateConfig, createConfig, createDefaultConfig, getHandednessMapping, DEFAULT_CONFIG, analysisConfigSchema, shootingHandSchema, timingUnitSchema, formProfileSchema, metricTargetSchema, metricPrioritySchema, numericRangeSchema, } from "./config";
// Utility exports
export { 
// Geometry utilities
calculateAngle, calculateDistance, calculateDistance2D, 
// Coordinate normalization utilities
normalizeToBodyScale, calculateRelativePosition, 
// Smoothing utilities
movingAverage, movingAveragePoint3D, smoothLandmarkSequence, } from "./utils";
//# sourceMappingURL=index.js.map