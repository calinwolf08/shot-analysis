/**
 * Test case discovery and loading functions.
 *
 * This module provides functions to scan the test-data/ directory for valid
 * test cases and load their pose and label data.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */
import { type PoseData, type LabelData, type TestCaseDiscoveryResult } from "./types";
/**
 * Result of loading pose data.
 */
export type LoadPoseDataResult = {
    success: true;
    data: PoseData;
} | {
    success: false;
    error: string;
};
/**
 * Result of loading label data.
 */
export type LoadLabelDataResult = {
    success: true;
    data: LabelData;
} | {
    success: false;
    error: string;
};
/**
 * Loads and parses a poses.json file.
 *
 * @param filePath - Absolute path to the poses.json file
 * @returns Result with parsed PoseData or error message
 */
export declare function loadPoseData(filePath: string): LoadPoseDataResult;
/**
 * Loads and parses a labels.json file.
 *
 * @param filePath - Absolute path to the labels.json file
 * @returns Result with parsed LabelData or error message
 */
export declare function loadLabelData(filePath: string): LoadLabelDataResult;
/**
 * Options for test case discovery.
 */
export interface DiscoverTestCasesOptions {
    /** Path to the test-data directory. Defaults to 'test-data' relative to cwd. */
    testDataDir?: string;
    /** Whether to create the test-data directory if it doesn't exist. Defaults to false. */
    createIfMissing?: boolean;
}
/**
 * Discovers all valid test cases from the test-data directory.
 *
 * A valid test case is a subdirectory containing both:
 * - poses.json: Extracted pose data
 * - labels.json: Ground truth shot labels
 *
 * @param options - Discovery options
 * @returns Discovery result with test cases, skipped directories, and errors
 */
export declare function discoverTestCases(options?: DiscoverTestCasesOptions): TestCaseDiscoveryResult;
/**
 * Reports discovery results to the console.
 *
 * @param result - Discovery result to report
 */
export declare function reportDiscoveryResults(result: TestCaseDiscoveryResult): void;
//# sourceMappingURL=loader.d.ts.map