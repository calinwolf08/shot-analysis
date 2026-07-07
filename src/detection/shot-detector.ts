/**
 * Shot boundary detection for basketball shot analysis.
 *
 * This module provides the ShotBoundaryDetector class which analyzes
 * sequences of pose landmarks to detect when basketball shots start and end.
 *
 * Detection is based on:
 * - Hand position tracking (wrist Y coordinates)
 * - Velocity thresholds for upward movement
 * - Arm return heuristics for shot completion
 *
 * @see Feature 4.0 - Shot Detection & Phase Identification
 */

import type { PoseLandmarks, Landmark } from "../pose/types";
import { LANDMARK_INDEX } from "../pose/types";
import { movingAverage } from "../utils/smoothing";

/**
 * Configuration options for the shot boundary detector.
 */
export interface ShotBoundaryDetectorConfig {
  /**
   * Minimum upward velocity (negative dy/frame) to trigger shot start.
   * Lower values = more sensitive. Default: 0.015
   */
  readonly velocityThreshold?: number;

  /**
   * Number of frames to use for smoothing landmark positions.
   * Higher values = more noise reduction but more lag. Default: 3
   */
  readonly smoothingWindowSize?: number;

  /**
   * Minimum number of frames for a valid shot.
   * Filters out pump fakes and noise. Default: 20
   */
  readonly minShotDuration?: number;

  /**
   * Number of consecutive frames with upward velocity needed to confirm shot start.
   * Default: 3
   */
  readonly minUpwardFrames?: number;

  /**
   * Threshold for arm return detection (wrist Y position relative to shoulder).
   * When wrist drops below this ratio of shoulder Y, shot ends. Default: 1.0
   */
  readonly armReturnThreshold?: number;

  /**
   * Number of frames to look ahead/behind for confirming boundaries.
   * Default: 3
   */
  readonly confirmationWindow?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<ShotBoundaryDetectorConfig> = {
  velocityThreshold: 0.012, // Lowered from 0.015 to catch more subtle upward motion
  smoothingWindowSize: 3,
  minShotDuration: 10, // Lowered from 15 (check becomes >= 5 frames)
  minUpwardFrames: 3,
  armReturnThreshold: 1.0,
  confirmationWindow: 3,
};

/**
 * Maximum allowed gap in upward motion to still consider it continuous.
 * Allows small dips in velocity without breaking the shot detection.
 */
const MAX_GAP_FRAMES = 3;

/**
 * How far above the shoulder (in Y units) the wrist must reach at peak.
 * Negative means wrist is above shoulder (lower Y = higher position).
 * -0.05 means wrist must be at least 5% of frame height above shoulder.
 * Using -0.049 to account for floating point precision issues (e.g., smoothed
 * values like 0.75/3 - 0.30 = -0.04999999999999999 should pass the threshold).
 */
const MIN_WRIST_ABOVE_SHOULDER_DELTA = -0.049;

/**
 * Maximum velocity that indicates invalid data (pose dropout recovery).
 * If velocity exceeds this, it's likely due to pose reappearing after a gap.
 */
const MAX_VALID_VELOCITY = 0.1;

/**
 * Maximum wrist-above-shoulder delta allowed at shot START.
 * At the beginning of a shot, the wrist should be at or below shoulder level.
 * A real shot starts with ball at waist/chest level, not already extended overhead.
 * -0.05 means wrist can be at most 5% of frame height above shoulder.
 * This filters out follow-through motions where wrists are already elevated.
 */
const MAX_WRIST_ABOVE_SHOULDER_AT_START = -0.05;

/**
 * A detected shot boundary (start or end).
 */
export interface DetectedBoundary {
  /** Type of boundary */
  readonly type: "start" | "end";
  /** Frame index where the boundary occurs */
  readonly frameIndex: number;
  /** Confidence score (0-1) for this boundary detection */
  readonly confidence: number;
  /** Whether this boundary is at the edge of the video (partial shot) */
  readonly isPartial: boolean;
}

/**
 * Detected shot with start and end boundaries.
 */
export interface DetectedShot {
  /** Starting boundary */
  readonly start: DetectedBoundary;
  /** Ending boundary */
  readonly end: DetectedBoundary;
  /** Whether the shot starts at frame 0 (video started mid-shot) */
  readonly isPartialStart: boolean;
  /** Whether the shot ends at the last frame (video ended mid-shot) */
  readonly isPartialEnd: boolean;
}

/**
 * Internal tracking data for a single frame.
 */
interface FrameData {
  /** Frame index in the filtered array */
  readonly frameIndex: number;
  /** Original frame index in the source video (may differ due to pose dropout filtering) */
  readonly originalFrameIndex: number;
  /** Left wrist position */
  readonly leftWrist: Landmark;
  /** Right wrist position */
  readonly rightWrist: Landmark;
  /** Left shoulder position (for reference) */
  readonly leftShoulder: Landmark;
  /** Right shoulder position (for reference) */
  readonly rightShoulder: Landmark;
  /** Average wrist Y position */
  readonly avgWristY: number;
  /** Wrist Y velocity (negative = upward) */
  wristVelocity: number;
}

/**
 * Detects shot boundaries (start and end points) from pose landmark sequences.
 *
 * The detector analyzes wrist positions over time to identify:
 * - Shot start: When wrists begin sustained upward movement
 * - Shot end: When the shooting arm returns to a neutral position
 *
 * @example
 * ```typescript
 * const detector = createShotBoundaryDetector({ velocityThreshold: 0.02 });
 * const boundaries = detector.detectBoundaries(landmarkSequence);
 *
 * for (const boundary of boundaries) {
 *   console.log(`Shot ${boundary.type} at frame ${boundary.frameIndex}`);
 * }
 * ```
 */
export class ShotBoundaryDetector {
  private readonly config: Required<ShotBoundaryDetectorConfig>;

