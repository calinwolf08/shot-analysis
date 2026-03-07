/**
 * Unit tests for testing/loader.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import { loadPoseData, loadLabelData, discoverTestCases, reportDiscoveryResults, } from "./loader";
// Mock fs module
vi.mock("node:fs");
const mockFs = vi.mocked(fs);
/** Helper to create a mock Dirent entry */
function createMockDirent(name, isDir) {
    return {
        name,
        isDirectory: () => isDir,
        isFile: () => !isDir,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
        parentPath: "/test-data",
        path: "/test-data",
    };
}
describe("loadPoseData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns error when file does not exist", () => {
        mockFs.existsSync.mockReturnValue(false);
        const result = loadPoseData("/path/to/poses.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("File not found");
        }
    });
    it("returns error for invalid JSON", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue("{ invalid json }");
        const result = loadPoseData("/path/to/poses.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("Invalid JSON");
        }
    });
    it("returns error for schema validation failure", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({
            video: "test.mp4",
            // Missing required fields
        }));
        const result = loadPoseData("/path/to/poses.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("Validation failed");
        }
    });
    it("successfully parses valid pose data", () => {
        const validPoseData = {
            video: "test.mp4",
            fps: 30,
            totalFrames: 100,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [
                {
                    frameIndex: 0,
                    timestamp: 0.0,
                    poseConfidence: 0.95,
                    landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }],
                },
            ],
        };
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(validPoseData));
        const result = loadPoseData("/path/to/poses.json");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.video).toBe("test.mp4");
            expect(result.data.fps).toBe(30);
            expect(result.data.frames.length).toBe(1);
        }
    });
    it("warns for empty frames array", () => {
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => { });
        const poseDataWithEmptyFrames = {
            video: "test.mp4",
            fps: 30,
            totalFrames: 0,
            width: 1920,
            height: 1080,
            extractedAt: "2024-01-01T00:00:00Z",
            frames: [],
        };
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(poseDataWithEmptyFrames));
        const result = loadPoseData("/path/to/poses.json");
        expect(result.success).toBe(true);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("empty frames array"));
        consoleWarnSpy.mockRestore();
    });
    it("returns error when file read fails", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation(() => {
            throw new Error("Permission denied");
        });
        const result = loadPoseData("/path/to/poses.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("Failed to read file");
            expect(result.error).toContain("Permission denied");
        }
    });
});
describe("loadLabelData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns error when file does not exist", () => {
        mockFs.existsSync.mockReturnValue(false);
        const result = loadLabelData("/path/to/labels.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("File not found");
        }
    });
    it("returns error for invalid JSON", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue("not valid json");
        const result = loadLabelData("/path/to/labels.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("Invalid JSON");
        }
    });
    it("returns error for invalid orientation", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({
            video: "test.mp4",
            labeledBy: "tester",
            labeledAt: "2024-01-01T00:00:00Z",
            orientation: "invalid-orientation",
            shots: [],
        }));
        const result = loadLabelData("/path/to/labels.json");
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("Validation failed");
        }
    });
    it("successfully parses valid label data", () => {
        const validLabelData = {
            video: "test.mp4",
            labeledBy: "tester",
            labeledAt: "2024-01-01T00:00:00Z",
            orientation: "front",
            shots: [{ shotNumber: 1, startFrame: 10, endFrame: 50 }],
        };
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(validLabelData));
        const result = loadLabelData("/path/to/labels.json");
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.video).toBe("test.mp4");
            expect(result.data.orientation).toBe("front");
            expect(result.data.shots.length).toBe(1);
        }
    });
});
describe("discoverTestCases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns empty result when test-data directory does not exist", () => {
        mockFs.existsSync.mockReturnValue(false);
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const result = discoverTestCases({ testDataDir: "/nonexistent" });
        expect(result.testCases).toHaveLength(0);
        expect(result.skipped).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
        consoleLogSpy.mockRestore();
    });
    it("creates test-data directory when createIfMissing is true", () => {
        mockFs.existsSync.mockReturnValueOnce(false).mockReturnValue(true);
        mockFs.mkdirSync.mockReturnValue(undefined);
        mockFs.readdirSync.mockReturnValue([]);
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        discoverTestCases({
            testDataDir: "/new-test-data",
            createIfMissing: true,
        });
        expect(mockFs.mkdirSync).toHaveBeenCalledWith("/new-test-data", {
            recursive: true,
        });
        consoleLogSpy.mockRestore();
    });
    it("returns empty result when no directories exist", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([]);
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const result = discoverTestCases();
        expect(result.testCases).toHaveLength(0);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No test case directories"));
        consoleLogSpy.mockRestore();
    });
    it("skips directories missing poses.json", () => {
        mockFs.existsSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.endsWith("test-data"))
                return true;
            if (pathStr.includes("poses.json"))
                return false;
            if (pathStr.includes("labels.json"))
                return true;
            return true;
        });
        mockFs.readdirSync.mockReturnValue([createMockDirent("test-case-1", true)]);
        const result = discoverTestCases({ testDataDir: "/test-data" });
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0]?.reason).toBe("missing-poses");
    });
    it("skips directories missing labels.json", () => {
        mockFs.existsSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.endsWith("test-data"))
                return true;
            if (pathStr.includes("poses.json"))
                return true;
            if (pathStr.includes("labels.json"))
                return false;
            return true;
        });
        mockFs.readdirSync.mockReturnValue([createMockDirent("test-case-1", true)]);
        const result = discoverTestCases({ testDataDir: "/test-data" });
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0]?.reason).toBe("missing-labels");
    });
    it("skips directories missing both files", () => {
        mockFs.existsSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.endsWith("test-data"))
                return true;
            return false;
        });
        mockFs.readdirSync.mockReturnValue([createMockDirent("empty-dir", true)]);
        const result = discoverTestCases({ testDataDir: "/test-data" });
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0]?.reason).toBe("missing-both");
    });
    it("reports error for malformed poses.json", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([createMockDirent("bad-poses", true)]);
        mockFs.readFileSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.includes("poses.json")) {
                return "invalid json";
            }
            return JSON.stringify({
                video: "test.mp4",
                labeledBy: "tester",
                labeledAt: "2024-01-01T00:00:00Z",
                orientation: "front",
                shots: [],
            });
        });
        const result = discoverTestCases({ testDataDir: "/test-data" });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.file).toBe("poses.json");
    });
    it("reports error for malformed labels.json", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([createMockDirent("bad-labels", true)]);
        mockFs.readFileSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.includes("poses.json")) {
                return JSON.stringify({
                    video: "test.mp4",
                    fps: 30,
                    totalFrames: 100,
                    width: 1920,
                    height: 1080,
                    extractedAt: "2024-01-01T00:00:00Z",
                    frames: [],
                });
            }
            return "invalid json";
        });
        // Suppress console.warn for empty frames
        vi.spyOn(console, "warn").mockImplementation(() => { });
        const result = discoverTestCases({ testDataDir: "/test-data" });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.file).toBe("labels.json");
    });
    it("successfully discovers valid test cases", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([createMockDirent("valid-case", true)]);
        mockFs.readFileSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.includes("poses.json")) {
                return JSON.stringify({
                    video: "test.mp4",
                    fps: 30,
                    totalFrames: 100,
                    width: 1920,
                    height: 1080,
                    extractedAt: "2024-01-01T00:00:00Z",
                    frames: [
                        {
                            frameIndex: 0,
                            timestamp: 0.0,
                            poseConfidence: 0.95,
                            landmarks: [],
                        },
                    ],
                });
            }
            return JSON.stringify({
                video: "test.mp4",
                labeledBy: "tester",
                labeledAt: "2024-01-01T00:00:00Z",
                orientation: "front",
                shots: [{ shotNumber: 1, startFrame: 10, endFrame: 50 }],
            });
        });
        const result = discoverTestCases({ testDataDir: "/test-data" });
        expect(result.testCases).toHaveLength(1);
        expect(result.testCases[0]?.name).toBe("valid-case");
        expect(result.testCases[0]?.poseData.fps).toBe(30);
        expect(result.testCases[0]?.labelData.shots.length).toBe(1);
    });
    it("filters out non-directory entries", () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([
            createMockDirent("file.txt", false),
            createMockDirent("valid-case", true),
        ]);
        mockFs.readFileSync.mockImplementation((p) => {
            const pathStr = String(p);
            if (pathStr.includes("poses.json")) {
                return JSON.stringify({
                    video: "test.mp4",
                    fps: 30,
                    totalFrames: 100,
                    width: 1920,
                    height: 1080,
                    extractedAt: "2024-01-01T00:00:00Z",
                    frames: [],
                });
            }
            return JSON.stringify({
                video: "test.mp4",
                labeledBy: "tester",
                labeledAt: "2024-01-01T00:00:00Z",
                orientation: "front",
                shots: [],
            });
        });
        // Suppress console.warn for empty frames
        vi.spyOn(console, "warn").mockImplementation(() => { });
        const result = discoverTestCases({ testDataDir: "/test-data" });
        // Should only have one test case (the directory)
        expect(result.testCases).toHaveLength(1);
    });
});
describe("reportDiscoveryResults", () => {
    it("reports discovered test cases", () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const result = {
            testCases: [
                {
                    name: "test-1",
                    path: "/test-data/test-1",
                    poseData: {
                        video: "test.mp4",
                        fps: 30,
                        totalFrames: 100,
                        width: 1920,
                        height: 1080,
                        extractedAt: "2024-01-01T00:00:00Z",
                        frames: [
                            {
                                frameIndex: 0,
                                timestamp: 0,
                                poseConfidence: 0.9,
                                landmarks: [],
                            },
                        ],
                    },
                    labelData: {
                        video: "test.mp4",
                        labeledBy: "tester",
                        labeledAt: "2024-01-01T00:00:00Z",
                        orientation: "front",
                        shots: [{ shotNumber: 1, startFrame: 10, endFrame: 50 }],
                    },
                },
            ],
            skipped: [],
            errors: [],
        };
        reportDiscoveryResults(result);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("1 valid test case"));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("test-1"));
        consoleLogSpy.mockRestore();
    });
    it("reports skipped directories", () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const result = {
            testCases: [],
            skipped: [
                { name: "skip-1", reason: "missing-poses" },
                { name: "skip-2", reason: "missing-labels" },
                { name: "skip-3", reason: "missing-both" },
            ],
            errors: [],
        };
        reportDiscoveryResults(result);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Skipped 3"));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("missing poses.json"));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("missing labels.json"));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("missing poses.json and labels.json"));
        consoleLogSpy.mockRestore();
    });
    it("reports errors", () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const result = {
            testCases: [],
            skipped: [],
            errors: [{ name: "error-1", file: "poses.json", error: "Parse error" }],
        };
        reportDiscoveryResults(result);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("1 error"));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("error-1/poses.json"));
        consoleLogSpy.mockRestore();
    });
    it("reports when no valid test cases found", () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => { });
        const result = {
            testCases: [],
            skipped: [],
            errors: [],
        };
        reportDiscoveryResults(result);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No valid test cases"));
        consoleLogSpy.mockRestore();
    });
});
//# sourceMappingURL=loader.test.js.map