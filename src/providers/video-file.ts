/**
 * Video file provider for the basketball shot analysis module.
 *
 * This module provides a FrameProvider implementation that reads frames
 * from video files using ffmpeg for frame extraction.
 *
 * Supports common video formats: mp4, mov, webm
 *
 * ## Known Limitations
 *
 * - Requires ffmpeg and ffprobe to be installed on the system
 * - Video frames are loaded into memory; large videos may consume significant RAM
 * - Variable frame rate (VFR) videos are normalized to constant frame rate
 *
 * ## Testing
 *
 * Unit tests use mock data via `createWithMockData()` to test the FrameProvider
 * interface implementation without requiring ffmpeg. Integration tests in
 * `video-file.integration.test.ts` test the real ffmpeg integration when
 * ffmpeg is available on the system.
 */

import type { FrameProvider, VideoFrame, FrameMetadata } from "./types";

/**
 * Supported video file extensions (case-insensitive).
 */
const SUPPORTED_EXTENSIONS = [".mp4", ".mov", ".webm"] as const;

/**
 * Error thrown when a video file is not found at the specified path.
 */
export class VideoFileNotFoundError extends Error {
  readonly filePath: string;

  constructor(filePath: string) {
    super(`Video file not found: ${filePath}`);
    this.name = "VideoFileNotFoundError";
    this.filePath = filePath;
  }
}

/**
 * Error thrown when a video file is corrupted or cannot be read.
 */
export class VideoFileCorruptedError extends Error {
  readonly filePath: string;
  readonly details: string;

  constructor(filePath: string, details: string) {
    super(`Video file corrupted: ${filePath}. Details: ${details}`);
    this.name = "VideoFileCorruptedError";
    this.filePath = filePath;
    this.details = details;
  }
}

/**
 * Error thrown when a video file has an unsupported format.
 */
export class UnsupportedVideoFormatError extends Error {
  readonly filePath: string;
  readonly format: string;

  constructor(filePath: string, format: string) {
    super(
      `Unsupported video format: ${format} for file ${filePath}. ` +
        `Supported formats: mp4, mov, webm`,
    );
    this.name = "UnsupportedVideoFormatError";
    this.filePath = filePath;
    this.format = format;
  }
}

/**
 * Internal type for mock frame data.
 */
interface MockFrameData {
  data: Uint8ClampedArray;
  timestamp: number;
}

/**
 * Options for creating a VideoFileProvider with mock data (for testing).
 */
interface MockProviderOptions {
  metadata: FrameMetadata;
  fps: number;
  frames: MockFrameData[];
}

/**
 * FrameProvider implementation for video files.
 *
 * Extracts frames from video files using ffmpeg. Supports mp4, mov, and webm formats.
 *
 * @example
 * ```typescript
 * const provider = await createVideoFileProvider('shot.mp4');
 * const metadata = provider.getMetadata();
 * console.log(`Video: ${metadata.width}x${metadata.height}`);
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   // Process frame
 *   frame = await provider.getNextFrame();
 * }
 * ```
 */
export class VideoFileProvider implements FrameProvider {
  private readonly metadata: FrameMetadata;
  private readonly fps: number;
  private readonly frames: MockFrameData[];
  private currentFrameIndex: number = 0;

  /**
   * Private constructor. Use createVideoFileProvider() factory or createWithMockData() for tests.
   */
  private constructor(
    metadata: FrameMetadata,
    fps: number,
    frames: MockFrameData[],
  ) {
    this.metadata = metadata;
    this.fps = fps;
    this.frames = frames;
  }

  /**
   * Checks if a file path has a supported video format extension.
   *
   * @param filePath - Path to the video file
   * @returns true if the file extension is supported, false otherwise
   */
  static isSupportedFormat(filePath: string): boolean {
    const extension = filePath
      .substring(filePath.lastIndexOf("."))
      .toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(
      extension as (typeof SUPPORTED_EXTENSIONS)[number],
    );
  }

  /**
   * Creates a VideoFileProvider with mock data for testing purposes.
   *
   * @param options - Mock provider options including metadata, fps, and frames
   * @returns A new VideoFileProvider instance with mock data
   */
  static createWithMockData(options: MockProviderOptions): VideoFileProvider {
    return new VideoFileProvider(options.metadata, options.fps, options.frames);
  }

  /**
   * Creates a VideoFileProvider from a real video file.
   * This method loads the video and extracts metadata.
   *
   * @param filePath - Path to the video file
   * @returns Promise resolving to a VideoFileProvider instance
   * @throws {VideoFileNotFoundError} If the file does not exist
   * @throws {VideoFileCorruptedError} If the file is corrupted
   * @throws {UnsupportedVideoFormatError} If the file format is not supported
   */
  static async create(filePath: string): Promise<VideoFileProvider> {
    // Check if format is supported
    if (!VideoFileProvider.isSupportedFormat(filePath)) {
      const extension = filePath
        .substring(filePath.lastIndexOf(".") + 1)
        .toLowerCase();
      throw new UnsupportedVideoFormatError(filePath, extension);
    }

    // Check if file exists using fs
    const fs = await import("fs/promises");
    try {
      await fs.access(filePath);
    } catch {
      throw new VideoFileNotFoundError(filePath);
    }

    // Extract metadata and frames using ffmpeg
    const { metadata, fps, frames } =
      await VideoFileProvider.extractVideoData(filePath);

    return new VideoFileProvider(metadata, fps, frames);
  }

