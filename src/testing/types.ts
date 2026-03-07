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
 */
export type Orientation =
  | "front"
  | "side-left"
  | "side-right"
  | "front-left"
  | "front-right";

/**
 * Zod schema for Orientation validation.
 */
export const orientationSchema = z.enum([
  "front",
  "side-left",
  "side-right",
  "front-left",
  "front-right",
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
  /** Array of 33 MediaPipe pose landmarks */
  readonly landmarks: readonly TestLandmark[];
}

/**
 * Zod schema for Frame validation.
 */
export const frameSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  timestamp: z.number().nonnegative(),
  poseConfidence: z.number().min(0).max(1),
  landmarks: z.array(testLandmarkSchema),
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
// Label Types
// ============================================================================

/**
 * A labeled shot from ground truth data.
 */
export interface LabeledShot {
  /** One-based shot number (for human readability) */
  readonly shotNumber: number;
  /** Starting frame index (inclusive, 0-based) */
  readonly startFrame: number;
  /** Ending frame index (inclusive, 0-based) */
  readonly endFrame: number;
}

/**
 * Zod schema for LabeledShot validation.
 */
export const labeledShotSchema = z.object({
  shotNumber: z.number().int().positive(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});

/**
 * Ground truth label data for a video.
 * Corresponds to the structure of labels.json files.
 */
export interface LabelData {
  /** Original video filename */
  readonly video: string;
  /** Who labeled this video */
  readonly labeledBy: string;
  /** ISO timestamp of when labels were created */
  readonly labeledAt: string;
  /** Camera orientation relative to shooter */
  readonly orientation: Orientation;
  /** Array of labeled shots */
  readonly shots: readonly LabeledShot[];
}

/**
 * Zod schema for LabelData validation.
 */
export const labelDataSchema = z.object({
  video: z.string().min(1),
  labeledBy: z.string(),
  labeledAt: z.string(),
  orientation: orientationSchema,
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
