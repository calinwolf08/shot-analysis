/**
 * Pose-based shot boundary detection for basketball shot analysis.
 *
 * This module provides shot detection using biomechanical signals:
 * - Shot start: Knee bend + hip drop (loading phase)
 * - Shot end: Arm extension + landing (follow-through phase)
 * - Orientation: Hip-to-shoulder alignment angle
 *
 * @see Feature 10.0 - Algorithm Iteration
 * @see Task 10.1 - Shot Boundary Detection Algorithm
 */

import type { PoseData, Frame, Orientation } from "../testing/types";
import { LANDMARK_INDEX } from "../pose/types";
import type { Point3D } from "../types";
import { calculateAngle } from "../utils/geometry";
import { movingAverage } from "../utils/smoothing";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for the pose-based shot detector.
 */
export interface PoseShotDetectorConfig {
    /** Minimum knee angle change (degrees) to indicate knee bend. Default: 15 */
    readonly kneeBendThreshold?: number;

    /** Minimum hip Y drop (normalized) to indicate loading. Default: 0.015 */
    readonly hipDropThreshold?: number;

    /** Wrist Y position relative to shoulder for max arm extension. Default: -0.15 */
    readonly armExtensionThreshold?: number;

    /** Minimum shot duration in frames. Default: 15 */
    readonly minShotDuration?: number;

    /** Maximum shot duration in frames. Default: 90 */
    readonly maxShotDuration?: number;

    /** Smoothing window size for position data. Default: 3 */
    readonly smoothingWindowSize?: number;

    /** Minimum pose confidence to consider a frame valid. Default: 0.3 */
    readonly minPoseConfidence?: number;

    /** Number of consecutive frames to confirm a signal. Default: 3 */
    readonly confirmationFrames?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<PoseShotDetectorConfig> = {
    kneeBendThreshold: 15,
    hipDropThreshold: 0.015,
    armExtensionThreshold: -0.15,
    minShotDuration: 15,
    maxShotDuration: 90,
    smoothingWindowSize: 3,
    minPoseConfidence: 0.3,
    confirmationFrames: 3,
};

// ============================================================================
// Types
// ============================================================================

/**
 * A detected shot with frame boundaries.
 */
export interface DetectedShot {
    /** Start frame index (0-based, inclusive) */
    readonly startFrame: number;
    /** End frame index (0-based, inclusive) */
    readonly endFrame: number;
    /** Confidence score for this detection (0-1) */
    readonly confidence: number;
}

/**
 * Result of running detection on pose data.
 */
export interface DetectionResult {
    /** Array of detected shots */
    readonly shots: readonly DetectedShot[];
    /** Detected camera orientation */
    readonly orientation: Orientation | "unknown";
}

/**
 * Internal frame analysis data.
 */
interface FrameAnalysis {
    readonly frameIndex: number;
    readonly leftKneeAngle: number;
    readonly rightKneeAngle: number;
    readonly avgKneeAngle: number;
    readonly hipY: number;
    readonly leftWristY: number;
    readonly rightWristY: number;
    readonly avgWristY: number;
    readonly leftShoulderY: number;
    readonly rightShoulderY: number;
    readonly avgShoulderY: number;
    readonly wristToShoulderDiff: number;
    readonly confidence: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates knee angle from hip-knee-ankle landmarks.
 *
 * The angle is measured at the knee joint, between the hip and ankle.
 * A straight leg has an angle of ~180 degrees.
 * A bent knee has a smaller angle (e.g., 90-120 degrees when squatting).
 *
 * @param hip - Hip landmark position
 * @param knee - Knee landmark position (vertex of the angle)
 * @param ankle - Ankle landmark position
 * @returns Angle in degrees (0-180)
 */
export function calculateKneeAngle(
    hip: Point3D,
    knee: Point3D,
    ankle: Point3D
): number {
    return calculateAngle(hip, knee, ankle);
}

/**
 * Extracts Point3D from a frame landmark at the given index.
 * Returns null if frame has no landmarks or landmark is not visible.
 */
function getLandmarkPoint(frame: Frame, index: number): Point3D | null {
    // Handle frames with null landmarks (no pose detected)
    if (frame.landmarks === null) {
        return null;
    }
    const landmark = frame.landmarks[index];
    if (!landmark || landmark.visibility < 0.3) {
        return null;
    }
    return { x: landmark.x, y: landmark.y, z: landmark.z };
}

/**
 * Analyzes a single frame for shot detection signals.
 */
function analyzeFrame(frame: Frame): FrameAnalysis | null {
    // Get required landmarks
    const leftHip = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_HIP);
    const rightHip = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_HIP);
    const leftKnee = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_KNEE);
    const rightKnee = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_KNEE);
    const leftAnkle = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_ANKLE);
    const rightAnkle = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_ANKLE);
    const leftWrist = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_WRIST);
    const rightWrist = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_WRIST);
    const leftShoulder = getLandmarkPoint(frame, LANDMARK_INDEX.LEFT_SHOULDER);
    const rightShoulder = getLandmarkPoint(frame, LANDMARK_INDEX.RIGHT_SHOULDER);

    // Need at least some key landmarks
    if (!leftHip || !rightHip || !leftWrist || !rightWrist || !leftShoulder || !rightShoulder) {
        return null;
    }

    // Calculate knee angles (use 180 if landmarks not available)
    let leftKneeAngle = 180;
    let rightKneeAngle = 180;

    if (leftHip && leftKnee && leftAnkle) {
        leftKneeAngle = calculateKneeAngle(leftHip, leftKnee, leftAnkle);
    }
    if (rightHip && rightKnee && rightAnkle) {
        rightKneeAngle = calculateKneeAngle(rightHip, rightKnee, rightAnkle);
    }

    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const leftWristY = leftWrist.y;
    const rightWristY = rightWrist.y;
    const avgWristY = (leftWristY + rightWristY) / 2;
    const leftShoulderY = leftShoulder.y;
    const rightShoulderY = rightShoulder.y;
    const avgShoulderY = (leftShoulderY + rightShoulderY) / 2;
    const wristToShoulderDiff = avgWristY - avgShoulderY;

    return {
        frameIndex: frame.frameIndex,
        leftKneeAngle,
        rightKneeAngle,
        avgKneeAngle,
        hipY,
        leftWristY,
        rightWristY,
        avgWristY,
        leftShoulderY,
        rightShoulderY,
        avgShoulderY,
        wristToShoulderDiff,
        confidence: frame.poseConfidence,
    };
}

