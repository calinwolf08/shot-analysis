/**
 * Test Runner Infrastructure
 *
 * This module provides functions for discovering and loading test cases
 * from the test-data/ directory for validating shot detection accuracy.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */
// Re-export schemas
export { orientationSchema, testLandmarkSchema, frameSchema, poseDataSchema, labeledShotSchema, labelDataSchema, isPoseData, isLabelData, } from "./types";
export { loadPoseData, loadLabelData, discoverTestCases, reportDiscoveryResults, } from "./loader";
//# sourceMappingURL=index.js.map