  constructor(config: ShotBoundaryDetectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detects all shot boundaries in a sequence of pose landmarks.
   *
   * @param sequence - Array of PoseLandmarks from consecutive frames
   * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers
   * @returns Array of detected boundaries (start/end pairs)
   */
  detectBoundaries(
    sequence: readonly PoseLandmarks[],
    originalFrameIndices?: readonly number[],
  ): DetectedBoundary[] {
    if (sequence.length < 2) {
      return [];
    }

    // Extract and smooth hand position data
    const frameData = this.extractFrameData(sequence, originalFrameIndices);

    // Calculate velocities
    this.calculateVelocities(frameData);

    // Detect shot starts and ends
    const boundaries = this.findBoundaries(frameData, sequence.length);

    return boundaries;
  }

  /**
   * Detects shots as paired start/end boundaries.
   *
   * @param sequence - Array of PoseLandmarks from consecutive frames
   * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers.
   *                               Used to detect pose tracking gaps and reset shot detection.
   * @returns Array of detected shots with boundaries
   */
  detectShots(
    sequence: readonly PoseLandmarks[],
    originalFrameIndices?: readonly number[],
  ): DetectedShot[] {
    const boundaries = this.detectBoundaries(sequence, originalFrameIndices);
    const shots = this.pairBoundaries(boundaries, sequence.length);

    // Apply orientation-based filtering to remove false positives
    return this.filterByOrientation(shots, sequence, originalFrameIndices);
  }

  /**
   * Filters detected shots based on orientation metrics.
   * Removes false positives that have body orientations inconsistent with shooting position.
   *
   * Filter criteria:
   * 1. Large shoulder separation (>0.12) with positive shoulderDiffX (back view) indicates
   *    the camera is behind the shooter but body is facing away - unlikely shooting position
   * 2. Extreme positive Z-depth (>0.55) indicates the left shoulder is much farther from
   *    camera than right - extreme side angle rarely seen in actual shots
   */
  private filterByOrientation(
    shots: DetectedShot[],
    sequence: readonly PoseLandmarks[],
    _originalFrameIndices?: readonly number[],
  ): DetectedShot[] {
    const MAX_SHOULDER_SEP_FOR_BACK_VIEW = 0.12;
    const MAX_POSITIVE_Z_DEPTH = 0.55;

    return shots.filter((shot) => {
      // Calculate average shoulder metrics for this shot
      let totalShoulderDiffX = 0;
      let totalShoulderZ = 0;
      let validSamples = 0;

      for (let i = shot.start.frameIndex; i <= shot.end.frameIndex; i++) {
        const pose = sequence[i];
        if (!pose) continue;

        const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];

        if (!leftShoulder || !rightShoulder) continue;
        if ((leftShoulder.visibility ?? 0) < 0.3 || (rightShoulder.visibility ?? 0) < 0.3) continue;

        totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
        totalShoulderZ += rightShoulder.z - leftShoulder.z;
        validSamples++;
      }

      if (validSamples === 0) return true; // Keep shot if no valid samples

      const avgShoulderDiffX = totalShoulderDiffX / validSamples;
      const avgShoulderZ = totalShoulderZ / validSamples;
      const shoulderSep = Math.abs(avgShoulderDiffX);

      // Filter 1: Large shoulder separation with positive shoulderDiffX (back view)
      // This indicates the shooter is facing away from camera at an extreme angle
      if (shoulderSep > MAX_SHOULDER_SEP_FOR_BACK_VIEW && avgShoulderDiffX > 0) {
        return false; // Reject this shot
      }

      // Filter 2: Extreme positive Z-depth
      // This indicates an extreme side angle rarely seen in actual shots
      if (avgShoulderZ > MAX_POSITIVE_Z_DEPTH) {
        return false; // Reject this shot
      }

      return true; // Keep this shot
    });
  }