/**
 * Applies smoothing to frame analysis data.
 */
function smoothFrameAnalysis(
    analyses: (FrameAnalysis | null)[],
    windowSize: number
): FrameAnalysis[] {
    const validAnalyses = analyses.filter((a): a is FrameAnalysis => a !== null);

    if (validAnalyses.length === 0 || windowSize <= 1) {
        return validAnalyses;
    }

    // Extract arrays for smoothing
    const kneeAngles = validAnalyses.map((a) => a.avgKneeAngle);
    const hipYs = validAnalyses.map((a) => a.hipY);
    const wristYs = validAnalyses.map((a) => a.avgWristY);
    const shoulderYs = validAnalyses.map((a) => a.avgShoulderY);

    // Apply smoothing
    const smoothedKneeAngles = movingAverage(kneeAngles, windowSize);
    const smoothedHipYs = movingAverage(hipYs, windowSize);
    const smoothedWristYs = movingAverage(wristYs, windowSize);
    const smoothedShoulderYs = movingAverage(shoulderYs, windowSize);

    // Reconstruct with smoothed values
    return validAnalyses.map((a, i) => ({
        ...a,
        avgKneeAngle: smoothedKneeAngles[i]!,
        hipY: smoothedHipYs[i]!,
        avgWristY: smoothedWristYs[i]!,
        avgShoulderY: smoothedShoulderYs[i]!,
        wristToShoulderDiff: smoothedWristYs[i]! - smoothedShoulderYs[i]!,
    }));
}

// ============================================================================
// Shot Detection Functions
// ============================================================================

/**
 * Detects shot start frame using knee bend + hip drop signals.
 *
 * Shot loading is characterized by:
 * - Knee angle decreasing (knees bending)
 * - Hip Y position increasing (hip dropping down)
 *
 * @param analyses - Array of frame analyses
 * @param config - Detection configuration
 * @returns Frame indices where shot starts are detected
 */
