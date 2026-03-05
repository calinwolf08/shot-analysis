/**
 * Integration tests for VideoFileProvider with real video files.
 *
 * These tests require ffmpeg to be installed and will create/use test video files.
 * Tests are skipped if ffmpeg is not available.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createVideoFileProvider, VideoFileProvider } from "./video-file";
import { spawn } from "child_process";
import { mkdir, rm } from "fs/promises";
import { join } from "path";

const TEST_FIXTURES_DIR = join(process.cwd(), "test-fixtures");
const TEST_VIDEO_PATH = join(TEST_FIXTURES_DIR, "test-video.mp4");
const TEST_VIDEO_SHORT_PATH = join(TEST_FIXTURES_DIR, "test-video-short.mp4");

let ffmpegAvailable = false;
let testVideoCreated = false;

/**
 * Check if ffmpeg is available on the system.
 */
async function checkFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"]);
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Create a test video file using ffmpeg.
 *
 * @param outputPath - Path where video will be created
 * @param durationSeconds - Duration of the video in seconds
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @param fps - Frames per second
 */
async function createTestVideo(
  outputPath: string,
  durationSeconds: number,
  width: number,
  height: number,
  fps: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y", // Overwrite output file
      "-f",
      "lavfi",
      "-i",
      `testsrc=duration=${durationSeconds}:size=${width}x${height}:rate=${fps}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ];

    const proc = spawn("ffmpeg", args, { stdio: "pipe" });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

describe("VideoFileProvider integration tests", () => {
  beforeAll(async () => {
    // Check if ffmpeg is available
    ffmpegAvailable = await checkFfmpeg();
    if (!ffmpegAvailable) {
      console.log("ffmpeg not available, skipping integration tests");
      return;
    }

    // Create test fixtures directory if it doesn't exist
    try {
      await mkdir(TEST_FIXTURES_DIR, { recursive: true });
    } catch {
      // Directory may already exist
    }

    // Create test videos
    try {
      // Main test video: 1 second, 100x100, 30fps
      await createTestVideo(TEST_VIDEO_PATH, 1, 100, 100, 30);
      // Short test video: 0.1 second, 50x50, 10fps
      await createTestVideo(TEST_VIDEO_SHORT_PATH, 0.1, 50, 50, 10);
      testVideoCreated = true;
    } catch (err) {
      console.log(`Failed to create test video: ${err}`);
    }
  });

  afterAll(async () => {
    // Clean up test videos
    if (testVideoCreated) {
      try {
        await rm(TEST_VIDEO_PATH, { force: true });
        await rm(TEST_VIDEO_SHORT_PATH, { force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("with real video file", () => {
    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "loads video file and extracts correct metadata",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_PATH);

        const metadata = provider.getMetadata();
        expect(metadata.width).toBe(100);
        expect(metadata.height).toBe(100);
        // Duration should be approximately 1000ms (1 second)
        expect(metadata.duration).toBeGreaterThan(900);
        expect(metadata.duration).toBeLessThan(1100);
      },
    );

    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "returns correct fps",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_PATH);

        const fps = provider.getFps();
        expect(fps).toBeCloseTo(30, 0);
      },
    );

    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "extracts frames with correct dimensions",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_PATH);
        const frame = await provider.getNextFrame();

        expect(frame).not.toBeNull();
        expect(frame!.width).toBe(100);
        expect(frame!.height).toBe(100);
        expect(frame!.data.length).toBe(100 * 100 * 4); // RGBA
      },
    );

    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "extracts frames with incrementing frame index",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_PATH);

        const frame0 = await provider.getNextFrame();
        const frame1 = await provider.getNextFrame();
        const frame2 = await provider.getNextFrame();

        expect(frame0!.frameIndex).toBe(0);
        expect(frame1!.frameIndex).toBe(1);
        expect(frame2!.frameIndex).toBe(2);
      },
    );

    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "extracts frames with increasing timestamps",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_PATH);

        const frame0 = await provider.getNextFrame();
        const frame1 = await provider.getNextFrame();
        const frame2 = await provider.getNextFrame();

        expect(frame0!.timestamp).toBe(0);
        expect(frame1!.timestamp).toBeGreaterThan(frame0!.timestamp);
        expect(frame2!.timestamp).toBeGreaterThan(frame1!.timestamp);

        // At 30fps, frames should be ~33ms apart
        expect(frame1!.timestamp - frame0!.timestamp).toBeCloseTo(1000 / 30, 1);
      },
    );

    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "returns null after all frames consumed",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_SHORT_PATH);

        // Read all frames
        const frames = [];
        let frame = await provider.getNextFrame();
        while (frame !== null) {
          frames.push(frame);
          frame = await provider.getNextFrame();
        }

        // Short video at 10fps for 0.1 seconds should have ~1 frame
        expect(frames.length).toBeGreaterThanOrEqual(1);

        // Subsequent calls should return null
        expect(await provider.getNextFrame()).toBeNull();
        expect(await provider.getNextFrame()).toBeNull();
      },
    );

    it.skipIf(!ffmpegAvailable || !testVideoCreated)(
      "can iterate through all frames in a video",
      async () => {
        const provider = await createVideoFileProvider(TEST_VIDEO_PATH);
        const fps = provider.getFps();
        const metadata = provider.getMetadata();

        const frames = [];
        let frame = await provider.getNextFrame();
        while (frame !== null) {
          frames.push(frame);
          frame = await provider.getNextFrame();
        }

        // 1 second at 30fps should yield approximately 30 frames
        const expectedFrames = Math.floor((metadata.duration! / 1000) * fps);
        expect(frames.length).toBeGreaterThanOrEqual(expectedFrames - 2);
        expect(frames.length).toBeLessThanOrEqual(expectedFrames + 2);

        // Verify frame indices are sequential
        frames.forEach((f, i) => {
          expect(f.frameIndex).toBe(i);
        });
      },
    );
  });

  describe("error handling", () => {
    it("throws VideoFileNotFoundError for nonexistent file", async () => {
      const { VideoFileNotFoundError } = await import("./video-file");
      await expect(
        createVideoFileProvider("/nonexistent/video.mp4"),
      ).rejects.toThrow(VideoFileNotFoundError);
    });

    it("throws UnsupportedVideoFormatError for unsupported format", async () => {
      const { UnsupportedVideoFormatError } = await import("./video-file");
      await expect(createVideoFileProvider("/some/video.avi")).rejects.toThrow(
        UnsupportedVideoFormatError,
      );
    });
  });

  describe("supported formats", () => {
    it("accepts .mp4 extension", () => {
      expect(VideoFileProvider.isSupportedFormat("video.mp4")).toBe(true);
    });

    it("accepts .mov extension", () => {
      expect(VideoFileProvider.isSupportedFormat("video.mov")).toBe(true);
    });

    it("accepts .webm extension", () => {
      expect(VideoFileProvider.isSupportedFormat("video.webm")).toBe(true);
    });

    it("rejects unsupported extensions", () => {
      expect(VideoFileProvider.isSupportedFormat("video.avi")).toBe(false);
      expect(VideoFileProvider.isSupportedFormat("video.wmv")).toBe(false);
      expect(VideoFileProvider.isSupportedFormat("video")).toBe(false);
    });
  });
});
