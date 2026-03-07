/**
 * Browser-based video element frame provider.
 *
 * This provider extracts frames from video files loaded into an HTML video element.
 * It uses a canvas to capture frame data, making it suitable for browser environments.
 *
 * @example
 * ```typescript
 * // Create from a File object (from file input)
 * const file = fileInput.files[0];
 * const provider = await createVideoElementProvider(file);
 *
 * // Or create from a video URL
 * const provider = await createVideoElementProvider('/videos/shot.mp4');
 *
 * // Use like any other FrameProvider
 * const analyzer = await createShotAnalyzer(config);
 * const result = await analyzer.analyzeVideo(provider);
 * ```
 */
import type { FrameProvider, VideoFrame, FrameMetadata } from "./types";
/**
 * Error thrown when the video cannot be loaded.
 */
export declare class VideoLoadError extends Error {
    constructor(message: string);
}
/**
 * Options for creating a VideoElementProvider.
 */
export interface VideoElementProviderOptions {
    /**
     * Target frames per second for frame extraction.
     * Default: auto-detect from video metadata, or 30 if unknown.
     */
    fps?: number;
}
/**
 * Frame provider that extracts frames from an HTML video element.
 *
 * This provider is designed for browser environments where video files
 * are loaded from user uploads or URLs. It uses a canvas element to
 * capture RGBA frame data at the specified frame rate.
 */
export declare class VideoElementProvider implements FrameProvider {
    private video;
    private canvas;
    private ctx;
    private currentFrame;
    private totalFrames;
    private frameDuration;
    private _fps;
    private _metadata;
    private constructor();
    /**
     * Creates a VideoElementProvider from a video source.
     *
     * @param source - A File object, Blob, or URL string pointing to the video
     * @param options - Optional configuration for frame extraction
     * @returns A promise that resolves to the initialized provider
     * @throws {VideoLoadError} If the video cannot be loaded
     */
    static create(source: File | Blob | string, options?: VideoElementProviderOptions): Promise<VideoElementProvider>;
    /**
     * Retrieves the next frame from the video.
     *
     * @returns The next frame, or null if all frames have been extracted
     */
    getNextFrame(): Promise<VideoFrame | null>;
    /**
     * Returns the frames per second of the video.
     */
    getFps(): number;
    /**
     * Returns metadata about the video.
     */
    getMetadata(): FrameMetadata;
    /**
     * Returns the total number of frames in the video.
     */
    getTotalFrames(): number;
    /**
     * Resets the provider to the beginning of the video.
     */
    reset(): Promise<void>;
    /**
     * Releases resources held by this provider.
     */
    dispose(): void;
}
/**
 * Creates a VideoElementProvider from a video source.
 *
 * This is a convenience function for creating a VideoElementProvider.
 *
 * @param source - A File object, Blob, or URL string pointing to the video
 * @param options - Optional configuration for frame extraction
 * @returns A promise that resolves to the initialized provider
 */
export declare function createVideoElementProvider(source: File | Blob | string, options?: VideoElementProviderOptions): Promise<VideoElementProvider>;
//# sourceMappingURL=video-element.d.ts.map