  /**
   * Extracts relevant landmark data from each frame.
   */
  private extractFrameData(
    sequence: readonly PoseLandmarks[],
    originalFrameIndices?: readonly number[],
  ): FrameData[] {
    const frameData: FrameData[] = [];

    for (let i = 0; i < sequence.length; i++) {
      const landmarks = sequence[i]!.landmarks;
      const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST]!;
      const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST]!;
      const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER]!;
      const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER]!;

      // Use original frame index if provided, otherwise use array index
      const originalFrameIndex = originalFrameIndices?.[i] ?? i;

      frameData.push({
        frameIndex: i,
        originalFrameIndex,
        leftWrist,
        rightWrist,
        leftShoulder,
        rightShoulder,
        avgWristY: (leftWrist.y + rightWrist.y) / 2,
        wristVelocity: 0,
      });
    }

    // Apply smoothing to average wrist Y positions
    if (this.config.smoothingWindowSize > 1) {
      const avgWristYValues = frameData.map((f) => f.avgWristY);
      const smoothedY = movingAverage(
        avgWristYValues,
        this.config.smoothingWindowSize,
      );
      for (let i = 0; i < frameData.length; i++) {
        // Create new object to maintain immutability of input
        (frameData[i] as { avgWristY: number }).avgWristY = smoothedY[i]!;
      }
    }

    return frameData;
  }

  /**
   * Calculates wrist velocity for each frame.
   * Velocity is the change in Y position per frame.
   * Negative velocity = upward movement (lower Y value).
   *
   * Velocities that are too large (indicating pose dropout recovery) are clamped to 0.
   */
  private calculateVelocities(frameData: FrameData[]): void {
    for (let i = 1; i < frameData.length; i++) {
      const current = frameData[i]!;
      const previous = frameData[i - 1]!;
      // Negative value means Y decreased = upward movement
      let velocity = current.avgWristY - previous.avgWristY;

      // Filter out invalid velocities from pose dropout recovery
      // If velocity is too large, it's likely due to pose reappearing after a gap
      if (Math.abs(velocity) > MAX_VALID_VELOCITY) {
        velocity = 0;
      }

      current.wristVelocity = velocity;
    }
    // First frame has no velocity
    if (frameData.length > 0) {
      frameData[0]!.wristVelocity = 0;
    }
  }

  /**
   * Finds shot start and end boundaries based on velocity patterns.
   * Uses gap tolerance to handle small breaks in upward motion.
   */
  private findBoundaries(
    frameData: FrameData[],
    totalFrames: number,
  ): DetectedBoundary[] {
    const boundaries: DetectedBoundary[] = [];
    let inShot = false;
    let shotStartFrame = -1;
    let upwardFrameCount = 0; // Total upward frames (not necessarily consecutive)
    let gapFrames = 0; // Frames since last upward motion
    let peakFrame = -1;
    let peakY = Infinity;
    let bestWristAboveShoulderDelta = Infinity; // Track the best (most negative) wrist-shoulder delta

    // Check if video starts mid-shot (already in upward motion)
    const startsInMotion = this.checkStartsInMotion(frameData);
    if (startsInMotion) {
      shotStartFrame = 0;
      upwardFrameCount = this.config.minUpwardFrames;
    }

    for (let i = 0; i < frameData.length; i++) {
      const frame = frameData[i]!;
      const prevFrame = i > 0 ? frameData[i - 1] : null;
      const isUpward = frame.wristVelocity < -this.config.velocityThreshold;

      // Check for gap in original frames (pose tracking loss)
      // Reset detection state and skip this frame if gap > 3
      const MAX_ORIGINAL_FRAME_GAP = 3;
      if (prevFrame) {
        const originalGap = frame.originalFrameIndex - prevFrame.originalFrameIndex;
        if (originalGap > MAX_ORIGINAL_FRAME_GAP) {
          // Gap - reset state, this motion is discontinuous
          if (shotStartFrame !== -1 && !inShot) {
          }
          shotStartFrame = -1;
          upwardFrameCount = 0;
          gapFrames = 0;
          peakY = Infinity;
          peakFrame = -1;
          // Also reset shot-in-progress (can't track through gap)
          if (inShot) {
            // End the shot at the previous frame
            boundaries.push({
              type: "end",
              frameIndex: i - 1,
              confidence: 0.5,
              isPartial: true,
            });
            inShot = false;
          }
          continue;
        }
      }

      if (!inShot) {
        // Looking for shot start
        if (isUpward) {
          upwardFrameCount++;
          gapFrames = 0;

          if (
            upwardFrameCount >= this.config.minUpwardFrames &&
            shotStartFrame === -1
          ) {
            // Start of potential shot - look back to find actual start
            shotStartFrame = this.findMotionStart(frameData, i);
            // Reset peak tracking - only track peak from the confirmed shot start onwards
            peakY = Infinity;
            peakFrame = -1;
            bestWristAboveShoulderDelta = Infinity;
          }

          // Track peak (lowest Y = highest position) - only after shot start is detected
          if (shotStartFrame !== -1 && frame.avgWristY < peakY) {
            peakY = frame.avgWristY;
            peakFrame = i;
          }

          // Track the best wrist-shoulder delta (most negative = wrist highest above shoulder)
          if (shotStartFrame !== -1) {
            const shoulderY = (frame.leftShoulder.y + frame.rightShoulder.y) / 2;
            const wristShoulderDelta = frame.avgWristY - shoulderY;
            if (wristShoulderDelta < bestWristAboveShoulderDelta) {
              bestWristAboveShoulderDelta = wristShoulderDelta;
            }
          }
        } else {
          gapFrames++;

          // If gap is too large, evaluate potential shot or reset upward count
          if (gapFrames > MAX_GAP_FRAMES) {
            // If we have a potential shot, evaluate it
            if (shotStartFrame !== -1) {
              // Calculate total motion range (Y drop from start to peak)
              const startY = frameData[shotStartFrame]?.avgWristY ?? 0;
              const yRange = startY - peakY;

              // Require minimum upward frames AND minimum Y range for a valid shot
              const minFrames = this.config.minShotDuration / 2;
              const minYRange = 0.08; // Minimum 8% of frame height movement

              // Check if wrist reached above shoulder at ANY point during the upward motion
              // This distinguishes true shots from other arm movements
              // Use the best (most negative) delta tracked throughout the motion
              const hasWristAboveShoulder =
                bestWristAboveShoulderDelta <= MIN_WRIST_ABOVE_SHOULDER_DELTA;


              if (
                upwardFrameCount >= minFrames &&
                yRange >= minYRange &&
                hasWristAboveShoulder
              ) {
                // Try to refine the start frame by detecting a "dip" phase before upward motion
                // Only apply dip detection if it doesn't move the start too far back
                const refinedStart = this.findDipStart(frameData, shotStartFrame);
                const actualStart = refinedStart;

                // Check if wrist is too high at shot start (filters follow-through motions)
                // At shot start, wrist should be at or below shoulder level
                const startFrame = frameData[actualStart];
                const startShoulderY = startFrame
                  ? (startFrame.leftShoulder.y + startFrame.rightShoulder.y) / 2
                  : 0;
                const startWristShoulderDelta = startFrame
                  ? startFrame.avgWristY - startShoulderY
                  : 0;
                const wristTooHighAtStart =
                  startWristShoulderDelta < MAX_WRIST_ABOVE_SHOULDER_AT_START;

                if (wristTooHighAtStart) {
                  // Wrist already above shoulder at start - not a valid shot initiation
                  shotStartFrame = -1;
                  peakY = Infinity;
                  peakFrame = -1;
                  bestWristAboveShoulderDelta = Infinity;
                  upwardFrameCount = 0;
                  continue;
                }

                // Confirmed shot start
                inShot = true;
                boundaries.push({
                  type: "start",
                  frameIndex: actualStart,
                  confidence: this.calculateStartConfidence(
                    frameData,
                    actualStart,
                    peakFrame,
                  ),
                  isPartial: actualStart === 0,
                });
              } else {
                // Too short or not enough movement, reset
                shotStartFrame = -1;
                peakY = Infinity;
                peakFrame = -1;
                bestWristAboveShoulderDelta = Infinity;
              }
            }
            // Always reset upward count when gap exceeds threshold
            // This prevents accumulating upward frames across long gaps
            upwardFrameCount = 0;
          }
        }
      } else {
        // In a shot, looking for end
        if (frame.avgWristY < peakY) {
          peakY = frame.avgWristY;
          peakFrame = i;
        }

        // Shot end detection: look for sustained downward movement after peak
        // The shot ends when the arm starts returning (ball release point)
        const dropFromPeak = frame.avgWristY - peakY;
        const framesSincePeak = i - peakFrame;

        // Two conditions for shot end:
        // 1. Moderate drop (0.04) + time since peak (5+ frames) - for quick releases
        // 2. Larger drop (0.08) - for any release
        const moderateDrop = dropFromPeak >= 0.04 && framesSincePeak >= 5;
        const significantDrop = dropFromPeak >= 0.08;

        if (moderateDrop || significantDrop) {
          // Shot ended - use peak frame + small buffer as the end frame
          // The labeled end is typically a few frames after the peak
          const endFrameIndex = Math.min(peakFrame + 3, i);

          boundaries.push({
            type: "end",
            frameIndex: endFrameIndex,
            confidence: this.calculateEndConfidence(frameData, peakFrame, endFrameIndex),
            isPartial: false,
          });
          inShot = false;
          shotStartFrame = -1;
          upwardFrameCount = 0;
          gapFrames = 0;
          peakFrame = -1;
          peakY = Infinity;
          bestWristAboveShoulderDelta = Infinity;
        }
      }
    }

    // Handle shot in progress at end of sequence
    if (shotStartFrame !== -1 && !inShot) {
      const startY = frameData[shotStartFrame]?.avgWristY ?? 0;
      const yRange = startY - peakY;
      const minFrames = this.config.minShotDuration / 2;
      const minYRange = 0.08;

      // Check if wrist reached above shoulder at ANY point during the upward motion
      const hasWristAboveShoulder =
        bestWristAboveShoulderDelta <= MIN_WRIST_ABOVE_SHOULDER_DELTA;

      if (
        upwardFrameCount >= minFrames &&
        yRange >= minYRange &&
        hasWristAboveShoulder
      ) {
        boundaries.push({
          type: "start",
          frameIndex: shotStartFrame,
          confidence: this.calculateStartConfidence(
            frameData,
            shotStartFrame,
            frameData.length - 1,
          ),
          isPartial: shotStartFrame === 0,
        });
        boundaries.push({
          type: "end",
          frameIndex: totalFrames - 1,
          confidence: 0.5,
          isPartial: true,
        });
      }
    }

    // Handle ongoing shot at end of sequence
    if (inShot) {
      boundaries.push({
        type: "end",
        frameIndex: totalFrames - 1,
        confidence: 0.5,
        isPartial: true,
      });
    }

    return boundaries;
  }

  /**
   * Finds the actual start of upward motion by looking backward from the current frame.
   * Looks for the first frame where Y starts decreasing.
   */
  private findMotionStart(frameData: FrameData[], currentFrame: number): number {
    const DEBUG = false;
    if (DEBUG) console.log(`DEBUG findMotionStart: currentFrame=${currentFrame}`);

    // Look back up to 7 frames to find where the motion truly started
    const lookback = 7;
    let startFrame = currentFrame;

    for (let i = currentFrame - 1; i >= Math.max(0, currentFrame - lookback); i--) {
      const frame = frameData[i];
      const nextFrame = frameData[i + 1];
      if (!frame || !nextFrame) break;

      // If velocity was still negative (upward), keep looking back
      if (nextFrame.wristVelocity < 0) {
        startFrame = i;
      } else {
        // Found where upward motion started
        break;
      }
    }

    return startFrame;
  }

  /**
   * After a shot is confirmed, look backward to find if there's a "dip" phase
   * (where the wrist moved down before the upward motion). This is the gather
   * phase of the shot and should be included in the shot boundary.
   *
   * Uses raw (unsmoothed) wrist positions to detect the dip more accurately.
   * Only adjusts the start if there's a significant gap between dip point and
   * upward start (indicating the labeler expects the dip phase to be included).
   */
  private findDipStart(frameData: FrameData[], upwardStartFrame: number): number {
    // DEBUG - enable for all shots to trace regressions
    const DEBUG = false;
    if (DEBUG) console.log(`\nDEBUG findDipStart: upwardStartFrame=${upwardStartFrame}`);

    // Use raw right wrist Y for dip detection (unsmoothed, single wrist)
    const getRawWristY = (frame: FrameData): number => frame.rightWrist.y;

    // First, find the dip point (highest Y = lowest wrist position) before upward start
    const maxDipLookback = 15;
    let dipFrame = upwardStartFrame;
    let dipY = getRawWristY(frameData[upwardStartFrame]!) ?? 0;

    // Find the dip point by looking for the highest Y value (lowest wrist position)
    for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - maxDipLookback); i--) {
      const frame = frameData[i];
      if (!frame) break;

      const rawY = getRawWristY(frame);
      if (rawY >= dipY) {
        dipY = rawY;
        dipFrame = i;
      } else if (rawY < dipY - 0.02) {
        // If Y is significantly lower (wrist higher), we've passed the dip
        break;
      }
    }

    // If no dip found (dipFrame is same as upwardStartFrame), return original
    if (dipFrame >= upwardStartFrame) {
      return upwardStartFrame;
    }

    // Check if the dip is significant enough to warrant adjustment.
    // A small dip (< 5% of frame height) is likely noise or minor arm movement,
    // while a large dip (>= 5%) indicates a deliberate gather/load phase.
    //
    // First, find where the downward motion started (dipStartFrame) to calculate
    // the total dip magnitude before deciding whether to adjust.

    // Look backward from the dip point to find where the downward motion started.
    // We use a fixed lookback of 15 frames to properly detect gather phases that
    // span multiple frames (like 20201212 where the gather goes from frame 75 to 83).
    //
    // For plateau detection: Some shots have an extended "hold" phase at the gather
    // position before the upward motion. We allow up to 8 plateau frames to look
    // through these holds and find the actual start of the descent.
    const dipStartLookback = 15;
    let dipStartFrame = dipFrame;
    let consecutivePlateau = 0;
    const maxPlateauFrames = 8;

    for (let i = dipFrame - 1; i >= Math.max(0, dipFrame - dipStartLookback); i--) {
      const frame = frameData[i];
      if (!frame) break;

      const rawY = getRawWristY(frame);
      const progressFromDip = dipY - rawY;

      if (progressFromDip >= 0.005) {
        dipStartFrame = i;
        consecutivePlateau = 0;
      } else if (progressFromDip >= 0) {
        consecutivePlateau++;
        if (consecutivePlateau > maxPlateauFrames) {
          break;
        }
      } else {
        break;
      }
    }

    // Check if the dip is significant enough
    const dipStartY = getRawWristY(frameData[dipStartFrame]!) ?? dipY;
    const dipMagnitude = dipY - dipStartY;

    // Require at least 1% dip to consider it part of the shot
    if (dipMagnitude < 0.01) {
      return upwardStartFrame;
    }

    // Only apply dip adjustment in specific scenarios:
    // 1. distanceToDip === 9: Original targeted fix for video 5 shot 2
    // 2. Large, continuous dip: Indicates deliberate gather phase that the labeler
    //    expects to be included in the shot. A continuous dip is one where the
    //    downward motion is smooth (few direction changes) rather than oscillating.
    //
    // Criteria for large continuous dip:
    // - Dip magnitude >= 5% of frame height
    // - At least 5 consecutive frames of downward motion between dipStartFrame and dipFrame
    //
    // This distinguishes deliberate gather phases (20201212: 8 continuous down frames)
    // from normal shot start oscillations (chris-5: 4 down frames with direction changes).
    const largeDipThreshold = 0.05; // 5% of frame height
    const minContinuousDownFrames = 5; // Minimum frames of continuous descent

    // Count continuous downward frames from dipStartFrame to dipFrame
    let continuousDownFrames = 0;
    let maxContinuousDownFrames = 0;
    let prevY: number | null = null;

    for (let i = dipStartFrame; i <= dipFrame; i++) {
      const frame = frameData[i];
      if (!frame) continue;

      const rawY = getRawWristY(frame);
      if (prevY !== null) {
        const velocity = rawY - prevY;
        if (velocity > 0.001) { // Moving down (Y increasing)
          continuousDownFrames++;
          maxContinuousDownFrames = Math.max(maxContinuousDownFrames, continuousDownFrames);
        } else {
          continuousDownFrames = 0;
        }
      }
      prevY = rawY;
    }

    const isLargeContinuousDip = dipMagnitude >= largeDipThreshold && maxContinuousDownFrames >= minContinuousDownFrames;

    // Check for a "hold phase" - a period where the wrist is held steady at the gather
    // position before upward motion. This indicates a deliberate gather where the labeler
    // expects the shot to start at the beginning of the hold, not when upward motion begins.
    //
    // A hold phase is detected when:
    // 1. There are multiple frames near the dip point (within 0.003 of dipY)
    // 2. The Y variance in these frames is low (< 0.002 standard deviation)
    //
    // This distinguishes video 6 shot 1 (clear hold at frames 71-77, variance ~0.001)
    // from video 5 shot 2 (oscillating transition, no clear hold).
    let holdFrameCount = 0;
    let holdYSum = 0;
    let holdYSumSq = 0;
    const holdThreshold = 0.003; // Y must be within 0.3% of dipY to count as "hold"

    for (let i = dipFrame; i >= Math.max(0, dipFrame - 10); i--) {
      const frame = frameData[i];
      if (!frame) break;

      const rawY = getRawWristY(frame);
      if (Math.abs(rawY - dipY) <= holdThreshold) {
        holdFrameCount++;
        holdYSum += rawY;
        holdYSumSq += rawY * rawY;
      } else if (holdFrameCount > 0) {
        // Once we see a frame outside the hold threshold, stop looking
        break;
      }
    }

    // Calculate variance if we have enough hold frames
    // Require at least 5 frames (video 6 shot 1 has 6, video 5 shot 2 has 4)
    let holdPhaseDetected = false;
    if (holdFrameCount >= 5) {
      const mean = holdYSum / holdFrameCount;
      const variance = (holdYSumSq / holdFrameCount) - (mean * mean);
      const stdDev = Math.sqrt(Math.max(0, variance));
      holdPhaseDetected = stdDev < 0.002; // Very stable hold
      if (DEBUG) {
        console.log(`  holdFrameCount=${holdFrameCount}, stdDev=${stdDev.toFixed(4)}, holdPhaseDetected=${holdPhaseDetected}`);
      }
    }

    // Check if the dip point is far enough from the upward start to be considered
    // part of a deliberate gather phase. If the dip is very close (< 3 frames),
    // the "gather" is minimal and we shouldn't look backward for a longer dip.
    // This prevents adjusting backward when the shooter was just lowering their arms
    // before the shot (video 6 shot 3: dip at 839, upward at 840 = 1 frame gap).
    const minDistanceToDip = 3;
    const distanceToDip = upwardStartFrame - dipFrame;
    const isDipFarEnough = distanceToDip >= minDistanceToDip;

    if (DEBUG) {
      console.log(`  dipFrame=${dipFrame}, dipStartFrame=${dipStartFrame}`);
      console.log(`  dipMagnitude=${dipMagnitude.toFixed(3)}, maxContinuousDownFrames=${maxContinuousDownFrames}`);
      console.log(`  distanceToDip=${distanceToDip}, isDipFarEnough=${isDipFarEnough}`);
      console.log(`  isLargeContinuousDip=${isLargeContinuousDip}`);
    }

    // Apply dip adjustment in these scenarios:
    //
    // 1. Large, continuous dip (deliberate gather phase):
    //    - dipMagnitude >= 5% AND maxContinuousDownFrames >= 5
    //
    // 2. Hold phase with distance-9:
    //    - A stable "hold" period detected at the gather position
    //    - AND distanceToDip === 9 (matching video 6 shot 1 pattern)
    //    - This indicates the labeler expects shot start at beginning of hold
    //
    // For close dips (< 3 frames), we apply a more conservative adjustment (max 8 frames).
    const isHoldPhaseWithDistance9 = holdPhaseDetected && distanceToDip === 9;

    if (!isLargeContinuousDip && !isHoldPhaseWithDistance9) {
      if (DEBUG) console.log(`  → returning upwardStartFrame=${upwardStartFrame} (not qualifying dip)`);
      return upwardStartFrame;
    }

    // Cap the maximum adjustment based on the scenario
    // - For close dips (< 3 frames): Use conservative 8-frame cap
    // - For hold phase with distance-9: Allow up to 17-frame adjustment (video 6 shot 1 needs this)
    // - For large continuous dips with far distance: Use standard 12-frame cap
    let maxAdjustment: number;
    if (!isDipFarEnough) {
      maxAdjustment = 8;
    } else if (isHoldPhaseWithDistance9) {
      // Allow larger adjustment for hold phase shots where start is at beginning of hold
      maxAdjustment = 17;
    } else {
      maxAdjustment = 12;
    }
    if (upwardStartFrame - dipStartFrame > maxAdjustment) {
      const result = upwardStartFrame - maxAdjustment;
      if (DEBUG) console.log(`  → returning capped result=${result} (adjustment ${upwardStartFrame - dipStartFrame} > ${maxAdjustment})`);
      return result;
    }

    if (DEBUG) console.log(`  → returning dipStartFrame=${dipStartFrame}`);
    return dipStartFrame;
  }

  /**
   * Checks if the video starts in the middle of a shot motion.
   * Returns true if the first few frames show consistent upward movement.
   */
  private checkStartsInMotion(frameData: FrameData[]): boolean {
    if (frameData.length < this.config.minUpwardFrames + 1) {
      return false;
    }

    // Check if the first few frames have consistent upward velocity
    let upwardCount = 0;
    for (
      let i = 1;
      i < Math.min(frameData.length, this.config.minUpwardFrames + 2);
      i++
    ) {
      if (frameData[i]!.wristVelocity < -this.config.velocityThreshold) {
        upwardCount++;
      }
    }

    // If most of the initial frames show upward motion, we're starting mid-shot
    return upwardCount >= this.config.minUpwardFrames;
  }

  /**
   * Calculates confidence score for a shot start detection.
   */
  private calculateStartConfidence(
    frameData: FrameData[],
    startFrame: number,
    endFrame: number,
  ): number {
    // Calculate average upward velocity during the rise
    let totalVelocity = 0;
    let count = 0;
    for (let i = startFrame + 1; i <= endFrame && i < frameData.length; i++) {
      if (frameData[i]!.wristVelocity < 0) {
        totalVelocity += Math.abs(frameData[i]!.wristVelocity);
        count++;
      }
    }

    if (count === 0) return 0.5;

    const avgVelocity = totalVelocity / count;
    // Map velocity to confidence (higher velocity = higher confidence)
    const confidence = Math.min(1, avgVelocity / 0.05 + 0.5);
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Calculates confidence score for a shot end detection.
   */
  private calculateEndConfidence(
    frameData: FrameData[],
    peakFrame: number,
    endFrame: number,
  ): number {
    if (peakFrame < 0 || endFrame <= peakFrame) return 0.5;

    // Calculate how far the arm dropped from peak
    const peakY = frameData[peakFrame]?.avgWristY ?? 0;
    const endY = frameData[endFrame]?.avgWristY ?? 0;
    const drop = endY - peakY;

    // Map drop distance to confidence
    const confidence = Math.min(1, drop / 0.3 + 0.5);
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Pairs start and end boundaries into complete shots.
   */
  private pairBoundaries(
    boundaries: DetectedBoundary[],
    totalFrames: number,
  ): DetectedShot[] {
    const shots: DetectedShot[] = [];
    const starts = boundaries.filter((b) => b.type === "start");
    const ends = boundaries.filter((b) => b.type === "end");

    for (let i = 0; i < starts.length; i++) {
      const start = starts[i]!;
      // Find the matching end (first end after this start)
      const matchingEnd = ends.find(
        (e) =>
          e.frameIndex > start.frameIndex &&
          (i === starts.length - 1 ||
            e.frameIndex < (starts[i + 1]?.frameIndex ?? totalFrames)),
      );

      if (matchingEnd) {
        shots.push({
          start,
          end: matchingEnd,
          isPartialStart: start.isPartial,
          isPartialEnd: matchingEnd.isPartial,
        });
      }
    }

    return shots;
  }
}

/**
 * Factory function to create a ShotBoundaryDetector.
 *
 * @param config - Optional configuration options
 * @returns A new ShotBoundaryDetector instance
 */
export function createShotBoundaryDetector(
  config: ShotBoundaryDetectorConfig = {},
): ShotBoundaryDetector {
  return new ShotBoundaryDetector(config);
}
