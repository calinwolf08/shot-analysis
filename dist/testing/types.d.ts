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
 * Camera orientation relative to the shooter.
 * Used to determine which arm is the shooting arm.
 */
export type Orientation = "front" | "side-left" | "side-right" | "front-left" | "front-right";
/**
 * Zod schema for Orientation validation.
 */
export declare const orientationSchema: z.ZodEnum<["front", "side-left", "side-right", "front-left", "front-right"]>;
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
export declare const testLandmarkSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    z: z.ZodNumber;
    visibility: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    z: number;
    visibility: number;
}, {
    x: number;
    y: number;
    z: number;
    visibility: number;
}>;
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
export declare const frameSchema: z.ZodObject<{
    frameIndex: z.ZodNumber;
    timestamp: z.ZodNumber;
    poseConfidence: z.ZodNumber;
    landmarks: z.ZodArray<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        z: z.ZodNumber;
        visibility: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        z: number;
        visibility: number;
    }, {
        x: number;
        y: number;
        z: number;
        visibility: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    frameIndex: number;
    timestamp: number;
    poseConfidence: number;
    landmarks: {
        x: number;
        y: number;
        z: number;
        visibility: number;
    }[];
}, {
    frameIndex: number;
    timestamp: number;
    poseConfidence: number;
    landmarks: {
        x: number;
        y: number;
        z: number;
        visibility: number;
    }[];
}>;
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
export declare const poseDataSchema: z.ZodObject<{
    video: z.ZodString;
    fps: z.ZodNumber;
    totalFrames: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    extractedAt: z.ZodString;
    frames: z.ZodArray<z.ZodObject<{
        frameIndex: z.ZodNumber;
        timestamp: z.ZodNumber;
        poseConfidence: z.ZodNumber;
        landmarks: z.ZodArray<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            z: z.ZodNumber;
            visibility: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            z: number;
            visibility: number;
        }, {
            x: number;
            y: number;
            z: number;
            visibility: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        frameIndex: number;
        timestamp: number;
        poseConfidence: number;
        landmarks: {
            x: number;
            y: number;
            z: number;
            visibility: number;
        }[];
    }, {
        frameIndex: number;
        timestamp: number;
        poseConfidence: number;
        landmarks: {
            x: number;
            y: number;
            z: number;
            visibility: number;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    video: string;
    fps: number;
    totalFrames: number;
    width: number;
    height: number;
    extractedAt: string;
    frames: {
        frameIndex: number;
        timestamp: number;
        poseConfidence: number;
        landmarks: {
            x: number;
            y: number;
            z: number;
            visibility: number;
        }[];
    }[];
}, {
    video: string;
    fps: number;
    totalFrames: number;
    width: number;
    height: number;
    extractedAt: string;
    frames: {
        frameIndex: number;
        timestamp: number;
        poseConfidence: number;
        landmarks: {
            x: number;
            y: number;
            z: number;
            visibility: number;
        }[];
    }[];
}>;
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
export declare const labeledShotSchema: z.ZodObject<{
    shotNumber: z.ZodNumber;
    startFrame: z.ZodNumber;
    endFrame: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    shotNumber: number;
    startFrame: number;
    endFrame: number;
}, {
    shotNumber: number;
    startFrame: number;
    endFrame: number;
}>;
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
export declare const labelDataSchema: z.ZodObject<{
    video: z.ZodString;
    labeledBy: z.ZodString;
    labeledAt: z.ZodString;
    orientation: z.ZodEnum<["front", "side-left", "side-right", "front-left", "front-right"]>;
    shots: z.ZodArray<z.ZodObject<{
        shotNumber: z.ZodNumber;
        startFrame: z.ZodNumber;
        endFrame: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        shotNumber: number;
        startFrame: number;
        endFrame: number;
    }, {
        shotNumber: number;
        startFrame: number;
        endFrame: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    video: string;
    shots: {
        shotNumber: number;
        startFrame: number;
        endFrame: number;
    }[];
    labeledBy: string;
    labeledAt: string;
    orientation: "front" | "side-left" | "side-right" | "front-left" | "front-right";
}, {
    video: string;
    shots: {
        shotNumber: number;
        startFrame: number;
        endFrame: number;
    }[];
    labeledBy: string;
    labeledAt: string;
    orientation: "front" | "side-left" | "side-right" | "front-left" | "front-right";
}>;
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
/**
 * Type guard for PoseData.
 */
export declare function isPoseData(value: unknown): value is PoseData;
/**
 * Type guard for LabelData.
 */
export declare function isLabelData(value: unknown): value is LabelData;
//# sourceMappingURL=types.d.ts.map