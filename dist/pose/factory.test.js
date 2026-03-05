/**
 * Unit tests for Pose Detector Factory.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// Hoist mock functions to be available at mock definition time
const { mockCreateNodeDetector, mockCreateBrowserDetector } = vi.hoisted(() => ({
    mockCreateNodeDetector: vi.fn(),
    mockCreateBrowserDetector: vi.fn(),
}));
// Mock the implementation modules before importing factory
vi.mock("./mediapipe-node", () => ({
    createMediaPipeNodeDetector: mockCreateNodeDetector,
}));
vi.mock("./mediapipe-browser", () => ({
    createMediaPipeBrowserDetector: mockCreateBrowserDetector,
    RuntimeDelegate: {
        GPU: "GPU",
        CPU: "CPU",
    },
    WebGLFallbackBehavior: {
        AUTO: "AUTO",
        ERROR: "ERROR",
    },
}));
// Import after mocking
import { createPoseDetector, detectRuntime, UnknownRuntimeError, } from "./factory";
describe("Pose Detector Factory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Set up mock implementations for each test
        mockCreateNodeDetector.mockResolvedValue({
            detect: vi.fn(),
            close: vi.fn(),
        });
        mockCreateBrowserDetector.mockResolvedValue({
            detect: vi.fn(),
            close: vi.fn(),
        });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe("detectRuntime", () => {
        it("returns 'node' when window is undefined", () => {
            // In Node.js test environment, window is undefined
            expect(detectRuntime()).toBe("node");
        });
        it("returns 'browser' when window is defined", () => {
            const originalWindow = globalThis.window;
            // Mock window to simulate browser environment
            globalThis.window = {
                document: {},
            };
            try {
                expect(detectRuntime()).toBe("browser");
            }
            finally {
                // Restore original window state
                if (originalWindow === undefined) {
                    delete globalThis.window;
                }
                else {
                    globalThis.window =
                        originalWindow;
                }
            }
        });
        it("is a function", () => {
            expect(typeof detectRuntime).toBe("function");
        });
    });
    describe("createPoseDetector with auto runtime detection", () => {
        it("detects Node.js runtime and creates node detector when window is undefined", async () => {
            const detector = await createPoseDetector();
            expect(mockCreateNodeDetector).toHaveBeenCalled();
            expect(mockCreateBrowserDetector).not.toHaveBeenCalled();
            expect(detector).toBeDefined();
        });
        it("detects browser runtime and creates browser detector when window is defined", async () => {
            const originalWindow = globalThis.window;
            // Mock window to simulate browser environment
            globalThis.window = {
                document: {},
            };
            try {
                const detector = await createPoseDetector();
                expect(mockCreateBrowserDetector).toHaveBeenCalled();
                expect(mockCreateNodeDetector).not.toHaveBeenCalled();
                expect(detector).toBeDefined();
            }
            finally {
                if (originalWindow === undefined) {
                    delete globalThis.window;
                }
                else {
                    globalThis.window =
                        originalWindow;
                }
            }
        });
        it("auto-detects runtime when runtime option is 'auto'", async () => {
            // In Node.js test environment, should detect node
            const detector = await createPoseDetector({ runtime: "auto" });
            expect(mockCreateNodeDetector).toHaveBeenCalled();
            expect(detector).toBeDefined();
        });
        it("auto-detects runtime when runtime option is undefined", async () => {
            const detector = await createPoseDetector({});
            expect(mockCreateNodeDetector).toHaveBeenCalled();
            expect(detector).toBeDefined();
        });
    });
    describe("createPoseDetector with explicit runtime selection", () => {
        it("creates node detector when runtime is 'node'", async () => {
            const detector = await createPoseDetector({ runtime: "node" });
            expect(mockCreateNodeDetector).toHaveBeenCalled();
            expect(mockCreateBrowserDetector).not.toHaveBeenCalled();
            expect(detector).toBeDefined();
        });
        it("creates browser detector when runtime is 'browser'", async () => {
            const detector = await createPoseDetector({ runtime: "browser" });
            expect(mockCreateBrowserDetector).toHaveBeenCalled();
            expect(mockCreateNodeDetector).not.toHaveBeenCalled();
            expect(detector).toBeDefined();
        });
        it("explicit runtime overrides auto-detection in Node.js", async () => {
            // Even though we're in Node.js, explicitly request browser runtime
            const detector = await createPoseDetector({ runtime: "browser" });
            expect(mockCreateBrowserDetector).toHaveBeenCalled();
            expect(mockCreateNodeDetector).not.toHaveBeenCalled();
            expect(detector).toBeDefined();
        });
        it("explicit runtime overrides auto-detection in browser", async () => {
            const originalWindow = globalThis.window;
            // Mock window to simulate browser environment
            globalThis.window = {
                document: {},
            };
            try {
                // Even though we're in browser, explicitly request node runtime
                const detector = await createPoseDetector({ runtime: "node" });
                expect(mockCreateNodeDetector).toHaveBeenCalled();
                expect(mockCreateBrowserDetector).not.toHaveBeenCalled();
                expect(detector).toBeDefined();
            }
            finally {
                if (originalWindow === undefined) {
                    delete globalThis.window;
                }
                else {
                    globalThis.window =
                        originalWindow;
                }
            }
        });
    });
    describe("UnknownRuntimeError", () => {
        it("extends Error", () => {
            const error = new UnknownRuntimeError("invalid");
            expect(error).toBeInstanceOf(Error);
        });
        it("has correct name", () => {
            const error = new UnknownRuntimeError("invalid");
            expect(error.name).toBe("UnknownRuntimeError");
        });
        it("includes runtime in message", () => {
            const error = new UnknownRuntimeError("invalid");
            expect(error.message).toContain("invalid");
        });
        it("stores runtime property", () => {
            const error = new UnknownRuntimeError("invalid");
            expect(error.runtime).toBe("invalid");
        });
        it("provides descriptive error message", () => {
            const error = new UnknownRuntimeError("unknown");
            expect(error.message).toMatch(/unknown.*runtime/i);
        });
    });
    describe("configuration passthrough", () => {
        it("passes modelPath to node detector", async () => {
            await createPoseDetector({
                runtime: "node",
                modelPath: "/custom/model.task",
            });
            expect(mockCreateNodeDetector).toHaveBeenCalledWith(expect.objectContaining({
                modelPath: "/custom/model.task",
            }));
        });
        it("passes modelPath to browser detector", async () => {
            await createPoseDetector({
                runtime: "browser",
                modelPath: "/custom/model.task",
            });
            expect(mockCreateBrowserDetector).toHaveBeenCalledWith(expect.objectContaining({
                modelPath: "/custom/model.task",
            }));
        });
        it("passes modelComplexity to node detector", async () => {
            await createPoseDetector({
                runtime: "node",
                modelComplexity: 2,
            });
            expect(mockCreateNodeDetector).toHaveBeenCalledWith(expect.objectContaining({
                modelComplexity: 2,
            }));
        });
        it("passes modelComplexity to browser detector", async () => {
            await createPoseDetector({
                runtime: "browser",
                modelComplexity: 0,
            });
            expect(mockCreateBrowserDetector).toHaveBeenCalledWith(expect.objectContaining({
                modelComplexity: 0,
            }));
        });
        it("passes confidence values to node detector", async () => {
            await createPoseDetector({
                runtime: "node",
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.8,
                minPresenceConfidence: 0.6,
            });
            expect(mockCreateNodeDetector).toHaveBeenCalledWith(expect.objectContaining({
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.8,
                minPresenceConfidence: 0.6,
            }));
        });
        it("passes confidence values to browser detector", async () => {
            await createPoseDetector({
                runtime: "browser",
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.8,
                minPresenceConfidence: 0.6,
            });
            expect(mockCreateBrowserDetector).toHaveBeenCalledWith(expect.objectContaining({
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.8,
                minPresenceConfidence: 0.6,
            }));
        });
        it("passes runningMode to browser detector", async () => {
            await createPoseDetector({
                runtime: "browser",
                runningMode: "VIDEO",
            });
            expect(mockCreateBrowserDetector).toHaveBeenCalledWith(expect.objectContaining({
                runningMode: "VIDEO",
            }));
        });
        it("passes delegate to browser detector", async () => {
            await createPoseDetector({
                runtime: "browser",
                delegate: "GPU",
            });
            expect(mockCreateBrowserDetector).toHaveBeenCalledWith(expect.objectContaining({
                delegate: "GPU",
            }));
        });
        it("passes webglFallback to browser detector", async () => {
            await createPoseDetector({
                runtime: "browser",
                webglFallback: "ERROR",
            });
            expect(mockCreateBrowserDetector).toHaveBeenCalledWith(expect.objectContaining({
                webglFallback: "ERROR",
            }));
        });
        it("does not pass browser-specific options to node detector", async () => {
            await createPoseDetector({
                runtime: "node",
                runningMode: "VIDEO",
                delegate: "GPU",
                webglFallback: "ERROR",
            });
            const call = mockCreateNodeDetector.mock.calls[0]?.[0];
            expect(call).not.toHaveProperty("runningMode");
            expect(call).not.toHaveProperty("delegate");
            expect(call).not.toHaveProperty("webglFallback");
        });
    });
    describe("initialization errors", () => {
        it("propagates errors from node detector creation", async () => {
            const testError = new Error("Node initialization failed");
            mockCreateNodeDetector.mockRejectedValueOnce(testError);
            await expect(createPoseDetector({ runtime: "node" })).rejects.toThrow("Node initialization failed");
        });
        it("propagates errors from browser detector creation", async () => {
            const testError = new Error("Browser initialization failed");
            mockCreateBrowserDetector.mockRejectedValueOnce(testError);
            await expect(createPoseDetector({ runtime: "browser" })).rejects.toThrow("Browser initialization failed");
        });
    });
    describe("multiple createPoseDetector calls", () => {
        it("creates independent detector instances", async () => {
            const mockDetector1 = { detect: vi.fn(), close: vi.fn() };
            const mockDetector2 = { detect: vi.fn(), close: vi.fn() };
            mockCreateNodeDetector
                .mockResolvedValueOnce(mockDetector1)
                .mockResolvedValueOnce(mockDetector2);
            const detector1 = await createPoseDetector({ runtime: "node" });
            const detector2 = await createPoseDetector({ runtime: "node" });
            expect(detector1).toBe(mockDetector1);
            expect(detector2).toBe(mockDetector2);
            expect(detector1).not.toBe(detector2);
        });
        it("can create both node and browser detectors in same process", async () => {
            const newNodeDetector = { detect: vi.fn(), close: vi.fn() };
            const newBrowserDetector = { detect: vi.fn(), close: vi.fn() };
            mockCreateNodeDetector.mockResolvedValueOnce(newNodeDetector);
            mockCreateBrowserDetector.mockResolvedValueOnce(newBrowserDetector);
            const nodeDetector = await createPoseDetector({ runtime: "node" });
            const browserDetector = await createPoseDetector({ runtime: "browser" });
            expect(nodeDetector).toBe(newNodeDetector);
            expect(browserDetector).toBe(newBrowserDetector);
            expect(mockCreateNodeDetector).toHaveBeenCalledTimes(1);
            expect(mockCreateBrowserDetector).toHaveBeenCalledTimes(1);
        });
    });
    describe("PoseDetectorConfig type", () => {
        it("allows minimal configuration", async () => {
            const config = {};
            const detector = await createPoseDetector(config);
            expect(detector).toBeDefined();
        });
        it("accepts all optional properties", () => {
            const config = {
                runtime: "browser",
                modelPath: "/custom/path.task",
                modelComplexity: 2,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                minPresenceConfidence: 0.5,
                runningMode: "VIDEO",
                delegate: "GPU",
                webglFallback: "AUTO",
            };
            expect(config.runtime).toBeDefined();
            expect(config.modelPath).toBeDefined();
            expect(config.modelComplexity).toBeDefined();
            expect(config.minDetectionConfidence).toBeDefined();
            expect(config.minTrackingConfidence).toBeDefined();
            expect(config.minPresenceConfidence).toBeDefined();
            expect(config.runningMode).toBeDefined();
            expect(config.delegate).toBeDefined();
            expect(config.webglFallback).toBeDefined();
        });
    });
});
//# sourceMappingURL=factory.test.js.map