export function detectShotStart(
    analyses: readonly FrameAnalysis[],
    config: Required<PoseShotDetectorConfig>
): number[] {
    const startFrames: number[] = [];

    if (analyses.length < config.confirmationFrames + 1) {
        return startFrames;
    }

    // Track state
    let baselineKneeAngle = analyses[0]?.avgKneeAngle ?? 180;
    let baselineHipY = analyses[0]?.hipY ?? 0.5;
    let inLoadingPhase = false;
    let loadingStartFrame = -1;
    let consecutiveLoadFrames = 0;

    for (let i = 1; i < analyses.length; i++) {
        const current = analyses[i]!;
        const previous = analyses[i - 1]!;

        // Calculate changes from baseline
        const kneeBend = baselineKneeAngle - current.avgKneeAngle;
        const hipDrop = current.hipY - baselineHipY;

        // Check for loading signals (knee bending AND hip dropping)
        const isKneeBending = kneeBend > config.kneeBendThreshold;
        const isHipDropping = hipDrop > config.hipDropThreshold;
        const isLoading = isKneeBending || isHipDropping;

        if (isLoading && !inLoadingPhase) {
            consecutiveLoadFrames++;
            if (consecutiveLoadFrames >= config.confirmationFrames) {
                inLoadingPhase = true;
                loadingStartFrame = current.frameIndex - config.confirmationFrames + 1;
            }
        } else if (!isLoading && inLoadingPhase) {
            // Loading phase ended - check if we're now rising
            const wristRising = current.avgWristY < previous.avgWristY;
            if (wristRising && loadingStartFrame >= 0) {
                startFrames.push(loadingStartFrame);
            }
            // Reset for next potential shot
            inLoadingPhase = false;
            loadingStartFrame = -1;
            consecutiveLoadFrames = 0;
            // Update baseline to current standing position
            baselineKneeAngle = current.avgKneeAngle;
            baselineHipY = current.hipY;
        } else if (!isLoading) {
            consecutiveLoadFrames = 0;
            // Slowly update baseline when not loading
            baselineKneeAngle = 0.9 * baselineKneeAngle + 0.1 * current.avgKneeAngle;
            baselineHipY = 0.9 * baselineHipY + 0.1 * current.hipY;
        }
    }

    return startFrames;
}

/**
 * Detects shot end frame using arm extension + landing signals.
 *
 * Shot completion is characterized by:
 * - Wrist reaching maximum height (minimum Y value)
 * - Knees starting to bend again (landing)
 *
 * @param analyses - Array of frame analyses
 * @param startFrame - Frame index where the shot started
 * @param config - Detection configuration
 * @returns Frame index where shot ends, or -1 if not found
 */
export function detectShotEnd(
    analyses: readonly FrameAnalysis[],
    startFrame: number,
    config: Required<PoseShotDetectorConfig>
): number {
    // Find the frame analysis that corresponds to startFrame
    const startIdx = analyses.findIndex((a) => a.frameIndex >= startFrame);
    if (startIdx < 0) {
        return -1;
    }

    // Track peak wrist position (minimum Y value = highest point)
    let peakWristY = Infinity;
    let peakFrame = startFrame;
    let pastPeak = false;
    let consecutiveLandingFrames = 0;

    for (let i = startIdx; i < analyses.length; i++) {
        const current = analyses[i]!;
        const framesSinceStart = current.frameIndex - startFrame;

        // Enforce maximum shot duration
        if (framesSinceStart > config.maxShotDuration) {
            // Shot too long, end at peak frame
            return peakFrame;
        }

        // Track peak wrist position
        if (current.avgWristY < peakWristY) {
            peakWristY = current.avgWristY;
            peakFrame = current.frameIndex;
            pastPeak = false;
        } else if (current.avgWristY > peakWristY + 0.02) {
            // Wrist is descending
            pastPeak = true;
        }

        // Look for landing signals after the peak
        if (pastPeak && framesSinceStart >= config.minShotDuration) {
            // Check for wrist returning below shoulder level
            const wristReturning = current.wristToShoulderDiff > 0;

            // Check for knee rebend (preparing to land or landed)
            const previous = analyses[i - 1];
            const kneeRebending = previous && current.avgKneeAngle < previous.avgKneeAngle;

            if (wristReturning || kneeRebending) {
                consecutiveLandingFrames++;
                if (consecutiveLandingFrames >= config.confirmationFrames) {
                    return current.frameIndex;
                }
            } else {
                consecutiveLandingFrames = 0;
            }
        }
    }

    // If we reached the end of the video, return the last valid frame
    if (peakFrame > startFrame) {
        return analyses[analyses.length - 1]?.frameIndex ?? -1;
    }

    return -1;
}

