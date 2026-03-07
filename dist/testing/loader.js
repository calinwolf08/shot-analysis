/**
 * Test case discovery and loading functions.
 *
 * This module provides functions to scan the test-data/ directory for valid
 * test cases and load their pose and label data.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { poseDataSchema, labelDataSchema, } from "./types";
// ============================================================================
// Constants
// ============================================================================
/** Default path to the test-data directory (relative to project root) */
const DEFAULT_TEST_DATA_DIR = "test-data";
/** Expected filename for pose data */
const POSES_FILENAME = "poses.json";
/** Expected filename for label data */
const LABELS_FILENAME = "labels.json";
/**
 * Loads and parses a poses.json file.
 *
 * @param filePath - Absolute path to the poses.json file
 * @returns Result with parsed PoseData or error message
 */
export function loadPoseData(filePath) {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
    }
    let content;
    try {
        content = fs.readFileSync(filePath, "utf-8");
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to read file: ${message}` };
    }
    // Parse JSON
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Invalid JSON: ${message}` };
    }
    // Validate with Zod schema
    const result = poseDataSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ");
        return { success: false, error: `Validation failed: ${issues}` };
    }
    // Check for empty frames array (warning condition)
    if (result.data.frames.length === 0) {
        console.warn(`Warning: ${filePath} has empty frames array`);
    }
    return { success: true, data: result.data };
}
/**
 * Loads and parses a labels.json file.
 *
 * @param filePath - Absolute path to the labels.json file
 * @returns Result with parsed LabelData or error message
 */
export function loadLabelData(filePath) {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
    }
    let content;
    try {
        content = fs.readFileSync(filePath, "utf-8");
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to read file: ${message}` };
    }
    // Parse JSON
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Invalid JSON: ${message}` };
    }
    // Validate with Zod schema
    const result = labelDataSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ");
        return { success: false, error: `Validation failed: ${issues}` };
    }
    return { success: true, data: result.data };
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
export function discoverTestCases(options = {}) {
    const { testDataDir = DEFAULT_TEST_DATA_DIR, createIfMissing = false } = options;
    const absoluteTestDataDir = path.isAbsolute(testDataDir)
        ? testDataDir
        : path.join(process.cwd(), testDataDir);
    const testCases = [];
    const skipped = [];
    const errors = [];
    // Check if test-data directory exists
    if (!fs.existsSync(absoluteTestDataDir)) {
        if (createIfMissing) {
            try {
                fs.mkdirSync(absoluteTestDataDir, { recursive: true });
                console.log(`Created test-data directory: ${absoluteTestDataDir}`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Failed to create test-data directory: ${message}`);
                return { testCases: [], skipped: [], errors: [] };
            }
        }
        else {
            console.log(`Test data directory not found: ${absoluteTestDataDir}`);
            return { testCases: [], skipped: [], errors: [] };
        }
    }
    // Read directory contents
    let entries;
    try {
        entries = fs.readdirSync(absoluteTestDataDir, { withFileTypes: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to read test-data directory: ${message}`);
        return { testCases: [], skipped: [], errors: [] };
    }
    // Filter to only directories
    const directories = entries.filter((entry) => entry.isDirectory());
    if (directories.length === 0) {
        console.log("No test case directories found in test-data/");
        return { testCases: [], skipped: [], errors: [] };
    }
    // Process each directory
    for (const dir of directories) {
        const dirPath = path.join(absoluteTestDataDir, dir.name);
        const posesPath = path.join(dirPath, POSES_FILENAME);
        const labelsPath = path.join(dirPath, LABELS_FILENAME);
        const posesExists = fs.existsSync(posesPath);
        const labelsExists = fs.existsSync(labelsPath);
        // Check for missing files
        if (!posesExists && !labelsExists) {
            skipped.push({ name: dir.name, reason: "missing-both" });
            continue;
        }
        if (!posesExists) {
            skipped.push({ name: dir.name, reason: "missing-poses" });
            continue;
        }
        if (!labelsExists) {
            skipped.push({ name: dir.name, reason: "missing-labels" });
            continue;
        }
        // Load pose data
        const poseResult = loadPoseData(posesPath);
        if (!poseResult.success) {
            errors.push({
                name: dir.name,
                file: "poses.json",
                error: poseResult.error,
            });
            continue;
        }
        // Load label data
        const labelResult = loadLabelData(labelsPath);
        if (!labelResult.success) {
            errors.push({
                name: dir.name,
                file: "labels.json",
                error: labelResult.error,
            });
            continue;
        }
        // Add valid test case
        testCases.push({
            name: dir.name,
            path: dirPath,
            poseData: poseResult.data,
            labelData: labelResult.data,
        });
    }
    return { testCases, skipped, errors };
}
/**
 * Reports discovery results to the console.
 *
 * @param result - Discovery result to report
 */
export function reportDiscoveryResults(result) {
    console.log("\n=== Test Case Discovery ===\n");
    // Report discovered test cases
    if (result.testCases.length > 0) {
        console.log(`Found ${result.testCases.length} valid test case(s):`);
        for (const testCase of result.testCases) {
            const shotCount = testCase.labelData.shots.length;
            const frameCount = testCase.poseData.frames.length;
            console.log(`  - ${testCase.name}: ${shotCount} shot(s), ${frameCount} frame(s)`);
        }
    }
    else {
        console.log("No valid test cases found.");
    }
    // Report skipped directories
    if (result.skipped.length > 0) {
        console.log(`\nSkipped ${result.skipped.length} directory(ies):`);
        for (const skip of result.skipped) {
            const reasonText = skip.reason === "missing-both"
                ? "missing poses.json and labels.json"
                : skip.reason === "missing-poses"
                    ? "missing poses.json"
                    : "missing labels.json";
            console.log(`  - ${skip.name}: ${reasonText}`);
        }
    }
    // Report errors
    if (result.errors.length > 0) {
        console.log(`\nEncountered ${result.errors.length} error(s):`);
        for (const err of result.errors) {
            console.log(`  - ${err.name}/${err.file}: ${err.error}`);
        }
    }
    console.log("");
}
//# sourceMappingURL=loader.js.map