  /**
   * Extracts video metadata and frames using ffmpeg.
   *
   * @param filePath - Path to the video file
   * @returns Promise with metadata, fps, and frames
   */
  private static async extractVideoData(filePath: string): Promise<{
    metadata: FrameMetadata;
    fps: number;
    frames: MockFrameData[];
  }> {
    // Use fluent-ffmpeg to probe video and extract frames
    const ffprobePromise = VideoFileProvider.probeVideo(filePath);
    const { width, height, duration, fps } = await ffprobePromise;

    // Extract all frames
    const frames = await VideoFileProvider.extractFrames(
      filePath,
      width,
      height,
      fps,
      duration,
    );

    const metadata: FrameMetadata = {
      width,
      height,
      duration,
    };

    return { metadata, fps, frames };
  }

  /**
   * Probes video file to get metadata.
   */
  private static async probeVideo(
    filePath: string,
  ): Promise<{ width: number; height: number; duration: number; fps: number }> {
    const { spawn } = await import("child_process");

    return new Promise((resolve, reject) => {
      const ffprobe = spawn("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate,duration",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        filePath,
      ]);

      let stdout = "";
      let stderr = "";

      ffprobe.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(
            new VideoFileCorruptedError(filePath, stderr || "ffprobe failed"),
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);
          const stream = result.streams?.[0];

          if (!stream) {
            reject(
              new VideoFileCorruptedError(filePath, "No video stream found"),
            );
            return;
          }

          const width = stream.width;
          const height = stream.height;

          // Parse frame rate (can be "30/1" or "30000/1001")
          const [num, den] = stream.r_frame_rate.split("/").map(Number);
          const fps = num / den;

          // Get duration in milliseconds
          const durationSeconds = parseFloat(
            stream.duration || result.format?.duration || "0",
          );
          const duration = Math.round(durationSeconds * 1000);

          resolve({ width, height, duration, fps });
        } catch (e) {
          reject(
            new VideoFileCorruptedError(
              filePath,
              `Failed to parse metadata: ${e}`,
            ),
          );
        }
      });

      ffprobe.on("error", (err) => {
        reject(
          new VideoFileCorruptedError(
            filePath,
            `ffprobe error: ${err.message}`,
          ),
        );
      });
    });
  }

  /**
   * Extracts all frames from the video file.
   */
  private static async extractFrames(
    filePath: string,
    width: number,
    height: number,
    fps: number,
    duration: number,
  ): Promise<MockFrameData[]> {
    const { spawn } = await import("child_process");
    const frames: MockFrameData[] = [];
    const totalFrames = Math.floor((duration / 1000) * fps);

    // Skip extraction if video is empty
    if (totalFrames === 0) {
      return frames;
    }

    return new Promise((resolve, reject) => {
      // Use ffmpeg to extract raw RGBA frames
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        filePath,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-vsync",
        "0",
        "-",
      ]);

      const frameSize = width * height * 4;
      let buffer = Buffer.alloc(0);
      let frameIndex = 0;

      ffmpeg.stdout.on("data", (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        // Process complete frames
        while (buffer.length >= frameSize) {
          const frameBuffer = buffer.subarray(0, frameSize);
          buffer = buffer.subarray(frameSize);

          const timestamp = (frameIndex * 1000) / fps;
          const frameData = new Uint8ClampedArray(frameBuffer);

          frames.push({ data: frameData, timestamp });
          frameIndex++;
        }
      });

      ffmpeg.stderr.on("data", (data) => {
        // ffmpeg writes progress to stderr, we can ignore it
        const message = data.toString();
        // Log corruption warnings but don't fail
        if (
          message.includes("error") &&
          !message.includes("Error while decoding") // Skip individual frame decode errors
        ) {
          console.warn(
            `VideoFileProvider: Warning during frame extraction: ${message}`,
          );
        }
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0 && frames.length === 0) {
          reject(
            new VideoFileCorruptedError(filePath, "Failed to extract frames"),
          );
          return;
        }
        resolve(frames);
      });

      ffmpeg.on("error", (err) => {
        reject(
          new VideoFileCorruptedError(filePath, `ffmpeg error: ${err.message}`),
        );
      });
    });
  }

  /**
   * Retrieves the next frame from the video.
   *
   * @returns Promise resolving to the next VideoFrame, or null when video ends
   */
  async getNextFrame(): Promise<VideoFrame | null> {
    const frameData = this.frames[this.currentFrameIndex];
    if (frameData === undefined) {
      return null;
    }

    const frame: VideoFrame = {
      data: frameData.data,
      width: this.metadata.width,
      height: this.metadata.height,
      timestamp: frameData.timestamp,
      frameIndex: this.currentFrameIndex,
    };

    this.currentFrameIndex++;
    return frame;
  }

  /**
   * Returns the video frame rate in frames per second.
   *
   * @returns Frame rate as a positive number
   */
  getFps(): number {
    return this.fps;
  }

  /**
   * Returns metadata about the video file.
   *
   * @returns FrameMetadata with width, height, and duration
   */
  getMetadata(): FrameMetadata {
    return this.metadata;
  }
}

/**
 * Factory function to create a VideoFileProvider from a video file.
 *
 * @param filePath - Path to the video file (mp4, mov, or webm)
 * @returns Promise resolving to a FrameProvider instance
 * @throws {VideoFileNotFoundError} If the file does not exist
 * @throws {VideoFileCorruptedError} If the file is corrupted
 * @throws {UnsupportedVideoFormatError} If the file format is not supported
 *
 * @example
 * ```typescript
 * const provider = await createVideoFileProvider('./shot.mp4');
 * console.log(`FPS: ${provider.getFps()}`);
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   console.log(`Processing frame ${frame.frameIndex}`);
 *   frame = await provider.getNextFrame();
 * }
 * ```
 */
export async function createVideoFileProvider(
  filePath: string,
): Promise<FrameProvider> {
  return VideoFileProvider.create(filePath);
}
