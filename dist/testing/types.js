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
 * All keyframe IDs in chronological order.
 */
export const KEYFRAME_IDS = [
    "legs_start_bending",
    "leg_bend_low_point",
    "ball_low_point",
    "legs_start_extending",
    "ball_starts_upward",
    "set_point",
    "legs_fully_extended",
    "release",
    "arms_fully_extended",
    "feet_leave_ground",
    "feet_land",
];
/**
 * Zod schema for keyframe frame number validation.
 * Keyframe fields are optional and can be null (not labeled) or a non-negative integer.
 */
export const keyframeFieldSchema = z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional();
/**
 * Zod schema for LabeledShot validation.
 * Keyframe fields are optional for backward compatibility with legacy labels.
 */
export const labeledShotSchema = z.object({
    shotNumber: z.number().int().positive(),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().nonnegative(),
    cameraOrientation: orientationSchema,
    // Keyframe fields (optional, null if not labeled)
    legs_start_bending: keyframeFieldSchema,
    leg_bend_low_point: keyframeFieldSchema,
    ball_low_point: keyframeFieldSchema,
    legs_start_extending: keyframeFieldSchema,
    ball_starts_upward: keyframeFieldSchema,
    set_point: keyframeFieldSchema,
    legs_fully_extended: keyframeFieldSchema,
    release: keyframeFieldSchema,
    arms_fully_extended: keyframeFieldSchema,
    feet_leave_ground: keyframeFieldSchema,
    feet_land: keyframeFieldSchema,
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