/**
 * Media stream provider for the basketball shot analysis module.
 *
 * This module provides a FrameProvider implementation that extracts frames
 * from live MediaStream sources (browser camera feeds).
 *
 * Browser-only implementation using canvas for frame extraction.
 *
 * ## Known Limitations
 *
 * - Requires browser environment with HTMLVideoElement and Canvas2D support
 * - Frame rate limiting is approximate due to browser event loop timing
 * - Memory management relies on garbage collection of canvas ImageData objects
 *
 * ## Future Improvements
 *
 * - Add OffscreenCanvas support for web worker frame extraction
 * - Implement adaptive frame rate based on processing speed
 * - Add WebCodecs API support for more efficient video decoding
 */
import type { FrameProvider, VideoFrame, FrameMetadata } from "./types";
/**
 * Error thrown when the media stream has ended unexpectedly.
 */
export declare class MediaStreamEndedError extends Error {
    constructor();
}
/**
 * Error thrown when the media stream is inactive.
 */
export declare class MediaStreamInactiveError extends Error {
    constructor();
}
/**
 * Error thrown when the media stream has no video track.
 */
export declare class NoVideoTrackError extends Error {
    constructor();
}
/**
 * Options for creating a MediaStreamProvider.
 */
export interface MediaStreamProviderOptions {
    /**
     * Target frame rate for frame extraction.
     * If not specified, uses the stream's native frame rate.
     */
    fps?: number;
}
/**
 * FrameProvider implementation for browser MediaStream sources.
 *
 * Extracts frames from live camera feeds using canvas-based capture.
 * Supports configurable frame rate limiting to reduce CPU usage.
 *
 * @example
 * ```typescript
 * const stream = await navigator.mediaDevices.getUserMedia({ video: true });
 * const provider = await createMediaStreamProvider(stream, { fps: 30 });
 *
 * const metadata = provider.getMetadata();
 * console.log(`Video: ${metadata.width}x${metadata.height}`);
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   // Process frame
 *   frame = await provider.getNextFrame();
 * }
 *
 * provider.dispose();
 * ```
 */
export declare class MediaStreamProvider implements FrameProvider {
    private readonly stream;
    private readonly videoElement;
    private readonly context;
    private readonly fps;
    private readonly frameInterval;
    private readonly width;
    private readonly height;
    private currentFrameIndex;
    private disposed;
    private streamEnded;
    /**
     * Private constructor. Use createMediaStreamProvider() factory function.
     */
    private constructor();
    /**
     * Handler for stream ended event.
     */
    private handleStreamEnded;
    /**
     * Creates a MediaStreamProvider from a browser MediaStream.
     *
     * @param stream - MediaStream from getUserMedia() or other source
     * @param options - Optional configuration options
     * @returns Promise resolving to a MediaStreamProvider instance
     * @throws {MediaStreamInactiveError} If the stream is inactive
     * @throws {NoVideoTrackError} If the stream has no video track
     */
    static create(stream: MediaStream, options?: MediaStreamProviderOptions): Promise<MediaStreamProvider>;
    /**
     * Retrieves the next frame from the stream.
     *
     * @returns Promise resolving to the next VideoFrame, or null when stream ends
     */
    getNextFrame(): Promise<VideoFrame | null>;
    /**
     * Returns the target frame rate in frames per second.
     *
     * @returns Frame rate as a positive number
     */
    getFps(): number;
    /**
     * Returns metadata about the video stream.
     *
     * @returns FrameMetadata with width, height (no duration for live streams)
     */
    getMetadata(): FrameMetadata;
    /**
     * Returns the frame interval in milliseconds.
     * Used for frame rate limiting calculations.
     *
     * @returns Frame interval in milliseconds
     */
    getFrameInterval(): number;
    /**
     * Disposes of the provider and releases resources.
     * After calling dispose(), getNextFrame() will return null.
     */
    dispose(): void;
}
/**
 * Factory function to create a MediaStreamProvider from a browser MediaStream.
 *
 * @param stream - MediaStream from getUserMedia() or other source
 * @param options - Optional configuration options
 * @returns Promise resolving to a MediaStreamProvider instance
 * @throws {MediaStreamInactiveError} If the stream is inactive
 * @throws {NoVideoTrackError} If the stream has no video track
 *
 * @example
 * ```typescript
 * const stream = await navigator.mediaDevices.getUserMedia({ video: true });
 * const provider = await createMediaStreamProvider(stream, { fps: 30 });
 *
 * let frame = await provider.getNextFrame();
 * while (frame !== null) {
 *   console.log(`Processing frame ${frame.frameIndex}`);
 *   frame = await provider.getNextFrame();
 * }
 *
 * provider.dispose();
 * ```
 */
export declare function createMediaStreamProvider(stream: MediaStream, options?: MediaStreamProviderOptions): Promise<MediaStreamProvider>;
//# sourceMappingURL=media-stream.d.ts.map