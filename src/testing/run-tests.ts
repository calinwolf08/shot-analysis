#!/usr/bin/env node
/**
 * CLI entry point for the test runner.
 *
 * Discovers test cases, runs detection, compares against labels,
 * and outputs results to console and JSON report.
 *
 * Usage:
 *   npx tsx src/testing/run-tests.ts [options]
 *
 * Options:
 *   --video <name>      Run test for a specific video only
 *   --test-data <path>  Path to test data directory (default: test-data)
 *   --output <path>     Path for JSON report (default: test-data/test-results.json)
 *   --help, -h          Show help message
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 * @see Task 9.3 - Reporting & CLI
 */

import { discoverTestCases } from "./loader";
import { runAndCompare, type ComparisonResult } from "./detection";
import {
  parseCliArgs,
  getHelpText,
  formatConsoleOutput,
  formatFailureDetails,
  saveJsonReport,
  getExitCode,
} from "./reporting";

// ANSI codes for inline use
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
} as const;

/**
 * Main entry point for the test runner CLI.
 */
async function main(): Promise<void> {
  // Parse command-line arguments
  const args = parseCliArgs();

  // Show help if requested
  if (args.help) {
    console.log(getHelpText());
    process.exit(0);
  }

  // Discover test cases
  const discovery = discoverTestCases({ testDataDir: args.testDataDir });

  // Handle no test cases found
  if (discovery.testCases.length === 0) {
    console.log(formatConsoleOutput([], args.testDataDir));

    if (discovery.errors.length > 0) {
      console.log(`\n${COLORS.red}Errors during discovery:${COLORS.reset}`);
      for (const err of discovery.errors) {
        console.log(`  - ${err.name}/${err.file}: ${err.error}`);
      }
    }

    // Exit 0 for no tests (as per requirements)
    process.exit(0);
  }

  // Filter to specific video(s) if --video or --videos flag provided
  let testCases = [...discovery.testCases];

  if (args.video) {
    // Single video filter
    const videoFilter = args.video;
    testCases = testCases.filter(
      (tc) =>
        tc.name === videoFilter ||
        tc.name.includes(videoFilter) ||
        tc.labelData.video === videoFilter ||
        tc.labelData.video.includes(videoFilter),
    );

    if (testCases.length === 0) {
      console.log(
        `${COLORS.red}Error: No test case found matching '${args.video}'${COLORS.reset}`,
      );
      console.log(
        `\nAvailable test cases: ${discovery.testCases.map((tc) => tc.name).join(", ")}`,
      );
      process.exit(1);
    }
  } else if (args.videos && args.videos.length > 0) {
    // Multiple video filter (comma-separated patterns)
    const videoFilters = args.videos;
    testCases = testCases.filter((tc) =>
      videoFilters.some(
        (filter) =>
          tc.name === filter ||
          tc.name.includes(filter) ||
          tc.labelData.video === filter ||
          tc.labelData.video.includes(filter),
      ),
    );

    if (testCases.length === 0) {
      console.log(
        `${COLORS.red}Error: No test cases found matching any of: ${videoFilters.join(", ")}${COLORS.reset}`,
      );
      console.log(
        `\nAvailable test cases: ${discovery.testCases.map((tc) => tc.name).join(", ")}`,
      );
      process.exit(1);
    }
  }

  // Run detection and comparison for each test case
  const results: ComparisonResult[] = [];
  for (const testCase of testCases) {
    const result = runAndCompare(testCase.poseData, testCase.labelData);
    results.push(result);
  }

  // Format and display console output
  console.log(formatConsoleOutput(results, args.testDataDir));

  // Show failure details if any
  const failureDetails = formatFailureDetails(results);
  if (failureDetails) {
    console.log(failureDetails);
  }

  // Save JSON report
  const saveResult = saveJsonReport(results, args.outputPath);
  if (saveResult.success) {
    console.log(`\nJSON report saved to: ${args.outputPath}`);
  } else {
    console.log(
      `\n${COLORS.yellow}Warning: Failed to save JSON report: ${saveResult.error}${COLORS.reset}`,
    );
  }

  // Exit with appropriate code
  const exitCode = getExitCode(results);
  process.exit(exitCode);
}

// Run main
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
