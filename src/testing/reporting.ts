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

import * as fs from "node:fs";
import * as path from "node:path";
import type { ComparisonResult, ShotComparison } from "./detection";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// ANSI Color Codes
// ============================================================================

/** ANSI escape codes for console coloring */
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

/** Unicode symbols for pass/fail indicators */
const SYMBOLS = {
  pass: "\u2714", // checkmark
  fail: "\u2718", // X
} as const;

// ============================================================================
// Console Output Formatting
// ============================================================================

/**
 * Formats a single test result line for console output.
 *
 * Format: "[checkmark/X] video-name PASS/FAIL"
 * - Pass: green checkmark and "PASS"
 * - Fail: red X and "FAIL"
 *
 * @param result - Comparison result for a single test case
 * @returns Formatted string with ANSI color codes
 */
function formatTestLine(result: ComparisonResult): string {
  const isPassing = result.status === "pass";

  if (isPassing) {
    return `${COLORS.green}${SYMBOLS.pass}${COLORS.reset} ${result.video} ${COLORS.green}${COLORS.bold}PASS${COLORS.reset}`;
  } else {
    return `${COLORS.red}${SYMBOLS.fail}${COLORS.reset} ${result.video} ${COLORS.red}${COLORS.bold}FAIL${COLORS.reset}`;
  }
}

/**
 * Formats the header for console output.
 *
 * @param testDataDir - Path to the test data directory
 * @returns Formatted header string
 */
function formatHeader(testDataDir: string): string {
  return `\n${COLORS.cyan}${COLORS.bold}Shot Detection Test Runner${COLORS.reset}\n${COLORS.gray}Test data: ${testDataDir}${COLORS.reset}\n`;
}

/**
 * Formats the summary section for console output.
 *
 * @param summary - Test summary statistics
 * @returns Formatted summary string
 */
function formatSummary(summary: TestSummary): string {
  const lines: string[] = [];
  lines.push(`\n${COLORS.bold}Summary${COLORS.reset}`);

  const passRate =
    summary.total > 0
      ? ((summary.passed / summary.total) * 100).toFixed(0)
      : "0";

  lines.push(`  Total: ${summary.total}`);

  if (summary.passed > 0) {
    lines.push(
      `  ${COLORS.green}Passed: ${summary.passed}${COLORS.reset} (${passRate}%)`,
    );
  } else {
    lines.push(`  Passed: 0`);
  }

  if (summary.failed > 0) {
    lines.push(`  ${COLORS.red}Failed: ${summary.failed}${COLORS.reset}`);
  } else {
    lines.push(`  Failed: 0`);
  }

  return lines.join("\n");
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
export function formatConsoleOutput(
  results: readonly ComparisonResult[],
  testDataDir: string = "test-data",
): string {
  const lines: string[] = [];

  // Header
  lines.push(formatHeader(testDataDir));

  // Handle empty results
  if (results.length === 0) {
    lines.push(`${COLORS.yellow}No test cases found.${COLORS.reset}`);
    return lines.join("\n");
  }

  // Test results
  lines.push(`${COLORS.bold}Results${COLORS.reset}`);
  for (const result of results) {
    lines.push(`  ${formatTestLine(result)}`);
  }

  // Summary
  const summary: TestSummary = {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
  };
  lines.push(formatSummary(summary));

  return lines.join("\n");
}

// ============================================================================
// Failure Details Formatting
// ============================================================================

/**
 * Formats frame comparison details for a single shot.
 *
 * Shows detected vs expected frames and the difference.
 *
 * @param shot - Shot comparison data
 * @returns Formatted string with frame differences
 */
function formatShotComparison(shot: ShotComparison): string {
  const lines: string[] = [];
  const shotHeader = `    Shot ${shot.shotNumber}:`;

  const startStatus = shot.startFrame.pass
    ? COLORS.green
    : `${COLORS.red}${COLORS.bold}`;
  const endStatus = shot.endFrame.pass
    ? COLORS.green
    : `${COLORS.red}${COLORS.bold}`;

  const startDiffStr = formatDiff(
    shot.startFrame.diff,
    shot.startFrame.detected,
    shot.startFrame.expected,
  );
  const endDiffStr = formatDiff(
    shot.endFrame.diff,
    shot.endFrame.detected,
    shot.endFrame.expected,
  );

  lines.push(shotHeader);
  lines.push(
    `      Start: ${startStatus}detected ${shot.startFrame.detected}, expected ${shot.startFrame.expected} (${startDiffStr})${COLORS.reset}`,
  );
  lines.push(
    `      End:   ${endStatus}detected ${shot.endFrame.detected}, expected ${shot.endFrame.expected} (${endDiffStr})${COLORS.reset}`,
  );

  return lines.join("\n");
}

/**
 * Formats the difference value with +/- sign.
 */
function formatDiff(diff: number, detected: number, expected: number): string {
  const sign = detected >= expected ? "+" : "-";
  return `${sign}${diff}`;
}

/**
 * Formats detailed failure information for a single test case.
 *
 * Shows:
 * - Orientation comparison (if mismatched)
 * - Per-shot frame comparisons with detected vs expected values
 * - Failure reason summary
 *
 * @param result - Comparison result for a failing test case
 * @returns Formatted failure details string
 */
function formatSingleFailure(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push(`\n  ${COLORS.red}${SYMBOLS.fail} ${result.video}${COLORS.reset}`);

  // Orientation info
  if (!result.orientation.match) {
    lines.push(
      `    ${COLORS.red}Orientation: detected '${result.orientation.detected}', expected '${result.orientation.expected}'${COLORS.reset}`,
    );
  } else {
    lines.push(
      `    ${COLORS.gray}Orientation: ${result.orientation.detected} (match)${COLORS.reset}`,
    );
  }

  // Shot comparisons
  if (result.shots.length > 0) {
    for (const shot of result.shots) {
      lines.push(formatShotComparison(shot));
    }
  } else if (result.failureReason) {
    lines.push(`    ${COLORS.red}${result.failureReason}${COLORS.reset}`);
  }

  return lines.join("\n");
}

/**
 * Formats detailed failure information for all failing test cases.
 *
 * Shows frame-level differences for each failing test to help
 * diagnose detection accuracy issues.
 *
 * @param results - Array of comparison results (filters to failures only)
 * @returns Formatted failure details string, empty if no failures
 */
export function formatFailureDetails(
  results: readonly ComparisonResult[],
): string {
  const failures = results.filter((r) => r.status === "fail");

  if (failures.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push(`\n${COLORS.bold}${COLORS.red}Failure Details${COLORS.reset}`);

  for (const failure of failures) {
    lines.push(formatSingleFailure(failure));
  }

  return lines.join("\n");
}

// ============================================================================
// JSON Report Generation
// ============================================================================

/**
 * Creates a TestReport object from comparison results.
 *
 * @param results - Array of comparison results
 * @returns Complete test report structure
 */
export function createTestReport(
  results: readonly ComparisonResult[],
): TestReport {
  return {
    runAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
    },
    tolerance: {
      frames: 3,
      expandedTo: 5,
    },
    results,
  };
}

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
export function saveJsonReport(
  results: readonly ComparisonResult[],
  outputPath: string = "test-data/test-results.json",
): { success: true } | { success: false; error: string } {
  const report = createTestReport(results);

  // Resolve to absolute path
  const absolutePath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  // Ensure directory exists
  const dir = path.dirname(absolutePath);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create directory: ${message}` };
  }

  // Write JSON file
  try {
    const json = JSON.stringify(report, null, 2);
    fs.writeFileSync(absolutePath, json, "utf-8");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to write report: ${message}` };
  }
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

