/**
 * Type definitions for the test runner infrastructure.
 *
 * This module defines types for test data files (poses.json, labels.json)
 * used to validate shot detection against labeled ground truth.
 *
 * @see Feature 9.0 - Test Runner Infrastructure
 */

import { z } from "zod";

// ============================================================================
// Orientation Types
// ============================================================================

/**
 * Camera orientation relative to the shooter.
 * Used to determine which arm is the shooting arm.
 *
 * 8 orientations covering full 360° around the shooter:
 * - front: Camera facing shooter from the front
 * - front-left: Camera at ~45° from front, shooter's left side
 * - front-right: Camera at ~45° from front, shooter's right side
 * - side-left: Camera at ~90° viewing shooter's left side
 * - side-right: Camera at ~90° viewing shooter's right side
 * - behind-left: Camera at ~135° from front, behind and to the left
 * - behind-right: Camera at ~135° from front, behind and to the right
 * - behind: Camera directly behind the shooter
 */
export type Orientation =
  | "front"
  | "front-left"
  | "front-right"
  | "side-left"
  | "side-right"
  | "behind-left"
  | "behind-right"
  | "behind";

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

// ============================================================================
// Landmark Types
// ============================================================================

/**
 * A single pose landmark from the extracted pose data.
 * Simplified structure compared to MediaPipe's full Landmark type.
 */
export interface TestLandmark {
  /** Normalized X coordinate (0-1) */
  readonly x: number;
  /** Normalized Y coordinate (0-1) */
  readonly y: number;
  /** Relative depth (normalized) */
  readonly z: number;
  /** Visibility score (0-1) */
  readonly visibility: number;
}

/**
 * Zod schema for TestLandmark validation.
 */
export const testLandmarkSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: z.number().min(0).max(1),
});

// ============================================================================
// Frame Types
// ============================================================================

/**
 * A single frame from the extracted pose data.
 */
export interface Frame {
  /** Zero-based frame index */
  readonly frameIndex: number;
  /** Timestamp in seconds */
  readonly timestamp: number;
  /** Overall pose detection confidence (0-1) */
  readonly poseConfidence: number;
  /** Array of 33 MediaPipe pose landmarks, or null if no pose was detected */
  readonly landmarks: readonly TestLandmark[] | null;
}

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

// ============================================================================
// Pose Data Types
// ============================================================================

/**
 * Complete pose data extracted from a video file.
 * Corresponds to the structure of poses.json files.
 */
export interface PoseData {
  /** Original video filename */
  readonly video: string;
  /** Video frames per second */
  readonly fps: number;
  /** Total number of frames in the video */
  readonly totalFrames: number;
  /** Video width in pixels */
  readonly width: number;
  /** Video height in pixels */
  readonly height: number;
  /** ISO timestamp of when poses were extracted */
  readonly extractedAt: string;
  /** Array of frame data with pose landmarks */
  readonly frames: readonly Frame[];
}

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

// ============================================================================
// Keyframe Types
// ============================================================================

/**
 * Identifiers for each keyframe in a basketball shot.
 * These match the phase-based breakdown in metrics-by-phase.md.
 *
 * Phases and their keyframes:
 * - Load: legs_start_bending, leg_bend_low_point, ball_low_point
 * - Rise: legs_start_extending, ball_starts_upward
 * - Set Point: set_point
 * - Release: release, arms_fully_extended
 * - Follow-through: feet_leave_ground, feet_land
 */
export type KeyframeId =
  | "legs_start_bending"
  | "leg_bend_low_point"
  | "ball_low_point"
  | "legs_start_extending"
  | "ball_starts_upward"
  | "set_point"
  | "release"
  | "arms_fully_extended"
  | "feet_leave_ground"
  | "feet_land";

/**
 * All keyframe IDs in chronological order.
 */
export const KEYFRAME_IDS: readonly KeyframeId[] = [
  "legs_start_bending",
  "leg_bend_low_point",
  "ball_low_point",
  "legs_start_extending",
  "ball_starts_upward",
  "set_point",
  "release",
  "arms_fully_extended",
  "feet_leave_ground",
  "feet_land",
] as const;

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

