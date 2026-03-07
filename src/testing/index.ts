/**
 * Test Runner Infrastructure
 *
 * This module provides functions for discovering and loading test cases
 * from the test-data/ directory for validating shot detection accuracy.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */

// Re-export types
export type {
  Orientation,
  TestLandmark,
  Frame,
  PoseData,
  LabeledShot,
  LabelData,
  TestCase,
  TestCaseDiscoveryResult,
  SkippedTestCase,
  TestCaseError,
} from "./types";

// Re-export schemas
export {
  orientationSchema,
  testLandmarkSchema,
  frameSchema,
  poseDataSchema,
  labeledShotSchema,
  labelDataSchema,
  isPoseData,
  isLabelData,
} from "./types";

// Re-export loader functions
export type {
  LoadPoseDataResult,
  LoadLabelDataResult,
  DiscoverTestCasesOptions,
} from "./loader";

export {
  loadPoseData,
  loadLabelData,
  discoverTestCases,
  reportDiscoveryResults,
} from "./loader";

// Re-export detection types
export type {
  DetectedShotResult,
  DetectionResult,
  FrameComparison,
  ShotComparison,
  ComparisonResult,
} from "./detection";

// Re-export detection functions
export {
  adaptPoseDataToDetector,
  detectOrientation,
  runDetection,
  compareResults,
  runAndCompare,
} from "./detection";

// Re-export reporting types
export type {
  TestSummary,
  ToleranceConfig,
  TestReport,
  CliArgs,
} from "./reporting";

// Re-export reporting functions
export {
  formatConsoleOutput,
  formatFailureDetails,
  createTestReport,
  saveJsonReport,
  parseCliArgs,
  getHelpText,
  getExitCode,
} from "./reporting";