/**
 * Detects camera orientation from hip-to-shoulder alignment.
 *
 * Orientation is determined by analyzing the X positions of shoulders and hips:
 * - front: Left landmarks are clearly to the left of right landmarks
 * - side-left: Shooter's left side visible (shoulders aligned, left closer)
 * - side-right: Shooter's right side visible (shoulders aligned, right closer)
 * - front-left: Between front and side-left
 * - front-right: Between front and side-right
 *
 * @param poseData - Pose data to analyze
 * @returns Detected orientation or 'unknown'
 */
export function detectOrientation(poseData: PoseData): Orientation | "unknown" {
    if (poseData.frames.length === 0) {
        return "unknown";
    }

    // Sample frames from the middle of the video (more stable poses)
    const startSample = Math.floor(poseData.frames.length * 0.3);
    const endSample = Math.floor(poseData.frames.length * 0.7);
    const sampleSize = Math.min(10, endSample - startSample);

    if (sampleSize < 3) {
        return "unknown";
    }

    let totalShoulderDiffX = 0;
    let totalHipDiffX = 0;
    let totalShoulderZ = 0;
    let validSamples = 0;

    for (let i = startSample; i < startSample + sampleSize && i < poseData.frames.length; i++) {
        const frame = poseData.frames[i]!;
        const landmarks = frame.landmarks;

        // Skip frames with null landmarks
        if (landmarks === null) {
            continue;
        }

        const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
        const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
        const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
            continue;
        }

        // Check visibility
        const minVisibility = 0.3;
        if (
            leftShoulder.visibility < minVisibility ||
            rightShoulder.visibility < minVisibility ||
            leftHip.visibility < minVisibility ||
            rightHip.visibility < minVisibility
        ) {
            continue;
        }

        // X difference: positive = left is left of right (front view)
        totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
        totalHipDiffX += rightHip.x - leftHip.x;

        // Z difference: which side is closer to camera
        totalShoulderZ += rightShoulder.z - leftShoulder.z;

        validSamples++;
    }

    if (validSamples < 3) {
        return "unknown";
    }

    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgHipDiffX = totalHipDiffX / validSamples;
    const avgZDiff = totalShoulderZ / validSamples;

    // Thresholds for determining orientation
    const frontThreshold = 0.15;
    const sideThreshold = 0.05;

    const shoulderSeparation = Math.abs(avgShoulderDiffX);
    const hipSeparation = Math.abs(avgHipDiffX);
    const avgSeparation = (shoulderSeparation + hipSeparation) / 2;

    if (avgSeparation > frontThreshold) {
        // Good shoulder separation - frontal or front-angled view
        const angleThreshold = 0.05;
        if (avgZDiff > angleThreshold) {
            return "front-left";
        } else if (avgZDiff < -angleThreshold) {
            return "front-right";
        }
        return "front";
    } else if (avgSeparation < sideThreshold) {
        // Shoulders very close in X - side view
        if (avgZDiff > 0) {
            return "side-left";
        } else {
            return "side-right";
        }
    } else {
        // In between - angled view
        if (avgZDiff > 0) {
            return "front-left";
        } else if (avgZDiff < 0) {
            return "front-right";
        }
        return "front";
    }
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects basketball shots in pose data.
 *
 * This is the main entry point for shot detection. It combines signals from:
 * - Knee bend and hip drop for shot start detection
 * - Arm extension and landing for shot end detection
 *
 * @param poseData - Pose data loaded from a poses.json file
 * @param config - Optional configuration overrides
 * @returns Detection result with shots array and orientation
 *
 * @example
 * ```typescript
 * import { detectShots } from './pose-shot-detector';
 * import { loadPoseData } from '../testing/loader';
 *
 * const poseData = loadPoseData('test-data/video1/poses.json');
 * const result = detectShots(poseData.data);
 *
 * for (const shot of result.shots) {
 *   console.log(`Shot: frames ${shot.startFrame}-${shot.endFrame}`);
 * }
 * ```
 */