// ============================================================================
// Label Types
// ============================================================================

/**
 * A labeled shot from ground truth data.
 * Includes optional keyframe annotations for detailed shot phase analysis.
 */
export interface LabeledShot {
  /** One-based shot number (for human readability) */
  readonly shotNumber: number;
  /** Starting frame index (inclusive, 0-based) */
  readonly startFrame: number;
  /** Ending frame index (inclusive, 0-based) */
  readonly endFrame: number;
  /** Camera orientation for this specific shot */
  readonly cameraOrientation: Orientation;

  // ---- Keyframe annotations (optional, null if not labeled) ----

  /** Frame where legs start bending (Load phase start) */
  readonly legs_start_bending?: number | null | undefined;
  /** Frame of deepest knee bend */
  readonly leg_bend_low_point?: number | null | undefined;
  /** Frame of lowest ball position (dip) */
  readonly ball_low_point?: number | null | undefined;
  /** Frame where legs begin pushing up (Rise phase start) */
  readonly legs_start_extending?: number | null | undefined;
  /** Frame where ball begins rising */
  readonly ball_starts_upward?: number | null | undefined;
  /** Frame where ball is at peak before release (Set Point) */
  readonly set_point?: number | null | undefined;
  /** Frame where wrist snaps and ball leaves hand (Release) */
  readonly release?: number | null | undefined;
  /** Frame of maximum arm extension */
  readonly arms_fully_extended?: number | null | undefined;
  /** Frame where feet leave ground (if jumping) */
  readonly feet_leave_ground?: number | null | undefined;
  /** Frame where feet land (shot end) */
  readonly feet_land?: number | null | undefined;
}

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
  release: keyframeFieldSchema,
  arms_fully_extended: keyframeFieldSchema,
  feet_leave_ground: keyframeFieldSchema,
  feet_land: keyframeFieldSchema,
});

/**
 * Ground truth label data for a video.
 * Corresponds to the structure of labels.json files.
 *
 * Note: Camera orientation is specified per-shot in LabeledShot.cameraOrientation,
 * allowing videos with multiple shots from different camera angles.
 */
export interface LabelData {
  /** Original video filename */
  readonly video: string;
  /** Who labeled this video */
  readonly labeledBy: string;
  /** ISO timestamp of when labels were created */
  readonly labeledAt: string;
  /** Array of labeled shots (each shot has its own cameraOrientation) */
  readonly shots: readonly LabeledShot[];
}

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
// Test Case Types
// ============================================================================

/**
 * A discovered test case with its data.
 */
export interface TestCase {
  /** Name of the test case (directory name) */
  readonly name: string;
  /** Path to the test case directory */
  readonly path: string;
  /** Loaded pose data */
  readonly poseData: PoseData;
  /** Loaded label data */
  readonly labelData: LabelData;
}

/**
 * Result of test case discovery.
 */
export interface TestCaseDiscoveryResult {
  /** Successfully discovered test cases */
  readonly testCases: readonly TestCase[];
  /** Directories that were skipped (missing required files) */
  readonly skipped: readonly SkippedTestCase[];
  /** Directories with errors (malformed files) */
  readonly errors: readonly TestCaseError[];
}

/**
 * A test case that was skipped due to missing files.
 */
export interface SkippedTestCase {
  /** Directory name */
  readonly name: string;
  /** Reason for skipping */
  readonly reason: "missing-poses" | "missing-labels" | "missing-both";
}

/**
 * A test case that had an error during loading.
 */
export interface TestCaseError {
  /** Directory name */
  readonly name: string;
  /** The file that caused the error */
  readonly file: "poses.json" | "labels.json";
  /** Error message */
  readonly error: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for PoseData.
 */
export function isPoseData(value: unknown): value is PoseData {
  return poseDataSchema.safeParse(value).success;
}

/**
 * Type guard for LabelData.
 */
export function isLabelData(value: unknown): value is LabelData {
  return labelDataSchema.safeParse(value).success;
}
