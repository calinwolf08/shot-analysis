/**
 * PoseDetector interface for detecting body poses in video frames.
 *
 * This module defines the interface for pose detection implementations.
 * Implementations can use MediaPipe Pose Landmarker or other pose detection systems.
 */
/**
 * Error thrown when pose detection fails due to an internal error.
 */
export class PoseDetectionError extends Error {
    constructor(message) {
        super(message);
        this.name = "PoseDetectionError";
    }
}
/**
 * Error thrown when the detector is used after being closed.
 */
export class DetectorClosedError extends Error {
    constructor() {
        super("Cannot use detector after it has been closed.");
        this.name = "DetectorClosedError";
    }
}
//# sourceMappingURL=detector.js.map