/**
 * Type definitions for frame providers in the basketball shot analysis module.
 *
 * This module defines the FrameProvider interface and related types for
 * abstracting video frame sources. Implementations can support both video
 * files (Node.js) and live camera streams (browser).
 */
/**
 * Represents a single video frame with associated metadata.
 * Contains raw pixel data and timing information.
 */
export interface VideoFrame {
    /** Raw image data in RGBA format (4 bytes per pixel) */
    readonly data: Uint8ClampedArray;
    /** Frame width in pixels */
    readonly width: number;
    /** Frame height in pixels */
    readonly height: number;
    /** Timestamp of the frame in milliseconds from video start */
    readonly timestamp: number;
    /** Zero-based frame index */
    readonly frameIndex: number;
}
/**
 * Metadata about the video source.
 * Provides information about dimensions, timing, and frame count.
 */
export interface FrameMetadata {
    /** Frame width in pixels */
    readonly width: number;
    /** Frame height in pixels */
    readonly height: number;
    /**
     * Total duration of the video in milliseconds.
     * Undefined for live streams which have no predetermined duration.
     */
    readonly duration?: number;
}
/**
 * Error thrown when a FrameProvider is configured with invalid fps.
 */
export declare class InvalidFpsError extends Error {
    constructor(fps: number);
}
/**
 * Abstract interface for providing video frames to the analyzer.
 *
 * Implementations of this interface allow the analyzer to consume frames
 * from various sources including:
 * - Pre-recorded video files (via Node.js video decoding)
 * - Live camera streams (via browser MediaStream API)
 * - Image sequences
 * - Synthetic/test frame generators
 *
 * @example
 * ```typescript
 * // Using a FrameProvider
 * const provider: FrameProvider = new VideoFileProvider('shot.mp4');
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   // Process frame
 *   frame = await provider.getNextFrame();
 * }
 * ```
 *
 * @remarks
 * Implementations should handle variable frame rate videos by normalizing
 * timestamps to consistent timing based on the reported fps.
 *
 * For live streams, the duration in metadata should be undefined.
 */
export interface FrameProvider {
    /**
     * Retrieves the next frame from the video source.
     *
     * Returns frames sequentially, starting from frame index 0.
     * Each call advances to the next frame in the sequence.
     *
     * @returns A promise that resolves to the next VideoFrame,
     *          or null when all frames have been consumed (end of video)
     *          or the stream has ended.
     *
     * @example
     * ```typescript
     * const frame = await provider.getNextFrame();
     * if (frame !== null) {
     *   console.log(`Frame ${frame.frameIndex} at ${frame.timestamp}ms`);
     * } else {
     *   console.log('End of video');
     * }
     * ```
     */
    getNextFrame(): Promise<VideoFrame | null>;
    /**
     * Returns the frame rate of the video source in frames per second.
     *
     * For variable frame rate videos, this returns the average or nominal fps
     * that the provider normalizes to.
     *
     * @returns The frame rate as a positive number greater than zero.
     *
     * @throws {InvalidFpsError} If the underlying source has invalid fps configuration.
     *
     * @example
     * ```typescript
     * const fps = provider.getFps();
     * const frameDuration = 1000 / fps; // milliseconds per frame
     * ```
     */
    getFps(): number;
    /**
     * Returns metadata about the video source.
     *
     * Provides static information about the video dimensions and duration.
     * This information is available before reading any frames.
     *
     * @returns FrameMetadata containing width, height, and optional duration.
     *          Duration is undefined for live streams.
     *
     * @example
     * ```typescript
     * const metadata = provider.getMetadata();
     * console.log(`Video: ${metadata.width}x${metadata.height}`);
     * if (metadata.duration !== undefined) {
     *   console.log(`Duration: ${metadata.duration}ms`);
     * } else {
     *   console.log('Live stream (no duration)');
     * }
     * ```
     */
    getMetadata(): FrameMetadata;
}
//# sourceMappingURL=types.d.ts.map