/**
 * Type definitions for the test runner infrastructure.
 *
 * This module defines types for test data files (poses.json, labels.json)
 * used to validate shot detection against labeled ground truth.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */
import { z } from "zod";
/**
 * Zod schema for Orientation validation.
 */
export const orientationSchema = z.enum([
    "front",
    "front-left",
    "front-right",
    "side-left",
    "side-right",
    "behind-left",
    "behind-right",
    "behind",
]);
/**
 * Zod schema for TestLandmark validation.
 */
export const testLandmarkSchema = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    visibility: z.number().min(0).max(1),
});
/**
 * Zod schema for Frame validation.
 * Note: landmarks can be null when no pose was detected in the frame.
 */
export const frameSchema = z.object({
    frameIndex: z.number().int().nonnegative(),
    timestamp: z.number().nonnegative(),
    poseConfidence: z.number().min(0).max(1),
    landmarks: z.array(testLandmarkSchema).nullable(),
});
/**
 * Zod schema for PoseData validation.
 */
export const poseDataSchema = z.object({
    video: z.string().min(1),
    fps: z.number().positive(),
    totalFrames: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    extractedAt: z.string(),
    frames: z.array(frameSchema),
});
/**
 * Zod schema for LabeledShot validation.
 */
export const labeledShotSchema = z.object({
    shotNumber: z.number().int().positive(),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().nonnegative(),
    cameraOrientation: orientationSchema,
});
/**
 * Zod schema for LabelData validation.
 */
export const labelDataSchema = z.object({
    video: z.string().min(1),
    labeledBy: z.string(),
    labeledAt: z.string(),
    shots: z.array(labeledShotSchema),
});
// ============================================================================
// Type Guards
// ============================================================================
/**
 * Type guard for PoseData.
 */
export function isPoseData(value) {
    return poseDataSchema.safeParse(value).success;
}
/**
 * Type guard for LabelData.
 */
export function isLabelData(value) {
    return labelDataSchema.safeParse(value).success;
}
//# sourceMappingURL=types.js.map