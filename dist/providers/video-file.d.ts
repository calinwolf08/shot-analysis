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
 * Error thrown when a video file is not found at the specified path.
 */
export declare class VideoFileNotFoundError extends Error {
    readonly filePath: string;
    constructor(filePath: string);
}
/**
 * Error thrown when a video file is corrupted or cannot be read.
 */
export declare class VideoFileCorruptedError extends Error {
    readonly filePath: string;
    readonly details: string;
    constructor(filePath: string, details: string);
}
/**
 * Error thrown when a video file has an unsupported format.
 */
export declare class UnsupportedVideoFormatError extends Error {
    readonly filePath: string;
    readonly format: string;
    constructor(filePath: string, format: string);
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
export declare class VideoFileProvider implements FrameProvider {
    private readonly metadata;
    private readonly fps;
    private readonly frames;
    private currentFrameIndex;
    /**
     * Private constructor. Use createVideoFileProvider() factory or createWithMockData() for tests.
     */
    private constructor();
    /**
     * Checks if a file path has a supported video format extension.
     *
     * @param filePath - Path to the video file
     * @returns true if the file extension is supported, false otherwise
     */
    static isSupportedFormat(filePath: string): boolean;
    /**
     * Creates a VideoFileProvider with mock data for testing purposes.
     *
     * @param options - Mock provider options including metadata, fps, and frames
     * @returns A new VideoFileProvider instance with mock data
     */
    static createWithMockData(options: MockProviderOptions): VideoFileProvider;
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
    static create(filePath: string): Promise<VideoFileProvider>;
    /**
     * Extracts video metadata and frames using ffmpeg.
     *
     * @param filePath - Path to the video file
     * @returns Promise with metadata, fps, and frames
     */
    private static extractVideoData;
    /**
     * Probes video file to get metadata.
     */
    private static probeVideo;
    /**
     * Extracts all frames from the video file.
     */
    private static extractFrames;
    /**
     * Retrieves the next frame from the video.
     *
     * @returns Promise resolving to the next VideoFrame, or null when video ends
     */
    getNextFrame(): Promise<VideoFrame | null>;
    /**
     * Returns the video frame rate in frames per second.
     *
     * @returns Frame rate as a positive number
     */
    getFps(): number;
    /**
     * Returns metadata about the video file.
     *
     * @returns FrameMetadata with width, height, and duration
     */
    getMetadata(): FrameMetadata;
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
export declare function createVideoFileProvider(filePath: string): Promise<FrameProvider>;
export {};
//# sourceMappingURL=video-file.d.ts.map