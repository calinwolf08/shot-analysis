/**
 * Tests for reporting functions.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 * @see Task 9.3 - Reporting & CLI
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { formatConsoleOutput, formatFailureDetails, saveJsonReport, createTestReport, parseCliArgs, getHelpText, getExitCode, } from "./reporting";
// ============================================================================
// Test Helpers
// ============================================================================
/**
 * Creates a passing comparison result for testing.
 */
function createPassingResult(video = "test-video.mp4") {
    return {
        video,
        status: "pass",
        shots: [
            {
                shotNumber: 1,
                startFrame: { detected: 10, expected: 10, diff: 0, pass: true },
                endFrame: { detected: 50, expected: 50, diff: 0, pass: true },
                orientation: { detected: "front", expected: "front", match: true },
            },
        ],
    };
}
/**
 * Creates a failing comparison result for testing.
 */
function createFailingResult(video = "failing-video.mp4") {
    return {
        video,
        status: "fail",
        shots: [
            {
                shotNumber: 1,
                startFrame: { detected: 10, expected: 10, diff: 0, pass: true },
                endFrame: { detected: 60, expected: 50, diff: 10, pass: false },
                orientation: { detected: "front", expected: "front", match: true },
            },
        ],
        failureReason: "shot 1 end: diff 10 exceeds tolerance",
    };
}
/**
 * Creates a failing result with orientation mismatch (per-shot).
 */
function createOrientationMismatchResult(video = "orientation-mismatch.mp4") {
    return {
        video,
        status: "fail",
        shots: [
            {
                shotNumber: 1,
                startFrame: { detected: 10, expected: 10, diff: 0, pass: true },
                endFrame: { detected: 50, expected: 50, diff: 0, pass: true },
                orientation: { detected: "side-left", expected: "front", match: false },
            },
        ],
        failureReason: "shot 1 orientation: detected 'side-left', expected 'front'",
    };
}
/**
 * Creates a failing result with no shots detected.
 */