export function detectShots(
    poseData: PoseData,
    config: PoseShotDetectorConfig = {}
): DetectionResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Analyze all frames
    const rawAnalyses = poseData.frames.map(analyzeFrame);

    // Apply smoothing
    const analyses = smoothFrameAnalysis(rawAnalyses, cfg.smoothingWindowSize);

    // Filter by confidence
    const validAnalyses = analyses.filter((a) => a.confidence >= cfg.minPoseConfidence);

    if (validAnalyses.length < cfg.minShotDuration) {
        return {
            shots: [],
            orientation: detectOrientation(poseData),
        };
    }

    // Use an alternative approach: find wrist peaks and work backwards
    const shots = detectShotsFromPeaks(validAnalyses, cfg);

    return {
        shots,
        orientation: detectOrientation(poseData),
    };
}

/**
 * Alternative detection approach: find wrist height peaks and work backwards.
 *
 * This approach:
 * 1. Finds local minima in wrist Y (peaks in height)
 * 2. For each peak, searches backwards for the shot start (loading phase)
 * 3. For each peak, searches forwards for the shot end (landing)
 */
function detectShotsFromPeaks(
    analyses: readonly FrameAnalysis[],
    config: Required<PoseShotDetectorConfig>
): DetectedShot[] {
    const shots: DetectedShot[] = [];

    // Find wrist Y peaks (local minima since lower Y = higher position)
    const peaks = findWristPeaks(analyses, config.minShotDuration);

    for (const peakIdx of peaks) {
        // Search backwards for shot start
        const startFrame = findShotStartFromPeak(analyses, peakIdx, config);
        if (startFrame < 0) {
            continue;
        }

        // Search forwards for shot end
        const endFrame = findShotEndFromPeak(analyses, peakIdx, config);
        if (endFrame < 0) {
            continue;
        }

        // Validate shot duration
        const duration = endFrame - startFrame;
        if (duration < config.minShotDuration || duration > config.maxShotDuration) {
            continue;
        }

        // Check for overlap with previous shot
        if (shots.length > 0) {
            const lastShot = shots[shots.length - 1]!;
            if (startFrame <= lastShot.endFrame) {
                continue; // Skip overlapping shot
            }
        }

        // Calculate confidence based on peak height and duration
        const confidence = calculateShotConfidence(analyses, startFrame, endFrame, peakIdx);

        shots.push({
            startFrame,
            endFrame,
            confidence,
        });
    }

    return shots;
}

/**
 * Finds local minima in wrist Y position (peaks in height).
 * Uses a sliding window approach to find the minimum in each region.
 */
function findWristPeaks(
    analyses: readonly FrameAnalysis[],
    minDistance: number
): number[] {
    const peaks: number[] = [];

    if (analyses.length < 3) {
        return peaks;
    }

    // Find global minimum first to use as a reference
    let globalMinY = Infinity;
    let globalMinIdx = -1;
    for (let i = 0; i < analyses.length; i++) {
        const curr = analyses[i]!;
        if (curr.avgWristY < globalMinY && curr.wristToShoulderDiff < 0) {
            globalMinY = curr.avgWristY;
            globalMinIdx = i;
        }
    }

    // If we found a global minimum where wrist is above shoulder, it's a peak
    if (globalMinIdx >= 0) {
        peaks.push(globalMinIdx);
    }

    // Also look for local peaks (for multi-shot videos)
    const windowSize = Math.max(5, Math.floor(minDistance / 2));
    for (let i = windowSize; i < analyses.length - windowSize; i++) {
        const curr = analyses[i]!;

        // Skip if not above shoulder
        if (curr.wristToShoulderDiff >= 0) {
            continue;
        }

        // Skip if already found as global minimum
        if (i === globalMinIdx) {
            continue;
        }

        // Check if this is a local minimum within the window
        let isLocalMin = true;
        for (let j = i - windowSize; j <= i + windowSize; j++) {
            if (j !== i && analyses[j]!.avgWristY < curr.avgWristY - 0.02) {
                isLocalMin = false;
                break;
            }
        }

        if (isLocalMin) {
            // Check distance from last peak
            const lastPeakFrame = peaks.length > 0 ? analyses[peaks[peaks.length - 1]!]!.frameIndex : -minDistance;
            if (curr.frameIndex - lastPeakFrame >= minDistance) {
                peaks.push(i);
            }
        }
    }

    // Sort by frame index
    peaks.sort((a, b) => analyses[a]!.frameIndex - analyses[b]!.frameIndex);

    return peaks;
}

