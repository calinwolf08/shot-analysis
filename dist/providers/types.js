/**
 * Type definitions for frame providers in the basketball shot analysis module.
 *
 * This module defines the FrameProvider interface and related types for
 * abstracting video frame sources. Implementations can support both video
 * files (Node.js) and live camera streams (browser).
 */
/**
 * Error thrown when a FrameProvider is configured with invalid fps.
 */
export class InvalidFpsError extends Error {
    constructor(fps) {
        super(`Invalid fps value: ${fps}. FPS must be a positive number greater than zero.`);
        this.name = 'InvalidFpsError';
    }
}
//# sourceMappingURL=types.js.map