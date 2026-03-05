/**
 * Type tests for FrameProvider interface and related types.
 * These tests verify the interface contracts at compile time and runtime.
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import { InvalidFpsError } from "./types";
describe("VideoFrame type", () => {
    describe("structure", () => {
        it("has required properties with correct types", () => {
            const frame = {
                data: new Uint8ClampedArray(4),
                width: 1920,
                height: 1080,
                timestamp: 0,
                frameIndex: 0,
            };
            expect(frame.data).toBeInstanceOf(Uint8ClampedArray);
            expect(typeof frame.width).toBe("number");
            expect(typeof frame.height).toBe("number");
            expect(typeof frame.timestamp).toBe("number");
            expect(typeof frame.frameIndex).toBe("number");
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("valid frame data", () => {
        it("accepts RGBA data for a single pixel", () => {
            const frame = {
                data: new Uint8ClampedArray([255, 0, 0, 255]), // Red pixel
                width: 1,
                height: 1,
                timestamp: 0,
                frameIndex: 0,
            };
            expect(frame.data.length).toBe(4);
        });
        it("accepts data for multiple pixels", () => {
            const width = 2;
            const height = 2;
            const pixelCount = width * height;
            const bytesPerPixel = 4;
            const frame = {
                data: new Uint8ClampedArray(pixelCount * bytesPerPixel),
                width,
                height,
                timestamp: 100,
                frameIndex: 1,
            };
            expect(frame.data.length).toBe(16);
        });
        it("allows zero timestamp for first frame", () => {
            const frame = {
                data: new Uint8ClampedArray(4),
                width: 1,
                height: 1,
                timestamp: 0,
                frameIndex: 0,
            };
            expect(frame.timestamp).toBe(0);
        });
        it("allows zero-based frame index", () => {
            const frame = {
                data: new Uint8ClampedArray(4),
                width: 1,
                height: 1,
                timestamp: 0,
                frameIndex: 0,
            };
            expect(frame.frameIndex).toBe(0);
        });
    });
});
describe("FrameMetadata type", () => {
    describe("structure", () => {
        it("has required width and height properties", () => {
            const metadata = {
                width: 1920,
                height: 1080,
            };
            expect(typeof metadata.width).toBe("number");
            expect(typeof metadata.height).toBe("number");
        });
        it("allows optional duration property", () => {
            const metadataWithDuration = {
                width: 1920,
                height: 1080,
                duration: 5000,
            };
            const metadataWithoutDuration = {
                width: 1920,
                height: 1080,
            };
            expect(metadataWithDuration.duration).toBe(5000);
            expect(metadataWithoutDuration.duration).toBeUndefined();
        });
        it("enforces readonly properties at type level", () => {
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("live stream metadata", () => {
        it("represents live streams with undefined duration", () => {
            const liveStreamMetadata = {
                width: 1280,
                height: 720,
                // duration intentionally omitted for live streams
            };
            expect(liveStreamMetadata.duration).toBeUndefined();
        });
    });
    describe("recorded video metadata", () => {
        it("represents recorded video with defined duration", () => {
            const recordedVideoMetadata = {
                width: 1920,
                height: 1080,
                duration: 30000, // 30 seconds in milliseconds
            };
            expect(recordedVideoMetadata.duration).toBe(30000);
        });
    });
});
describe("FrameProvider interface", () => {
    describe("method signatures", () => {
        it("defines getNextFrame returning Promise<VideoFrame | null>", () => {
            expectTypeOf().toEqualTypeOf();
        });
        it("defines getFps returning number", () => {
            expectTypeOf().toEqualTypeOf();
        });
        it("defines getMetadata returning FrameMetadata", () => {
            expectTypeOf().toEqualTypeOf();
        });
    });
    describe("mock implementation", () => {
        /**
         * Mock implementation of FrameProvider for testing.
         * Generates a fixed number of test frames.
         */
        class MockFrameProvider {
            currentFrame = 0;
            totalFrames;
            metadata;
            fps;
            constructor(options) {
                if (options.fps <= 0) {
                    throw new InvalidFpsError(options.fps);
                }
                this.totalFrames = options.totalFrames;
                this.fps = options.fps;
                // Handle exactOptionalPropertyTypes by only including duration when defined
                this.metadata =
                    options.duration !== undefined
                        ? {
                            width: options.width,
                            height: options.height,
                            duration: options.duration,
                        }
                        : { width: options.width, height: options.height };
            }
            async getNextFrame() {
                if (this.currentFrame >= this.totalFrames) {
                    return null;
                }
                const frame = {
                    data: new Uint8ClampedArray(this.metadata.width * this.metadata.height * 4),
                    width: this.metadata.width,
                    height: this.metadata.height,
                    timestamp: (this.currentFrame * 1000) / this.fps,
                    frameIndex: this.currentFrame,
                };
                this.currentFrame++;
                return frame;
            }
            getFps() {
                return this.fps;
            }
            getMetadata() {
                return this.metadata;
            }
        }
        it("can iterate through all frames", async () => {
            const provider = new MockFrameProvider({
                totalFrames: 3,
                fps: 30,
                width: 100,
                height: 100,
                duration: 100,
            });
            const frames = [];
            let frame = await provider.getNextFrame();
            while (frame !== null) {
                frames.push(frame);
                frame = await provider.getNextFrame();
            }
            expect(frames.length).toBe(3);
            expect(frames[0]?.frameIndex).toBe(0);
            expect(frames[1]?.frameIndex).toBe(1);
            expect(frames[2]?.frameIndex).toBe(2);
        });
        it("returns null after all frames consumed", async () => {
            const provider = new MockFrameProvider({
                totalFrames: 1,
                fps: 30,
                width: 100,
                height: 100,
            });
            const firstFrame = await provider.getNextFrame();
            const afterLast = await provider.getNextFrame();
            expect(firstFrame).not.toBeNull();
            expect(afterLast).toBeNull();
        });
        it("calculates correct timestamps from fps", async () => {
            const fps = 30;
            const provider = new MockFrameProvider({
                totalFrames: 3,
                fps,
                width: 100,
                height: 100,
            });
            const frame0 = await provider.getNextFrame();
            const frame1 = await provider.getNextFrame();
            const frame2 = await provider.getNextFrame();
            // At 30 fps, each frame is ~33.33ms apart
            expect(frame0?.timestamp).toBeCloseTo(0);
            expect(frame1?.timestamp).toBeCloseTo(1000 / 30);
            expect(frame2?.timestamp).toBeCloseTo(2000 / 30);
        });
        it("returns correct fps value", () => {
            const provider = new MockFrameProvider({
                totalFrames: 10,
                fps: 60,
                width: 100,
                height: 100,
            });
            expect(provider.getFps()).toBe(60);
        });
        it("returns correct metadata", () => {
            const provider = new MockFrameProvider({
                totalFrames: 10,
                fps: 30,
                width: 1920,
                height: 1080,
                duration: 5000,
            });
            const metadata = provider.getMetadata();
            expect(metadata.width).toBe(1920);
            expect(metadata.height).toBe(1080);
            expect(metadata.duration).toBe(5000);
        });
        it("returns undefined duration for live stream simulation", () => {
            const provider = new MockFrameProvider({
                totalFrames: 100,
                fps: 30,
                width: 1280,
                height: 720,
                // duration omitted to simulate live stream
            });
            const metadata = provider.getMetadata();
            expect(metadata.duration).toBeUndefined();
        });
    });
});
describe("InvalidFpsError", () => {
    it("extends Error", () => {
        const error = new InvalidFpsError(0);
        expect(error).toBeInstanceOf(Error);
    });
    it("has correct name", () => {
        const error = new InvalidFpsError(0);
        expect(error.name).toBe("InvalidFpsError");
    });
    it("includes fps value in message for zero", () => {
        const error = new InvalidFpsError(0);
        expect(error.message).toContain("0");
        expect(error.message).toContain("positive");
    });
    it("includes fps value in message for negative", () => {
        const error = new InvalidFpsError(-30);
        expect(error.message).toContain("-30");
    });
    describe("edge cases for zero fps", () => {
        class TestProvider {
            fps;
            constructor(fps) {
                if (fps <= 0) {
                    throw new InvalidFpsError(fps);
                }
                this.fps = fps;
            }
            async getNextFrame() {
                return null;
            }
            getFps() {
                return this.fps;
            }
            getMetadata() {
                return { width: 100, height: 100 };
            }
        }
        it("throws InvalidFpsError for zero fps", () => {
            expect(() => new TestProvider(0)).toThrow(InvalidFpsError);
        });
        it("throws InvalidFpsError for negative fps", () => {
            expect(() => new TestProvider(-1)).toThrow(InvalidFpsError);
        });
        it("does not throw for positive fps", () => {
            expect(() => new TestProvider(30)).not.toThrow();
        });
        it("does not throw for fractional positive fps", () => {
            expect(() => new TestProvider(29.97)).not.toThrow();
        });
    });
});
//# sourceMappingURL=types.test.js.map