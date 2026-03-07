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
// Re-export detection functions
export { adaptPoseDataToDetector, detectOrientation, runDetection, compareResults, runAndCompare, } from "./detection";
// Re-export reporting functions
export { formatConsoleOutput, formatFailureDetails, createTestReport, saveJsonReport, parseCliArgs, getHelpText, getExitCode, } from "./reporting";
//# sourceMappingURL=index.js.map