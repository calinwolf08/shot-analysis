/**
 * Reporting functions for the test runner infrastructure.
 *
 * This module provides:
 * - Console output formatting with colored pass/fail indicators
 * - Failure detail formatting showing frame differences
 * - JSON report generation for test results
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 * @see Task 9.3 - Reporting & CLI
 */
import type { ComparisonResult } from "./detection";
/**
 * Summary statistics for a test run.
 */
export interface TestSummary {
    /** Total number of test cases */
    readonly total: number;
    /** Number of passing test cases */
    readonly passed: number;
    /** Number of failing test cases */
    readonly failed: number;
}
/**
 * Tolerance configuration used for the test run.
 */
export interface ToleranceConfig {
    /** Base tolerance in frames (±3) */
    readonly frames: number;
    /** Expanded tolerance when triggered (±5) */
    readonly expandedTo: number;
}
/**
 * Complete test report structure.
 */
export interface TestReport {
    /** ISO timestamp of when the test was run */
    readonly runAt: string;
    /** Summary statistics */
    readonly summary: TestSummary;
    /** Tolerance configuration */
    readonly tolerance: ToleranceConfig;
    /** Individual test results */
    readonly results: readonly ComparisonResult[];
}
/**
 * Formats complete console output for all test results.
 *
 * Shows:
 * - Header with test data directory
 * - Pass/fail status for each test case
 * - Summary statistics
 *
 * @param results - Array of comparison results
 * @param testDataDir - Path to the test data directory
 * @returns Formatted console output string
 */
export declare function formatConsoleOutput(results: readonly ComparisonResult[], testDataDir?: string): string;
/**
 * Formats detailed failure information for all failing test cases.
 *
 * Shows frame-level differences for each failing test to help
 * diagnose detection accuracy issues.
 *
 * @param results - Array of comparison results (filters to failures only)
 * @returns Formatted failure details string, empty if no failures
 */
export declare function formatFailureDetails(results: readonly ComparisonResult[]): string;
/**
 * Creates a TestReport object from comparison results.
 *
 * @param results - Array of comparison results
 * @returns Complete test report structure
 */
export declare function createTestReport(results: readonly ComparisonResult[]): TestReport;
/**
 * Saves test results as a JSON report file.
 *
 * The report is pretty-printed for human readability and includes:
 * - Run timestamp
 * - Summary statistics
 * - Tolerance configuration
 * - All individual comparison results
 *
 * @param results - Array of comparison results
 * @param outputPath - Path to write the JSON report (default: test-data/test-results.json)
 * @returns Object indicating success or error
 */
export declare function saveJsonReport(results: readonly ComparisonResult[], outputPath?: string): {
    success: true;
} | {
    success: false;
    error: string;
};
/**
 * Parsed CLI arguments for the test runner.
 */
export interface CliArgs {
    /** Specific video name to test (from --video flag) */
    readonly video?: string;
    /** Multiple video names/patterns to test (from --videos flag, comma-separated) */
    readonly videos?: readonly string[];
    /** Path to test data directory */
    readonly testDataDir: string;
    /** Path to output JSON report */
    readonly outputPath: string;
    /** Whether to show help */
    readonly help: boolean;
}
/**
 * Parses command-line arguments for the test runner.
 *
 * Supports:
 * - --video <name>: Run test for a specific video only
 * - --videos <list>: Run tests for multiple videos (comma-separated)
 * - --test-data <path>: Path to test data directory (default: test-data)
 * - --output <path>: Path for JSON report (default: test-data/test-results.json)
 * - --help: Show help message
 *
 * @param args - Command-line arguments (default: process.argv.slice(2))
 * @returns Parsed CLI arguments
 */
export declare function parseCliArgs(args?: string[]): CliArgs;
/**
 * Returns the help text for the CLI.
 */
export declare function getHelpText(): string;
/**
 * Determines the exit code based on test results.
 *
 * @param results - Array of comparison results
 * @returns 0 if all tests pass (or no tests), 1 if any test fails
 */
export declare function getExitCode(results: readonly ComparisonResult[]): number;
//# sourceMappingURL=reporting.d.ts.map