/**
 * Searches backwards from a peak to find the shot start frame.
 */
function findShotStartFromPeak(
    analyses: readonly FrameAnalysis[],
    peakIdx: number,
    config: Required<PoseShotDetectorConfig>
): number {
    const peak = analyses[peakIdx]!;

    // Look backwards for the loading phase start
    let minKneeAngle = peak.avgKneeAngle;
    let maxHipY = peak.hipY;
    let loadingFrame = peakIdx;

    for (let i = peakIdx - 1; i >= 0 && peakIdx - i < config.maxShotDuration; i--) {
        const frame = analyses[i]!;

        // Track where we see the most knee bend or hip drop
        if (frame.avgKneeAngle < minKneeAngle) {
            minKneeAngle = frame.avgKneeAngle;
        }
        if (frame.hipY > maxHipY) {
            maxHipY = frame.hipY;
            loadingFrame = i;
        }

        // Check if we've found a stable standing position
        const isStanding = frame.avgKneeAngle > peak.avgKneeAngle + config.kneeBendThreshold &&
            frame.hipY < maxHipY - config.hipDropThreshold;

        if (isStanding) {
            // Found the start - return the frame just after standing
            return analyses[i + 1]?.frameIndex ?? frame.frameIndex;
        }
    }

    // If no clear standing position found, use the loading frame
    if (loadingFrame !== peakIdx) {
        return analyses[loadingFrame]?.frameIndex ?? analyses[0]!.frameIndex;
    }

    // Fall back to beginning of search
    const searchStart = Math.max(0, peakIdx - config.maxShotDuration);
    return analyses[searchStart]?.frameIndex ?? -1;
}

/**
 * Searches forwards from a peak to find the shot end frame.
 */
function findShotEndFromPeak(
    analyses: readonly FrameAnalysis[],
    peakIdx: number,
    config: Required<PoseShotDetectorConfig>
): number {
    const peak = analyses[peakIdx]!;

    // Look forwards for the landing
    for (let i = peakIdx + 1; i < analyses.length && i - peakIdx < config.maxShotDuration; i++) {
        const frame = analyses[i]!;

        // Check for landing signals
        const wristBelowPeak = frame.avgWristY > peak.avgWristY + 0.1;
        const wristNearShoulder = frame.wristToShoulderDiff > -0.05;

        if (wristBelowPeak && wristNearShoulder) {
            return frame.frameIndex;
        }
    }

    // If no clear landing found, use last frame in search window
    const searchEnd = Math.min(analyses.length - 1, peakIdx + config.maxShotDuration);
    return analyses[searchEnd]?.frameIndex ?? -1;
}

/**
 * Calculates confidence score for a detected shot.
 */
function calculateShotConfidence(
    analyses: readonly FrameAnalysis[],
    startFrame: number,
    endFrame: number,
    peakIdx: number
): number {
    const peak = analyses[peakIdx];
    if (!peak) {
        return 0.5;
    }

    // Factors that increase confidence:
    // 1. Clear wrist above shoulder at peak
    const wristElevation = Math.max(0, -peak.wristToShoulderDiff);
    const elevationScore = Math.min(1, wristElevation / 0.2);

    // 2. Reasonable shot duration
    const duration = endFrame - startFrame;
    const durationScore = duration >= 20 && duration <= 60 ? 1.0 : 0.7;

    // 3. Good pose confidence at peak
    const confidenceScore = peak.confidence;

    // Combine factors
    const confidence = (elevationScore * 0.4 + durationScore * 0.3 + confidenceScore * 0.3);
    return Math.round(confidence * 100) / 100;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a pose-based shot detector function with the given configuration.
 *
 * @param config - Detection configuration
 * @returns A function that takes PoseData and returns DetectionResult
 */
export function createPoseShotDetector(
    config: PoseShotDetectorConfig = {}
): (poseData: PoseData) => DetectionResult {
    return (poseData: PoseData) => detectShots(poseData, config);
}
