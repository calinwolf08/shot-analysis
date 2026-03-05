/**
 * PoseDetector interface for detecting body poses in video frames.
 *
 * This module defines the interface for pose detection implementations.
 * Implementations can use MediaPipe Pose Landmarker or other pose detection systems.
 */
import type { VideoFrame } from "../providers/types";
import type { PoseDetectionResult } from "./types";
/**
 * Error thrown when pose detection fails due to an internal error.
 */
export declare class PoseDetectionError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when the detector is used after being closed.
 */
export declare class DetectorClosedError extends Error {
    constructor();
}
/**
 * Interface for pose detection on video frames.
 *
 * Implementations of this interface detect body poses in video frames
 * and return normalized landmark positions with confidence scores.
 *
 * @example
 * ```typescript
 * const detector: PoseDetector = await createMediaPipeDetector();
 *
 * const frame = await provider.getNextFrame();
 * if (frame) {
 *   const result = await detector.detect(frame);
 *   if (result) {
 *     console.log(`Pose detected with ${result.poseConfidence} confidence`);
 *   } else {
 *     console.log('No pose detected in frame');
 *   }
 * }
 *
 * await detector.close();
 * ```
 *
 * @remarks
 * - Implementations should return null when no pose is detected
 * - Landmark coordinates are normalized to 0-1 range relative to frame dimensions
 * - The close() method must be called to release resources when done
 */
export interface PoseDetector {
    /**
     * Detects body pose landmarks in a video frame.
     *
     * Analyzes the provided frame and extracts 33 body landmarks
     * following the MediaPipe Pose Landmarker specification.
     *
     * @param frame - The video frame to analyze
     * @returns A promise resolving to PoseLandmarks if a pose is detected,
     *          or null if no pose is detected in the frame
     *
     * @throws {PoseDetectionError} If pose detection fails due to an internal error
     * @throws {DetectorClosedError} If called after close() has been called
     *
     * @example
     * ```typescript
     * const result = await detector.detect(frame);
     * if (result) {
     *   const leftShoulder = result.landmarks[11]; // LANDMARK_INDEX.LEFT_SHOULDER
     *   console.log(`Left shoulder at (${leftShoulder.x}, ${leftShoulder.y})`);
     * }
     * ```
     */
    detect(frame: VideoFrame): Promise<PoseDetectionResult>;
    /**
     * Releases resources used by the detector.
     *
     * Must be called when the detector is no longer needed to free
     * memory and other resources. After calling close(), the detector
     * should not be used again.
     *
     * @returns A promise that resolves when cleanup is complete
     *
     * @throws {DetectorClosedError} If called more than once
     *
     * @example
     * ```typescript
     * try {
     *   // Use detector...
     * } finally {
     *   await detector.close();
     * }
     * ```
     */
    close(): Promise<void>;
}
//# sourceMappingURL=detector.d.ts.map