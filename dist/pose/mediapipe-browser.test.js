/**
 * Unit tests for MediaPipeBrowserDetector.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DetectorClosedError, PoseDetectionError } from "./detector";
import { TOTAL_LANDMARKS } from "./types";
// Mock ImageData for Node.js environment (browser API not available in tests)
class MockImageData {
    data;
    width;
    height;
    colorSpace = "srgb";
    constructor(dataOrWidth, widthOrHeight, height) {
        if (typeof dataOrWidth === "number") {
            // Constructor: new ImageData(width, height)
            this.width = dataOrWidth;
            this.height = widthOrHeight;
            this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
        else {
            // Constructor: new ImageData(data, width, height?)
            this.data = dataOrWidth;
            this.width = widthOrHeight;
            this.height = height ?? dataOrWidth.length / (widthOrHeight * 4);
        }
    }
}
// Set up global ImageData mock before any imports that might use it
globalThis.ImageData =
    MockImageData;
// Mock @mediapipe/tasks-vision
vi.mock("@mediapipe/tasks-vision", () => {
    const mockLandmarker = {
        detect: vi.fn(),
        detectForVideo: vi.fn(),
        close: vi.fn(),
    };
    return {
        FilesetResolver: {
            forVisionTasks: vi.fn().mockResolvedValue({}),
        },
        PoseLandmarker: {
            createFromOptions: vi.fn().mockResolvedValue(mockLandmarker),
        },
    };
});
// Import after mocking
import { WebGLNotAvailableError, WebGLFallbackBehavior, createMediaPipeBrowserDetector, detectWebGLSupport, RuntimeDelegate, } from "./mediapipe-browser";
import { ModelNotFoundError, WasmInitializationError, ModelCreationError, DEFAULT_MODEL_PATH, MODEL_PATHS, } from "./mediapipe-node";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
describe("MediaPipeBrowserDetector", () => {
    let mockLandmarker;
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup fresh mock landmarker for each test
        mockLandmarker = {
            detect: vi.fn(),
            detectForVideo: vi.fn(),
            close: vi.fn(),
        };
        vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockLandmarker);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe("constructor and configuration", () => {
        it("createMediaPipeBrowserDetector returns a PoseDetector", async () => {
            const detector = await createMediaPipeBrowserDetector();
            expect(detector).toBeDefined();
            expect(typeof detector.detect).toBe("function");
            expect(typeof detector.close).toBe("function");
            await detector.close();
        });
        it("uses default configuration when no options provided", async () => {
            await createMediaPipeBrowserDetector();
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            expect(calls.length).toBe(1);
            const options = calls[0]?.[1];
            expect(options).toMatchObject({
                baseOptions: {
                    modelAssetPath: DEFAULT_MODEL_PATH,
                },
                numPoses: 1,
                runningMode: "IMAGE",
            });
        });
        it("accepts custom modelPath", async () => {
            const customPath = "/custom/model.task";
            await createMediaPipeBrowserDetector({ modelPath: customPath });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.baseOptions?.modelAssetPath).toBe(customPath);
        });
        it("accepts modelComplexity 0 (lite) and selects lite model", async () => {
            await createMediaPipeBrowserDetector({ modelComplexity: 0 });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[0]);
        });
        it("accepts modelComplexity 1 (full) and selects full model", async () => {
            await createMediaPipeBrowserDetector({ modelComplexity: 1 });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[1]);
        });
        it("accepts modelComplexity 2 (heavy) and selects heavy model", async () => {
            await createMediaPipeBrowserDetector({ modelComplexity: 2 });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.baseOptions?.modelAssetPath).toBe(MODEL_PATHS[2]);
        });
        it("custom modelPath overrides modelComplexity", async () => {
            const customPath = "/custom/model.task";
            await createMediaPipeBrowserDetector({
                modelPath: customPath,
                modelComplexity: 2,
            });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.baseOptions?.modelAssetPath).toBe(customPath);
        });
        it("accepts custom confidence values", async () => {
            await createMediaPipeBrowserDetector({
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.8,
                minPresenceConfidence: 0.6,
            });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options).toMatchObject({
                minPoseDetectionConfidence: 0.7,
                minTrackingConfidence: 0.8,
                minPosePresenceConfidence: 0.6,
            });
        });
        it("uses default confidence values when not specified", async () => {
            await createMediaPipeBrowserDetector();
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options).toMatchObject({
                minPoseDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                minPosePresenceConfidence: 0.5,
            });
        });
        it("accepts VIDEO running mode for real-time processing", async () => {
            await createMediaPipeBrowserDetector({ runningMode: "VIDEO" });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.runningMode).toBe("VIDEO");
        });
        it("defaults to IMAGE running mode", async () => {
            await createMediaPipeBrowserDetector();
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.runningMode).toBe("IMAGE");
        });
    });
    describe("detect() method", () => {
        const createMockFrame = (width = 640, height = 480) => ({
            data: new Uint8ClampedArray(width * height * 4),
            width,
            height,
            timestamp: 0,
            frameIndex: 0,
        });
        const createMockLandmarks = () => Array.from({ length: TOTAL_LANDMARKS }, (_, i) => ({
            x: i / TOTAL_LANDMARKS,
            y: i / TOTAL_LANDMARKS,
            z: 0.1,
            visibility: 0.95,
        }));
        it("returns null when no pose detected", async () => {
            mockLandmarker.detect.mockReturnValue({
                landmarks: [],
                worldLandmarks: [],
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            expect(result).toBeNull();
            await detector.close();
        });
        it("returns PoseLandmarks when pose detected", async () => {
            const mockLandmarks = createMockLandmarks();
            mockLandmarker.detect.mockReturnValue({
                landmarks: [mockLandmarks],
                worldLandmarks: [mockLandmarks],
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            expect(result).not.toBeNull();
            expect(result?.landmarks).toHaveLength(TOTAL_LANDMARKS);
            expect(result?.poseConfidence).toBeGreaterThan(0);
            await detector.close();
        });
        it("maps landmark properties correctly", async () => {
            const mockLandmarks = [
                { x: 0.5, y: 0.6, z: 0.1, visibility: 0.9 },
                ...Array.from({ length: TOTAL_LANDMARKS - 1 }, () => ({
                    x: 0,
                    y: 0,
                    z: 0,
                    visibility: 0,
                })),
            ];
            mockLandmarker.detect.mockReturnValue({
                landmarks: [mockLandmarks],
                worldLandmarks: [mockLandmarks],
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            expect(result?.landmarks[0]).toEqual({
                x: 0.5,
                y: 0.6,
                z: 0.1,
                visibility: 0.9,
                confidence: 0.9,
            });
            await detector.close();
        });
        it("throws DetectorClosedError when detect called after close", async () => {
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame();
            await detector.close();
            await expect(detector.detect(frame)).rejects.toThrow(DetectorClosedError);
        });
        it("passes ImageData to MediaPipe landmarker", async () => {
            mockLandmarker.detect.mockReturnValue({
                landmarks: [],
                worldLandmarks: [],
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame(100, 100);
            await detector.detect(frame);
            expect(mockLandmarker.detect).toHaveBeenCalledWith(expect.objectContaining({
                width: 100,
                height: 100,
            }));
            await detector.close();
        });
        it("handles MediaPipe errors gracefully", async () => {
            mockLandmarker.detect.mockImplementation(() => {
                throw new Error("MediaPipe internal error");
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame();
            await expect(detector.detect(frame)).rejects.toThrow(PoseDetectionError);
            await detector.close();
        });
        it("uses first pose when multiple detected", async () => {
            const mockLandmarks1 = createMockLandmarks();
            const mockLandmarks2 = createMockLandmarks();
            mockLandmarker.detect.mockReturnValue({
                landmarks: [mockLandmarks1, mockLandmarks2],
                worldLandmarks: [mockLandmarks1, mockLandmarks2],
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = createMockFrame();
            const result = await detector.detect(frame);
            expect(result).not.toBeNull();
            expect(result?.landmarks[0]?.x).toBe(mockLandmarks1[0]?.x);
            await detector.close();
        });
        it("uses detectForVideo when in VIDEO mode with timestamp", async () => {
            const mockLandmarks = createMockLandmarks();
            mockLandmarker.detectForVideo.mockReturnValue({
                landmarks: [mockLandmarks],
                worldLandmarks: [mockLandmarks],
            });
            const detector = await createMediaPipeBrowserDetector({
                runningMode: "VIDEO",
            });
            const frame = {
                data: new Uint8ClampedArray(4),
                width: 1,
                height: 1,
                timestamp: 1000,
                frameIndex: 0,
            };
            await detector.detect(frame);
            expect(mockLandmarker.detectForVideo).toHaveBeenCalled();
            await detector.close();
        });
    });
    describe("close() method", () => {
        it("releases MediaPipe resources", async () => {
            const detector = await createMediaPipeBrowserDetector();
            await detector.close();
            expect(mockLandmarker.close).toHaveBeenCalledTimes(1);
        });
        it("throws DetectorClosedError when closed twice", async () => {
            const detector = await createMediaPipeBrowserDetector();
            await detector.close();
            await expect(detector.close()).rejects.toThrow(DetectorClosedError);
        });
        it("can be called after detect", async () => {
            mockLandmarker.detect.mockReturnValue({
                landmarks: [],
                worldLandmarks: [],
            });
            const detector = await createMediaPipeBrowserDetector();
            const frame = {
                data: new Uint8ClampedArray(4),
                width: 1,
                height: 1,
                timestamp: 0,
                frameIndex: 0,
            };
            await detector.detect(frame);
            await detector.close();
            expect(mockLandmarker.close).toHaveBeenCalled();
        });
    });
    describe("initialization errors", () => {
        it("throws ModelNotFoundError when model file not found (404)", async () => {
            vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(new Error("Failed to load: 404 Not Found"));
            await expect(createMediaPipeBrowserDetector({
                modelPath: "/nonexistent/model.task",
            })).rejects.toThrow(ModelNotFoundError);
        });
        it("throws ModelNotFoundError when fetch fails", async () => {
            vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(new Error("Failed to fetch model"));
            await expect(createMediaPipeBrowserDetector({
                modelPath: "/nonexistent/model.task",
            })).rejects.toThrow(ModelNotFoundError);
        });
        it("throws WasmInitializationError for WASM loading failures", async () => {
            vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValue(new Error("WASM loading failed"));
            await expect(createMediaPipeBrowserDetector()).rejects.toThrow(WasmInitializationError);
        });
        it("WasmInitializationError contains original error", async () => {
            const originalError = new Error("WASM loading failed");
            vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValue(originalError);
            try {
                await createMediaPipeBrowserDetector();
                expect.fail("Should have thrown WasmInitializationError");
            }
            catch (error) {
                expect(error).toBeInstanceOf(WasmInitializationError);
                expect(error.originalError).toBe(originalError);
            }
        });
        it("throws ModelCreationError for other model creation failures", async () => {
            vi.mocked(PoseLandmarker.createFromOptions).mockRejectedValue(new Error("Invalid configuration"));
            await expect(createMediaPipeBrowserDetector()).rejects.toThrow(ModelCreationError);
        });
    });
    describe("WebGLNotAvailableError", () => {
        it("extends Error", () => {
            const error = new WebGLNotAvailableError();
            expect(error).toBeInstanceOf(Error);
        });
        it("has correct name", () => {
            const error = new WebGLNotAvailableError();
            expect(error.name).toBe("WebGLNotAvailableError");
        });
        it("has descriptive message", () => {
            const error = new WebGLNotAvailableError();
            expect(error.message).toContain("WebGL");
        });
    });
    describe("RuntimeDelegate enum", () => {
        it("exports GPU delegate value", () => {
            expect(RuntimeDelegate.GPU).toBeDefined();
        });
        it("exports CPU delegate value", () => {
            expect(RuntimeDelegate.CPU).toBeDefined();
        });
    });
    describe("detectWebGLSupport", () => {
        it("is a function", () => {
            expect(typeof detectWebGLSupport).toBe("function");
        });
        it("returns false when document is not defined", () => {
            // In Node.js test environment, document is not defined
            expect(detectWebGLSupport()).toBe(false);
        });
    });
    describe("MediaPipeBrowserConfig type", () => {
        it("allows partial configuration", async () => {
            const config = {};
            const detector = await createMediaPipeBrowserDetector(config);
            await detector.close();
        });
        it("accepts all optional properties", () => {
            const config = {
                modelPath: "/custom/path.task",
                modelComplexity: 2,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                minPresenceConfidence: 0.5,
                runningMode: "VIDEO",
                delegate: RuntimeDelegate.GPU,
            };
            expect(config.modelPath).toBeDefined();
            expect(config.modelComplexity).toBeDefined();
            expect(config.minDetectionConfidence).toBeDefined();
            expect(config.minTrackingConfidence).toBeDefined();
            expect(config.minPresenceConfidence).toBeDefined();
            expect(config.runningMode).toBeDefined();
            expect(config.delegate).toBeDefined();
        });
    });
    describe("runtime delegate configuration", () => {
        it("accepts CPU delegate preference", async () => {
            await createMediaPipeBrowserDetector({ delegate: RuntimeDelegate.CPU });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            expect(options?.baseOptions?.delegate).toBe("CPU");
        });
        it("falls back to CPU delegate when GPU requested but WebGL unavailable (AUTO mode)", async () => {
            // In Node.js test environment, document is undefined so WebGL is unavailable
            await createMediaPipeBrowserDetector({
                delegate: RuntimeDelegate.GPU,
                webglFallback: WebGLFallbackBehavior.AUTO,
            });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            // Should fall back to CPU since WebGL is not available in Node.js test env
            expect(options?.baseOptions?.delegate).toBe("CPU");
        });
        it("defaults to AUTO fallback behavior", async () => {
            // In Node.js test environment, WebGL is unavailable
            await createMediaPipeBrowserDetector({ delegate: RuntimeDelegate.GPU });
            const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
            const options = calls[0]?.[1];
            // Should fall back to CPU by default
            expect(options?.baseOptions?.delegate).toBe("CPU");
        });
        it("throws WebGLNotAvailableError when GPU requested with ERROR fallback and WebGL unavailable", async () => {
            // In Node.js test environment, WebGL is unavailable
            await expect(createMediaPipeBrowserDetector({
                delegate: RuntimeDelegate.GPU,
                webglFallback: WebGLFallbackBehavior.ERROR,
            })).rejects.toThrow(WebGLNotAvailableError);
        });
    });
    describe("runtime delegate with mocked WebGL", () => {
        it("verifies detectWebGLSupport returns false in Node.js environment", () => {
            // This test verifies the function correctly returns false when document is undefined
            expect(detectWebGLSupport()).toBe(false);
        });
        it("uses GPU delegate when WebGL is available", async () => {
            // Mock detectWebGLSupport by providing a mock document
            const originalDocument = globalThis.document;
            // Create a mock document with createElement that returns a canvas with WebGL support
            const mockDocument = {
                createElement: () => ({
                    getContext: (contextType) => {
                        if (contextType === "webgl2" ||
                            contextType === "webgl" ||
                            contextType === "experimental-webgl") {
                            return {}; // Non-null indicates WebGL is available
                        }
                        return null;
                    },
                }),
            };
            // Temporarily set document
            globalThis.document = mockDocument;
            try {
                // Now detectWebGLSupport should return true
                expect(detectWebGLSupport()).toBe(true);
                await createMediaPipeBrowserDetector({
                    delegate: RuntimeDelegate.GPU,
                    webglFallback: WebGLFallbackBehavior.ERROR,
                });
                const calls = vi.mocked(PoseLandmarker.createFromOptions).mock.calls;
                const options = calls[0]?.[1];
                expect(options?.baseOptions?.delegate).toBe("GPU");
            }
            finally {
                // Restore original document state
                if (originalDocument === undefined) {
                    delete globalThis.document;
                }
                else {
                    globalThis.document =
                        originalDocument;
                }
            }
        });
        it("does not throw when WebGL is available with ERROR fallback", async () => {
            const originalDocument = globalThis.document;
            const mockDocument = {
                createElement: () => ({
                    getContext: () => ({}),
                }),
            };
            globalThis.document = mockDocument;
            try {
                // Should NOT throw because WebGL is available
                const detector = await createMediaPipeBrowserDetector({
                    delegate: RuntimeDelegate.GPU,
                    webglFallback: WebGLFallbackBehavior.ERROR,
                });
                expect(detector).toBeDefined();
                await detector.close();
            }
            finally {
                if (originalDocument === undefined) {
                    delete globalThis.document;
                }
                else {
                    globalThis.document =
                        originalDocument;
                }
            }
        });
    });
    describe("detectVideo() method", () => {
        const createMockLandmarks = () => Array.from({ length: TOTAL_LANDMARKS }, (_, i) => ({
            x: i / TOTAL_LANDMARKS,
            y: i / TOTAL_LANDMARKS,
            z: 0.1,
            visibility: 0.95,
        }));
        it("detects pose from HTMLVideoElement", async () => {
            const mockLandmarks = createMockLandmarks();
            mockLandmarker.detectForVideo.mockReturnValue({
                landmarks: [mockLandmarks],
                worldLandmarks: [mockLandmarks],
            });
            const detector = (await createMediaPipeBrowserDetector({
                runningMode: "VIDEO",
            }));
            const mockVideo = {
                videoWidth: 640,
                videoHeight: 480,
            };
            const result = await detector.detectVideo(mockVideo, 1000);
            expect(result).not.toBeNull();
            expect(result?.landmarks).toHaveLength(TOTAL_LANDMARKS);
            expect(mockLandmarker.detectForVideo).toHaveBeenCalledWith(mockVideo, 1000);
            await detector.close();
        });
        it("uses detect() for IMAGE mode", async () => {
            const mockLandmarks = createMockLandmarks();
            mockLandmarker.detect.mockReturnValue({
                landmarks: [mockLandmarks],
                worldLandmarks: [mockLandmarks],
            });
            const detector = (await createMediaPipeBrowserDetector({
                runningMode: "IMAGE",
            }));
            const mockVideo = {
                videoWidth: 640,
                videoHeight: 480,
            };
            const result = await detector.detectVideo(mockVideo, 1000);
            expect(result).not.toBeNull();
            expect(mockLandmarker.detect).toHaveBeenCalledWith(mockVideo);
            await detector.close();
        });
        it("returns null when no pose detected", async () => {
            mockLandmarker.detectForVideo.mockReturnValue({
                landmarks: [],
                worldLandmarks: [],
            });
            const detector = (await createMediaPipeBrowserDetector({
                runningMode: "VIDEO",
            }));
            const mockVideo = {};
            const result = await detector.detectVideo(mockVideo, 1000);
            expect(result).toBeNull();
            await detector.close();
        });
        it("throws DetectorClosedError when called after close", async () => {
            const detector = (await createMediaPipeBrowserDetector({
                runningMode: "VIDEO",
            }));
            const mockVideo = {};
            await detector.close();
            await expect(detector.detectVideo(mockVideo, 1000)).rejects.toThrow(DetectorClosedError);
        });
        it("throws PoseDetectionError when MediaPipe fails", async () => {
            mockLandmarker.detectForVideo.mockImplementation(() => {
                throw new Error("MediaPipe internal error");
            });
            const detector = (await createMediaPipeBrowserDetector({
                runningMode: "VIDEO",
            }));
            const mockVideo = {};
            await expect(detector.detectVideo(mockVideo, 1000)).rejects.toThrow(PoseDetectionError);
            await detector.close();
        });
    });
    describe("WebGLFallbackBehavior enum", () => {
        it("exports AUTO value", () => {
            expect(WebGLFallbackBehavior.AUTO).toBeDefined();
        });
        it("exports ERROR value", () => {
            expect(WebGLFallbackBehavior.ERROR).toBeDefined();
        });
    });
    describe("close() WebGL resource cleanup", () => {
        it("calls landmarker.close() to release WebGL resources", async () => {
            const detector = await createMediaPipeBrowserDetector();
            await detector.close();
            // Verify landmarker.close() was called which handles WebGL cleanup
            expect(mockLandmarker.close).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=mediapipe-browser.test.js.map