/**
 * Test Runner Infrastructure
 *
 * This module provides functions for discovering and loading test cases
 * from the test-data/ directory for validating shot detection accuracy.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */
export type { Orientation, TestLandmark, Frame, PoseData, LabeledShot, LabelData, TestCase, TestCaseDiscoveryResult, SkippedTestCase, TestCaseError, } from "./types";
export { orientationSchema, testLandmarkSchema, frameSchema, poseDataSchema, labeledShotSchema, labelDataSchema, isPoseData, isLabelData, } from "./types";
export type { LoadPoseDataResult, LoadLabelDataResult, DiscoverTestCasesOptions, } from "./loader";
export { loadPoseData, loadLabelData, discoverTestCases, reportDiscoveryResults, } from "./loader";
//# sourceMappingURL=index.d.ts.map