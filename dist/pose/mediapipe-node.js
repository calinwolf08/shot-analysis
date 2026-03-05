/**
 * MediaPipe Node.js implementation for pose detection.
 *
 * This module provides a PoseDetector implementation using MediaPipe's
 * Pose Landmarker for server-side and CLI video analysis.
 *
 * @see https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
import { FilesetResolver, PoseLandmarker, } from "@mediapipe/tasks-vision";
import { DetectorClosedError, PoseDetectionError } from "./detector";
import { TOTAL_LANDMARKS } from "./types";
/**
 * Base URL for MediaPipe pose landmarker models.
 */
const MEDIAPIPE_MODEL_BASE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";
/**
 * Model paths for each complexity level.
 * - 0: Lite model - fastest, lower accuracy
 * - 1: Full model - balanced speed/accuracy
 * - 2: Heavy model - slowest, highest accuracy
 */
export const MODEL_PATHS = {
    0: `${MEDIAPIPE_MODEL_BASE_URL}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    1: `${MEDIAPIPE_MODEL_BASE_URL}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
    2: `${MEDIAPIPE_MODEL_BASE_URL}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`,
};
/**
 * Default path to the MediaPipe pose landmarker model.
 * Uses the full model (complexity 1) for best balance of speed and accuracy.
 */
export const DEFAULT_MODEL_PATH = MODEL_PATHS[1];
/**
 * Error thrown when the model file cannot be found or loaded.
 */
export class ModelNotFoundError extends Error {
    modelPath;
    constructor(modelPath) {
        super(`Model file not found or failed to load: ${modelPath}`);
        this.name = "ModelNotFoundError";
        this.modelPath = modelPath;
    }
}
/**
 * Error thrown when MediaPipe WASM runtime fails to initialize.
 */
export class WasmInitializationError extends Error {
    originalError;
    constructor(message, originalError) {
        super(message);
        this.name = "WasmInitializationError";
        this.originalError = originalError;
    }
}
/**
 * Error thrown when model creation fails due to configuration issues.
 */
export class ModelCreationError extends Error {
    originalError;
    constructor(message, originalError) {
        super(message);
        this.name = "ModelCreationError";
        this.originalError = originalError;
    }
}
/**
 * MediaPipe-based pose detector for Node.js environments.
 *
 * This class implements the PoseDetector interface using MediaPipe's
 * Pose Landmarker. It detects 33 body landmarks from video frames.
 *
 * @example
 * ```typescript
 * const detector = await createMediaPipeNodeDetector({
 *   modelComplexity: 1,
 *   minDetectionConfidence: 0.6,
 * });
 *
 * const frame = await provider.getNextFrame();
 * if (frame) {
 *   const result = await detector.detect(frame);
 *   if (result) {
 *     console.log('Pose detected:', result.poseConfidence);
 *   }
 * }
 *
 * await detector.close();
 * ```
 */
