/**
 * Unit tests for VideoFileProvider class.
 * Following TDD: tests are written BEFORE implementation.
 */
import { describe, it, expect, vi } from "vitest";
// We'll mock fluent-ffmpeg since it won't be available in test environment
vi.mock("fluent-ffmpeg", () => {
    return {
        default: vi.fn(),
    };
});
// Import after mocking
import { VideoFileProvider, createVideoFileProvider, VideoFileNotFoundError, VideoFileCorruptedError, UnsupportedVideoFormatError, } from "./video-file";
describe("VideoFileProvider", () => {
    describe("constructor and error cases", () => {
        describe("VideoFileNotFoundError", () => {
            it("extends Error", () => {
                const error = new VideoFileNotFoundError("/path/to/video.mp4");
                expect(error).toBeInstanceOf(Error);
            });
            it("has correct name", () => {
                const error = new VideoFileNotFoundError("/path/to/video.mp4");
                expect(error.name).toBe("VideoFileNotFoundError");
            });
            it("includes file path in message", () => {
                const path = "/path/to/video.mp4";
                const error = new VideoFileNotFoundError(path);
                expect(error.message).toContain(path);
                expect(error.message).toContain("not found");
            });
            it("stores file path as property", () => {
                const path = "/path/to/video.mp4";
                const error = new VideoFileNotFoundError(path);
                expect(error.filePath).toBe(path);
            });
        });
        describe("VideoFileCorruptedError", () => {
            it("extends Error", () => {
                const error = new VideoFileCorruptedError("/path/to/video.mp4", "Invalid header");
                expect(error).toBeInstanceOf(Error);
            });
            it("has correct name", () => {
                const error = new VideoFileCorruptedError("/path/to/video.mp4", "Invalid header");
                expect(error.name).toBe("VideoFileCorruptedError");
            });
            it("includes file path and details in message", () => {
                const path = "/path/to/video.mp4";
                const details = "Invalid header";
                const error = new VideoFileCorruptedError(path, details);
                expect(error.message).toContain(path);
                expect(error.message).toContain(details);
            });
            it("stores file path and details as properties", () => {
                const path = "/path/to/video.mp4";
                const details = "Invalid header";
                const error = new VideoFileCorruptedError(path, details);
                expect(error.filePath).toBe(path);
                expect(error.details).toBe(details);
            });
        });
        describe("UnsupportedVideoFormatError", () => {
            it("extends Error", () => {
                const error = new UnsupportedVideoFormatError("/path/to/video.avi", "avi");
                expect(error).toBeInstanceOf(Error);
            });
            it("has correct name", () => {
                const error = new UnsupportedVideoFormatError("/path/to/video.avi", "avi");
                expect(error.name).toBe("UnsupportedVideoFormatError");
            });
            it("includes file path and format in message", () => {
                const path = "/path/to/video.avi";
                const format = "avi";
                const error = new UnsupportedVideoFormatError(path, format);
                expect(error.message).toContain(path);
                expect(error.message).toContain(format);
                expect(error.message).toContain("mp4");
                expect(error.message).toContain("mov");
                expect(error.message).toContain("webm");
            });
            it("stores file path and format as properties", () => {
                const path = "/path/to/video.avi";
                const format = "avi";
                const error = new UnsupportedVideoFormatError(path, format);
                expect(error.filePath).toBe(path);
                expect(error.format).toBe(format);
            });
        });
    });
    describe("supported formats", () => {
        it("accepts .mp4 extension", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.mp4");
            expect(isSupported).toBe(true);
        });
        it("accepts .MP4 extension (case insensitive)", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.MP4");
            expect(isSupported).toBe(true);
        });
        it("accepts .mov extension", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.mov");
            expect(isSupported).toBe(true);
        });
        it("accepts .MOV extension (case insensitive)", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.MOV");
            expect(isSupported).toBe(true);
        });
        it("accepts .webm extension", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.webm");
            expect(isSupported).toBe(true);
        });
        it("accepts .WEBM extension (case insensitive)", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.WEBM");
            expect(isSupported).toBe(true);
        });
        it("rejects .avi extension", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.avi");
            expect(isSupported).toBe(false);
        });
        it("rejects .wmv extension", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("video.wmv");
            expect(isSupported).toBe(false);
        });
        it("rejects files without extension", () => {
            const isSupported = VideoFileProvider.isSupportedFormat("videofile");
            expect(isSupported).toBe(false);
        });
    });
    describe("getMetadata()", () => {
        it("returns FrameMetadata with correct structure", async () => {
            // Create a mock provider with known metadata
            const mockMetadata = {
                width: 1920,
                height: 1080,
                duration: 5000, // 5 seconds in ms
            };
            const provider = VideoFileProvider.createWithMockData({
                metadata: mockMetadata,
                fps: 30,
                frames: [],
            });
            const metadata = provider.getMetadata();
            expect(metadata.width).toBe(1920);
            expect(metadata.height).toBe(1080);
            expect(metadata.duration).toBe(5000);
        });
        it("returns correct dimensions", async () => {
            const mockMetadata = {
                width: 1280,
                height: 720,
                duration: 10000,
            };
            const provider = VideoFileProvider.createWithMockData({
                metadata: mockMetadata,
                fps: 60,
                frames: [],
            });
            const metadata = provider.getMetadata();
            expect(metadata.width).toBe(1280);
            expect(metadata.height).toBe(720);
        });
        it("returns duration in milliseconds", async () => {
            const mockMetadata = {
                width: 1920,
                height: 1080,
                duration: 30000, // 30 seconds
            };
            const provider = VideoFileProvider.createWithMockData({
                metadata: mockMetadata,
                fps: 30,
                frames: [],
            });
            const metadata = provider.getMetadata();
            expect(metadata.duration).toBe(30000);
        });
    });
    describe("getFps()", () => {
        it("returns the video frame rate", () => {
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 1920, height: 1080, duration: 5000 },
                fps: 30,
                frames: [],
            });
            expect(provider.getFps()).toBe(30);
        });
        it("returns fractional fps (e.g., 29.97)", () => {
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 1920, height: 1080, duration: 5000 },
                fps: 29.97,
                frames: [],
            });
            expect(provider.getFps()).toBeCloseTo(29.97);
        });
        it("returns 60fps for high frame rate video", () => {
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 1920, height: 1080, duration: 5000 },
                fps: 60,
                frames: [],
            });
            expect(provider.getFps()).toBe(60);
        });
    });
    describe("getNextFrame()", () => {
        it("returns first frame with frameIndex 0", async () => {
            const frameData = new Uint8ClampedArray(1920 * 1080 * 4);
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 1920, height: 1080, duration: 5000 },
                fps: 30,
                frames: [{ data: frameData, timestamp: 0 }],
            });
            const frame = await provider.getNextFrame();
            expect(frame).not.toBeNull();
            expect(frame.frameIndex).toBe(0);
        });
        it("returns frames with incrementing frameIndex", async () => {
            const frameData = new Uint8ClampedArray(100 * 100 * 4);
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 100, height: 100, duration: 1000 },
                fps: 30,
                frames: [
                    { data: frameData, timestamp: 0 },
                    { data: frameData, timestamp: 33.33 },
                    { data: frameData, timestamp: 66.67 },
                ],
            });
            const frame0 = await provider.getNextFrame();
            const frame1 = await provider.getNextFrame();
            const frame2 = await provider.getNextFrame();
            expect(frame0.frameIndex).toBe(0);
            expect(frame1.frameIndex).toBe(1);
            expect(frame2.frameIndex).toBe(2);
        });
        it("returns correct timestamps based on fps", async () => {
            const frameData = new Uint8ClampedArray(100 * 100 * 4);
            const fps = 30;
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 100, height: 100, duration: 1000 },
                fps,
                frames: [
                    { data: frameData, timestamp: 0 },
                    { data: frameData, timestamp: 1000 / fps },
                    { data: frameData, timestamp: 2000 / fps },
                ],
            });
            const frame0 = await provider.getNextFrame();
            const frame1 = await provider.getNextFrame();
            const frame2 = await provider.getNextFrame();
            expect(frame0.timestamp).toBeCloseTo(0);
            expect(frame1.timestamp).toBeCloseTo(1000 / fps);
            expect(frame2.timestamp).toBeCloseTo(2000 / fps);
        });
        it("returns frame with correct width and height", async () => {
            const width = 1920;
            const height = 1080;
            const frameData = new Uint8ClampedArray(width * height * 4);
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width, height, duration: 5000 },
                fps: 30,
                frames: [{ data: frameData, timestamp: 0 }],
            });
            const frame = await provider.getNextFrame();
            expect(frame.width).toBe(width);
            expect(frame.height).toBe(height);
        });
        it("returns frame with RGBA data", async () => {
            const width = 2;
            const height = 2;
            const frameData = new Uint8ClampedArray(width * height * 4);
            // Fill with red pixel pattern
            for (let i = 0; i < frameData.length; i += 4) {
                frameData[i] = 255; // R
                frameData[i + 1] = 0; // G
                frameData[i + 2] = 0; // B
                frameData[i + 3] = 255; // A
            }
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width, height, duration: 1000 },
                fps: 30,
                frames: [{ data: frameData, timestamp: 0 }],
            });
            const frame = await provider.getNextFrame();
            expect(frame.data).toBeInstanceOf(Uint8ClampedArray);
            expect(frame.data.length).toBe(width * height * 4);
            // Verify RGBA pattern
            expect(frame.data[0]).toBe(255); // R
            expect(frame.data[1]).toBe(0); // G
            expect(frame.data[2]).toBe(0); // B
            expect(frame.data[3]).toBe(255); // A
        });
        it("returns null when video ends", async () => {
            const frameData = new Uint8ClampedArray(100 * 100 * 4);
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 100, height: 100, duration: 100 },
                fps: 30,
                frames: [
                    { data: frameData, timestamp: 0 },
                    { data: frameData, timestamp: 33.33 },
                ],
            });
            await provider.getNextFrame();
            await provider.getNextFrame();
            const afterEnd = await provider.getNextFrame();
            expect(afterEnd).toBeNull();
        });
        it("returns null for empty video (0 frames)", async () => {
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 1920, height: 1080, duration: 0 },
                fps: 30,
                frames: [],
            });
            const frame = await provider.getNextFrame();
            expect(frame).toBeNull();
        });
        it("continues returning null after video ends", async () => {
            const frameData = new Uint8ClampedArray(100 * 100 * 4);
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 100, height: 100, duration: 100 },
                fps: 30,
                frames: [{ data: frameData, timestamp: 0 }],
            });
            await provider.getNextFrame();
            const null1 = await provider.getNextFrame();
            const null2 = await provider.getNextFrame();
            const null3 = await provider.getNextFrame();
            expect(null1).toBeNull();
            expect(null2).toBeNull();
            expect(null3).toBeNull();
        });
    });
    describe("FrameProvider interface compliance", () => {
        it("implements FrameProvider interface", () => {
            const provider = VideoFileProvider.createWithMockData({
                metadata: { width: 100, height: 100, duration: 1000 },
                fps: 30,
                frames: [],
            });
            // Type check: provider should satisfy FrameProvider
            const frameProvider = provider;
            expect(typeof frameProvider.getNextFrame).toBe("function");
            expect(typeof frameProvider.getFps).toBe("function");
            expect(typeof frameProvider.getMetadata).toBe("function");
        });
    });
});
describe("createVideoFileProvider factory", () => {
    it("returns a Promise", async () => {
        // Note: This will be rejected due to nonexistent file, but we can check it's a promise
        const result = createVideoFileProvider("/nonexistent/path.mp4");
        expect(result).toBeInstanceOf(Promise);
        // Catch the rejection to avoid unhandled promise rejection
        await expect(result).rejects.toThrow(VideoFileNotFoundError);
    });
    it("throws VideoFileNotFoundError for nonexistent file", async () => {
        await expect(createVideoFileProvider("/nonexistent/path.mp4")).rejects.toThrow(VideoFileNotFoundError);
    });
    it("throws UnsupportedVideoFormatError for unsupported format", async () => {
        await expect(createVideoFileProvider("/some/path/video.avi")).rejects.toThrow(UnsupportedVideoFormatError);
    });
});
//# sourceMappingURL=video-file.test.js.map