/**
 * Pose Detector Factory with automatic runtime detection.
 *
 * This module provides a factory function that automatically selects
 * the appropriate pose detector implementation based on the runtime
 * environment (Node.js vs browser).
 *
 * @example
 * ```typescript
 * // Auto-detect runtime
 * const detector = await createPoseDetector();
 *
 * // Explicit runtime selection
 * const nodeDetector = await createPoseDetector({ runtime: 'node' });
 * const browserDetector = await createPoseDetector({ runtime: 'browser' });
 *
 * // With configuration
 * const configuredDetector = await createPoseDetector({
 *   runtime: 'auto',
 *   modelComplexity: 2,
 *   minDetectionConfidence: 0.6,
 * });
 * ```
 */
import { createMediaPipeNodeDetector } from "./mediapipe-node";
import { createMediaPipeBrowserDetector, RuntimeDelegate, WebGLFallbackBehavior, } from "./mediapipe-browser";
/**
 * Error thrown when an unknown runtime is specified.
 */
export class UnknownRuntimeError extends Error {
    runtime;
    constructor(runtime) {
        super(`Unknown runtime "${runtime}". Supported runtimes are: 'node', 'browser', 'auto'.`);
        this.name = "UnknownRuntimeError";
        this.runtime = runtime;
    }
}
/**
 * Detects the current runtime environment.
 *
 * Uses the presence of the `window` global to determine if running
 * in a browser or Node.js environment.
 *
 * @returns 'browser' if window is defined, 'node' otherwise
 */
export function detectRuntime() {
    return typeof window !== "undefined" ? "browser" : "node";
}
/**
 * Creates a pose detector with automatic runtime detection.
 *
 * This factory function creates the appropriate PoseDetector implementation
 * based on the runtime environment. By default, it auto-detects whether
 * to use the Node.js or browser implementation.
 *
 * @param config - Configuration options including runtime selection
 * @returns Promise resolving to an initialized PoseDetector
 *
 * @throws {UnknownRuntimeError} If an invalid runtime is specified
 * @throws {ModelNotFoundError} If the model file cannot be found
 * @throws {WasmInitializationError} If WASM runtime fails to initialize
 * @throws {ModelCreationError} If model creation fails
 * @throws {WebGLNotAvailableError} If GPU delegate requested with ERROR fallback and WebGL unavailable (browser only)
 *
 * @example
 * ```typescript
 * // Auto-detect runtime (recommended for library code)
 * const detector = await createPoseDetector();
 *
 * // Explicit Node.js runtime
 * const nodeDetector = await createPoseDetector({ runtime: 'node' });
 *
 * // Explicit browser runtime with VIDEO mode
 * const browserDetector = await createPoseDetector({
 *   runtime: 'browser',
 *   runningMode: 'VIDEO',
 *   delegate: 'GPU',
 * });
 *
 * // Custom model configuration
 * const customDetector = await createPoseDetector({
 *   modelComplexity: 2,
 *   minDetectionConfidence: 0.7,
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
export async function createPoseDetector(config = {}) {
    const { runtime = "auto", ...restConfig } = config;
    // Determine the actual runtime to use
    const actualRuntime = runtime === "auto" ? detectRuntime() : runtime;
    switch (actualRuntime) {
        case "node": {
            // Extract only Node.js compatible options (omit undefined values)
            const nodeConfig = {};
            if (restConfig.modelPath !== undefined) {
                nodeConfig.modelPath = restConfig.modelPath;
            }
            if (restConfig.modelComplexity !== undefined) {
                nodeConfig.modelComplexity = restConfig.modelComplexity;
            }
            if (restConfig.minDetectionConfidence !== undefined) {
                nodeConfig.minDetectionConfidence = restConfig.minDetectionConfidence;
            }
            if (restConfig.minTrackingConfidence !== undefined) {
                nodeConfig.minTrackingConfidence = restConfig.minTrackingConfidence;
            }
            if (restConfig.minPresenceConfidence !== undefined) {
                nodeConfig.minPresenceConfidence = restConfig.minPresenceConfidence;
            }
            return createMediaPipeNodeDetector(nodeConfig);
        }
        case "browser": {
            // Extract browser-compatible options including browser-specific ones (omit undefined values)
            const browserConfig = {};
            if (restConfig.modelPath !== undefined) {
                browserConfig.modelPath = restConfig.modelPath;
            }
            if (restConfig.modelComplexity !== undefined) {
                browserConfig.modelComplexity = restConfig.modelComplexity;
            }
            if (restConfig.minDetectionConfidence !== undefined) {
                browserConfig.minDetectionConfidence =
                    restConfig.minDetectionConfidence;
            }
            if (restConfig.minTrackingConfidence !== undefined) {
                browserConfig.minTrackingConfidence = restConfig.minTrackingConfidence;
            }
            if (restConfig.minPresenceConfidence !== undefined) {
                browserConfig.minPresenceConfidence = restConfig.minPresenceConfidence;
            }
            if (restConfig.runningMode !== undefined) {
                browserConfig.runningMode = restConfig.runningMode;
            }
            if (restConfig.delegate !== undefined) {
                browserConfig.delegate =
                    restConfig.delegate === "GPU"
                        ? RuntimeDelegate.GPU
                        : RuntimeDelegate.CPU;
            }
            if (restConfig.webglFallback !== undefined) {
                browserConfig.webglFallback =
                    restConfig.webglFallback === "AUTO"
                        ? WebGLFallbackBehavior.AUTO
                        : WebGLFallbackBehavior.ERROR;
            }
            return createMediaPipeBrowserDetector(browserConfig);
        }
        default:
            throw new UnknownRuntimeError(actualRuntime);
    }
}
//# sourceMappingURL=factory.js.map