export class MediaPipeNodeDetector {
    landmarker;
    closed = false;
    /**
     * Private constructor. Use createMediaPipeNodeDetector() factory function.
     */
    constructor(landmarker) {
        this.landmarker = landmarker;
    }
    /**
     * Creates a new MediaPipeNodeDetector instance.
     *
     * @param config - Configuration options
     * @returns Promise resolving to initialized detector
     * @throws {ModelNotFoundError} If the model file cannot be found
     * @throws {WasmInitializationError} If WASM runtime fails to initialize
     * @throws {ModelCreationError} If model creation fails for other reasons
     * @internal
     */
    static async create(config = {}) {
        const { modelComplexity = 1, minDetectionConfidence = 0.5, minTrackingConfidence = 0.5, minPresenceConfidence = 0.5, } = config;
        // Use explicit modelPath if provided, otherwise select based on complexity
        const modelPath = config.modelPath ?? MODEL_PATHS[modelComplexity];
        let vision;
        try {
            vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        }
        catch (error) {
            throw new WasmInitializationError(`Failed to initialize MediaPipe WASM runtime: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
        let landmarker;
        try {
            landmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: modelPath,
                },
                runningMode: "IMAGE",
                numPoses: 1,
                minPoseDetectionConfidence: minDetectionConfidence,
                minTrackingConfidence: minTrackingConfidence,
                minPosePresenceConfidence: minPresenceConfidence,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Check for model-not-found indicators in the error message
            if (errorMessage.includes("404") ||
                errorMessage.includes("not found") ||
                errorMessage.includes("Failed to load") ||
                errorMessage.includes("Failed to fetch") ||
                errorMessage.includes("ENOENT") ||
                errorMessage.includes("no such file")) {
                throw new ModelNotFoundError(modelPath);
            }
            // For other errors (invalid config, WASM issues, etc.)
            throw new ModelCreationError(`Failed to create pose landmarker: ${errorMessage}`, error instanceof Error ? error : undefined);
        }
        return new MediaPipeNodeDetector(landmarker);
    }
    /**
     * Detects body pose landmarks in a video frame.
     *
     * @param frame - The video frame to analyze
     * @returns Promise resolving to PoseLandmarks or null if no pose detected
     * @throws {DetectorClosedError} If called after close()
     * @throws {PoseDetectionError} If detection fails
     */
    async detect(frame) {
        if (this.closed) {
            throw new DetectorClosedError();
        }
        // Create ImageData-like object for MediaPipe
        const imageData = {
            data: frame.data,
            width: frame.width,
            height: frame.height,
        };
        let result;
        try {
            result = this.landmarker.detect(imageData);
        }
        catch (error) {
            throw new PoseDetectionError(`Pose detection failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        // No pose detected
        if (!result.landmarks || result.landmarks.length === 0) {
            return null;
        }
        // Use first detected pose
        const poseLandmarks = result.landmarks[0];
        if (!poseLandmarks) {
            return null;
        }
        // Convert to our Landmark format
        const landmarks = poseLandmarks.map((lm) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z,
            visibility: lm.visibility ?? 0,
            confidence: lm.visibility ?? 0, // Use visibility as confidence
        }));
        // Ensure we have exactly TOTAL_LANDMARKS
        while (landmarks.length < TOTAL_LANDMARKS) {
            landmarks.push({
                x: 0,
                y: 0,
                z: 0,
                visibility: 0,
                confidence: 0,
            });
        }
        // Calculate overall pose confidence as average of landmark visibilities
        const poseConfidence = landmarks.reduce((sum, lm) => sum + lm.visibility, 0) / TOTAL_LANDMARKS;
        const poseLandmarksResult = {
            landmarks,
            poseConfidence,
        };
        return poseLandmarksResult;
    }
    /**
     * Releases resources used by the detector.
     *
     * @throws {DetectorClosedError} If called more than once
     */
    async close() {
        if (this.closed) {
            throw new DetectorClosedError();
        }
        this.closed = true;
        this.landmarker.close();
    }
}
/**
 * Creates a new MediaPipeNodeDetector instance.
 *
 * Factory function for creating initialized pose detectors.
 * Handles async initialization including model loading.
 *
 * @param config - Configuration options for the detector
 * @returns Promise resolving to an initialized PoseDetector
 * @throws {ModelNotFoundError} If the model file cannot be found
 * @throws {PoseDetectionError} If initialization fails
 *
 * @example
 * ```typescript
 * const detector = await createMediaPipeNodeDetector({
 *   modelComplexity: 1,
 *   minDetectionConfidence: 0.6,
 * });
 *
 * try {
 *   const result = await detector.detect(frame);
 *   // Process result...
 * } finally {
 *   await detector.close();
 * }
 * ```
 */
export async function createMediaPipeNodeDetector(config = {}) {
    return MediaPipeNodeDetector.create(config);
}
//# sourceMappingURL=mediapipe-node.js.map