/**
 * Parsed CLI arguments for the test runner.
 */
export interface CliArgs {
  /** Specific video name to test (from --video flag) */
  readonly video?: string;
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
 * - --test-data <path>: Path to test data directory (default: test-data)
 * - --output <path>: Path for JSON report (default: test-data/test-results.json)
 * - --help: Show help message
 *
 * @param args - Command-line arguments (default: process.argv.slice(2))
 * @returns Parsed CLI arguments
 */
export function parseCliArgs(args: string[] = process.argv.slice(2)): CliArgs {
  const result: {
    video?: string;
    testDataDir: string;
    outputPath: string;
    help: boolean;
  } = {
    testDataDir: "test-data",
    outputPath: "test-data/test-results.json",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--video" && i + 1 < args.length) {
      result.video = args[i + 1]!;
      i++;
    } else if (arg === "--test-data" && i + 1 < args.length) {
      result.testDataDir = args[i + 1]!;
      i++;
    } else if (arg === "--output" && i + 1 < args.length) {
      result.outputPath = args[i + 1]!;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

/**
 * Returns the help text for the CLI.
 */
export function getHelpText(): string {
  return `
${COLORS.bold}Shot Detection Test Runner${COLORS.reset}

Usage: npx tsx src/testing/run-tests.ts [options]

Options:
  --video <name>      Run test for a specific video only
  --test-data <path>  Path to test data directory (default: test-data)
  --output <path>     Path for JSON report (default: test-data/test-results.json)
  --help, -h          Show this help message

Examples:
  npx tsx src/testing/run-tests.ts
  npx tsx src/testing/run-tests.ts --video my-video
  npx tsx src/testing/run-tests.ts --test-data ./my-tests --output ./results.json
`;
}

// ============================================================================
// Exit Code Logic
// ============================================================================

/**
 * Determines the exit code based on test results.
 *
 * @param results - Array of comparison results
 * @returns 0 if all tests pass (or no tests), 1 if any test fails
 */
export function getExitCode(results: readonly ComparisonResult[]): number {
  // No tests is considered a pass (exit 0)
  if (results.length === 0) {
    return 0;
  }

  // Any failure means exit 1
  const hasFailure = results.some((r) => r.status === "fail");
  return hasFailure ? 1 : 0;
}