function createNoShotsResult(video = "no-shots.mp4") {
    return {
        video,
        status: "fail",
        shots: [],
        failureReason: "no shots detected",
    };
}
/**
 * Strips ANSI color codes from a string for easier testing.
 */
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, "");
}
// ============================================================================
// Tests: formatConsoleOutput
// ============================================================================
describe("formatConsoleOutput", () => {
    it("formats header with test data directory", () => {
        const result = formatConsoleOutput([], "my-test-data");
        expect(stripAnsi(result)).toContain("Shot Detection Test Runner");
        expect(stripAnsi(result)).toContain("Test data: my-test-data");
    });
    it("shows message when no test cases found", () => {
        const result = formatConsoleOutput([]);
        expect(stripAnsi(result)).toContain("No test cases found");
    });
    it("shows passing test with checkmark", () => {
        const passing = createPassingResult();
        const result = formatConsoleOutput([passing]);
        expect(stripAnsi(result)).toContain("test-video.mp4");
        expect(stripAnsi(result)).toContain("PASS");
        expect(result).toContain("\u2714"); // checkmark
    });
    it("shows failing test with X", () => {
        const failing = createFailingResult();
        const result = formatConsoleOutput([failing]);
        expect(stripAnsi(result)).toContain("failing-video.mp4");
        expect(stripAnsi(result)).toContain("FAIL");
        expect(result).toContain("\u2718"); // X
    });
    it("shows summary with total, passed, and failed counts", () => {
        const results = [createPassingResult(), createFailingResult()];
        const output = formatConsoleOutput(results);
        const stripped = stripAnsi(output);
        expect(stripped).toContain("Summary");
        expect(stripped).toContain("Total: 2");
        expect(stripped).toContain("Passed: 1");
        expect(stripped).toContain("Failed: 1");
        expect(stripped).toContain("50%");
    });
    it("shows 100% pass rate when all pass", () => {
        const results = [
            createPassingResult("video1.mp4"),
            createPassingResult("video2.mp4"),
        ];
        const output = formatConsoleOutput(results);
        const stripped = stripAnsi(output);
        expect(stripped).toContain("100%");
        expect(stripped).toContain("Passed: 2");
        expect(stripped).toContain("Failed: 0");
    });
    it("uses colors for pass/fail indicators", () => {
        const results = [createPassingResult(), createFailingResult()];
        const output = formatConsoleOutput(results);
        // Green for pass
        expect(output).toContain("\x1b[32m");
        // Red for fail
        expect(output).toContain("\x1b[31m");
    });
});
// ============================================================================
// Tests: formatFailureDetails
// ============================================================================
describe("formatFailureDetails", () => {
    it("returns empty string when no failures", () => {
        const results = [createPassingResult()];
        const output = formatFailureDetails(results);
        expect(output).toBe("");
    });
    it("shows failure details header", () => {
        const results = [createFailingResult()];
        const output = formatFailureDetails(results);
        expect(stripAnsi(output)).toContain("Failure Details");
    });
    it("shows video name for failing test", () => {
        const results = [createFailingResult("my-failing.mp4")];
        const output = formatFailureDetails(results);
        expect(stripAnsi(output)).toContain("my-failing.mp4");
    });
    it("shows frame differences for each shot", () => {
        const results = [createFailingResult()];
        const output = formatFailureDetails(results);
        const stripped = stripAnsi(output);
        expect(stripped).toContain("Shot 1");
        expect(stripped).toContain("Start:");
        expect(stripped).toContain("End:");
        expect(stripped).toContain("detected 60");
        expect(stripped).toContain("expected 50");
        expect(stripped).toContain("+10");
    });
    it("shows orientation mismatch", () => {
        const results = [createOrientationMismatchResult()];
        const output = formatFailureDetails(results);
        const stripped = stripAnsi(output);
        expect(stripped).toContain("Orientation:");
        expect(stripped).toContain("detected 'side-left'");
        expect(stripped).toContain("expected 'front'");
    });
    it("shows per-shot orientation in output", () => {
        const failing = createFailingResult();
        const output = formatFailureDetails([failing]);
        const stripped = stripAnsi(output);
        // Per-shot orientation is now shown as: "Orientation: detected 'X', expected 'Y' (match)"
        expect(stripped).toContain("Orientation:");
        expect(stripped).toContain("detected 'front'");
        expect(stripped).toContain("expected 'front'");
        expect(stripped).toContain("(match)");
    });
    it("shows failure reason when no shots detected", () => {
        const results = [createNoShotsResult()];
        const output = formatFailureDetails(results);
        expect(stripAnsi(output)).toContain("no shots detected");
    });
    it("shows multiple failures", () => {
        const results = [
            createFailingResult("fail1.mp4"),
            createFailingResult("fail2.mp4"),
        ];
        const output = formatFailureDetails(results);
        const stripped = stripAnsi(output);
        expect(stripped).toContain("fail1.mp4");
        expect(stripped).toContain("fail2.mp4");
    });
    it("only shows failures, not passes", () => {
        const results = [
            createPassingResult("pass.mp4"),
            createFailingResult("fail.mp4"),
        ];
        const output = formatFailureDetails(results);
        const stripped = stripAnsi(output);
        expect(stripped).not.toContain("pass.mp4");
        expect(stripped).toContain("fail.mp4");
    });
});
// ============================================================================
// Tests: createTestReport
// ============================================================================
describe("createTestReport", () => {
    it("creates report with current timestamp", () => {
        const before = new Date().toISOString();
        const report = createTestReport([]);
        const after = new Date().toISOString();
        expect(report.runAt >= before).toBe(true);
        expect(report.runAt <= after).toBe(true);
    });
    it("calculates correct summary", () => {
        const results = [
            createPassingResult(),
            createPassingResult(),
            createFailingResult(),
        ];
        const report = createTestReport(results);
        expect(report.summary.total).toBe(3);
        expect(report.summary.passed).toBe(2);
        expect(report.summary.failed).toBe(1);
    });
    it("includes tolerance config", () => {
        const report = createTestReport([]);
        expect(report.tolerance.frames).toBe(3);
        expect(report.tolerance.expandedTo).toBe(5);
    });
    it("includes all results", () => {
        const results = [createPassingResult(), createFailingResult()];
        const report = createTestReport(results);
        expect(report.results).toHaveLength(2);
        expect(report.results[0]).toEqual(results[0]);
        expect(report.results[1]).toEqual(results[1]);
    });
});
// ============================================================================
// Tests: saveJsonReport
// ============================================================================
describe("saveJsonReport", () => {
    const testDir = path.join(process.cwd(), "test-output-temp");
    const testFile = path.join(testDir, "test-results.json");
    beforeEach(() => {
        // Clean up before each test
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });
    afterEach(() => {
        // Clean up after each test
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });
    it("creates directory if it does not exist", () => {
        const results = [createPassingResult()];
        const result = saveJsonReport(results, testFile);
        expect(result.success).toBe(true);
        expect(fs.existsSync(testDir)).toBe(true);
    });
    it("writes pretty-printed JSON", () => {
        const results = [createPassingResult()];
        saveJsonReport(results, testFile);
        const content = fs.readFileSync(testFile, "utf-8");
        const parsed = JSON.parse(content);
        expect(parsed.summary.total).toBe(1);
        expect(parsed.summary.passed).toBe(1);
        expect(parsed.results).toHaveLength(1);
        // Check it's pretty-printed (has newlines and indentation)
        expect(content).toContain("\n");
        expect(content).toContain("  ");
    });
    it("returns success true on successful write", () => {
        const results = [createPassingResult()];
        const result = saveJsonReport(results, testFile);
        expect(result.success).toBe(true);
    });
    it("returns error on permission issues", () => {
        // Skip this test on systems where we can't create permission issues
        if (process.platform === "win32") {
            return;
        }
        // Create a read-only directory
        fs.mkdirSync(testDir, { recursive: true });
        fs.chmodSync(testDir, 0o444);
        const results = [createPassingResult()];
        const result = saveJsonReport(results, path.join(testDir, "subdir", "test.json"));
        // Restore permissions for cleanup
        fs.chmodSync(testDir, 0o755);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBeTruthy();
        }
    });
    it("handles absolute paths", () => {
        const results = [createPassingResult()];
        const absolutePath = path.join(testDir, "absolute-test.json");
        const result = saveJsonReport(results, absolutePath);
        expect(result.success).toBe(true);
        expect(fs.existsSync(absolutePath)).toBe(true);
    });
});
// ============================================================================
// Tests: parseCliArgs
// ============================================================================
describe("parseCliArgs", () => {
    it("returns defaults when no args provided", () => {
        const result = parseCliArgs([]);
        expect(result.video).toBeUndefined();
        expect(result.testDataDir).toBe("test-data");
        expect(result.outputPath).toBe("test-data/test-results.json");
        expect(result.help).toBe(false);
    });
    it("parses --video flag", () => {
        const result = parseCliArgs(["--video", "my-video"]);
        expect(result.video).toBe("my-video");
    });
    it("parses --test-data flag", () => {
        const result = parseCliArgs(["--test-data", "./my-tests"]);
        expect(result.testDataDir).toBe("./my-tests");
    });
    it("parses --output flag", () => {
        const result = parseCliArgs(["--output", "./results.json"]);
        expect(result.outputPath).toBe("./results.json");
    });
    it("parses --help flag", () => {
        const result = parseCliArgs(["--help"]);
        expect(result.help).toBe(true);
    });
    it("parses -h flag", () => {
        const result = parseCliArgs(["-h"]);
        expect(result.help).toBe(true);
    });
    it("parses multiple flags", () => {
        const result = parseCliArgs([
            "--video",
            "test",
            "--test-data",
            "./data",
            "--output",
            "./out.json",
        ]);
        expect(result.video).toBe("test");
        expect(result.testDataDir).toBe("./data");
        expect(result.outputPath).toBe("./out.json");
    });
    it("ignores unknown flags", () => {
        const result = parseCliArgs(["--unknown", "value"]);
        expect(result.video).toBeUndefined();
        expect(result.testDataDir).toBe("test-data");
    });
    it("handles missing value for --video", () => {
        const result = parseCliArgs(["--video"]);
        expect(result.video).toBeUndefined();
    });
});
// ============================================================================
// Tests: getHelpText
// ============================================================================
describe("getHelpText", () => {
    it("includes usage information", () => {
        const help = getHelpText();
        expect(help).toContain("Usage:");
    });
    it("includes --video option", () => {
        const help = getHelpText();
        expect(help).toContain("--video");
        expect(help).toContain("specific video");
    });
    it("includes --test-data option", () => {
        const help = getHelpText();
        expect(help).toContain("--test-data");
    });
    it("includes --output option", () => {
        const help = getHelpText();
        expect(help).toContain("--output");
    });
    it("includes examples", () => {
        const help = getHelpText();
        expect(help).toContain("Examples:");
    });
});
// ============================================================================
// Tests: getExitCode
// ============================================================================
describe("getExitCode", () => {
    it("returns 0 for empty results", () => {
        expect(getExitCode([])).toBe(0);
    });
    it("returns 0 when all tests pass", () => {
        const results = [createPassingResult(), createPassingResult()];
        expect(getExitCode(results)).toBe(0);
    });
    it("returns 1 when any test fails", () => {
        const results = [createPassingResult(), createFailingResult()];
        expect(getExitCode(results)).toBe(1);
    });
    it("returns 1 when all tests fail", () => {
        const results = [createFailingResult(), createFailingResult()];
        expect(getExitCode(results)).toBe(1);
    });
});
//# sourceMappingURL=reporting.test.js.map