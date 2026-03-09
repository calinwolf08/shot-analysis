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

    // Debug: Log velocity statistics
    const velocities = frameData.map((f) => f.wristVelocity);
    const minVel = Math.min(...velocities);
    const maxVel = Math.max(...velocities);
    const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const upwardFrames = velocities.filter(
      (v) => v < -this.config.velocityThreshold,
    ).length;
    console.log(
      `[ShotDetector] Velocity stats: min=${minVel.toFixed(4)}, max=${maxVel.toFixed(4)}, avg=${avgVel.toFixed(4)}`,
    );
    console.log(
      `[ShotDetector] Threshold: ${this.config.velocityThreshold}, frames exceeding: ${upwardFrames}`,
    );
    console.log(
      `[ShotDetector] Wrist Y range: ${Math.min(...frameData.map((f) => f.avgWristY)).toFixed(3)} - ${Math.max(...frameData.map((f) => f.avgWristY)).toFixed(3)}`,
    );

    // Debug: Log frames 50-85 (expected shot range based on labels)
    console.log(
      `[ShotDetector] Frame-by-frame analysis for shot region (50-85):`,
    );
    for (let i = 50; i < Math.min(85, frameData.length); i++) {
      const f = frameData[i];
      if (f) {
        const marker =
          f.wristVelocity < -this.config.velocityThreshold ? " <-- UPWARD" : "";
        console.log(
          `  Frame ${i}: wristY=${f.avgWristY.toFixed(3)}, velocity=${f.wristVelocity.toFixed(4)}${marker}`,
        );
      }
    }

    // Detect shot starts and ends
    const boundaries = this.findBoundaries(frameData, sequence.length);

    console.log(`[ShotDetector] Found ${boundaries.length} boundaries`);

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
    return this.pairBoundaries(boundaries, sequence.length);
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
            console.log(
              `[ShotDetector] Frame gap ${originalGap} at filtered ${i} (orig ${frame.originalFrameIndex}), resetting`,
            );
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
            console.log(
              `[ShotDetector] Potential shot start at frame ${shotStartFrame}`,
            );
          }

          // Track peak (lowest Y = highest position) - only after shot start is detected
          if (shotStartFrame !== -1 && frame.avgWristY < peakY) {
            peakY = frame.avgWristY;
            peakFrame = i;
          }
        } else {
          gapFrames++;

          // If we have a potential shot and gap is too large, evaluate
          if (shotStartFrame !== -1 && gapFrames > MAX_GAP_FRAMES) {
            // Calculate total motion range (Y drop from start to peak)
            const startY = frameData[shotStartFrame]?.avgWristY ?? 0;
            const yRange = startY - peakY;

            // Require minimum upward frames AND minimum Y range for a valid shot
            const minFrames = this.config.minShotDuration / 2;
            const minYRange = 0.08; // Minimum 8% of frame height movement

            // Check if wrist reached above shoulder at peak
            // This distinguishes true shots from other arm movements
            const peakFrameData = frameData[peakFrame];
            const peakShoulderY = peakFrameData
              ? (peakFrameData.leftShoulder.y + peakFrameData.rightShoulder.y) /
                2
              : 0;
            const wristShoulderDelta = peakY - peakShoulderY;
            const hasWristAboveShoulder =
              wristShoulderDelta <= MIN_WRIST_ABOVE_SHOULDER_DELTA;

            console.log(
              `[ShotDetector] Gap at frame ${i}: upwardFrames=${upwardFrameCount}, yRange=${yRange.toFixed(3)}, wristShoulderDelta=${wristShoulderDelta.toFixed(3)}`,
            );

            if (
              upwardFrameCount >= minFrames &&
              yRange >= minYRange &&
              hasWristAboveShoulder
            ) {
              // Confirmed shot start
              inShot = true;
              boundaries.push({
                type: "start",
                frameIndex: shotStartFrame,
                confidence: this.calculateStartConfidence(
                  frameData,
                  shotStartFrame,
                  peakFrame,
                ),
                isPartial: shotStartFrame === 0,
              });
              console.log(
                `[ShotDetector] Confirmed shot start at frame ${shotStartFrame} (upward=${upwardFrameCount}, yRange=${yRange.toFixed(3)}, wristShoulderDelta=${wristShoulderDelta.toFixed(3)})`,
              );
            } else {
              // Too short or not enough movement, reset
              console.log(
                `[ShotDetector] Rejected as pump fake (upward=${upwardFrameCount} < ${minFrames} or yRange=${yRange.toFixed(3)} < ${minYRange} or wristShoulderDelta=${wristShoulderDelta.toFixed(3)} > ${MIN_WRIST_ABOVE_SHOULDER_DELTA})`,
              );
              shotStartFrame = -1;
              peakY = Infinity;
              peakFrame = -1;
            }
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
        }
      }
    }

    // Handle shot in progress at end of sequence
    if (shotStartFrame !== -1 && !inShot) {
      const startY = frameData[shotStartFrame]?.avgWristY ?? 0;
      const yRange = startY - peakY;
      const minFrames = this.config.minShotDuration / 2;
      const minYRange = 0.08;

      // Check if wrist reached above shoulder at peak
      const peakFrameData = frameData[peakFrame];
      const peakShoulderY = peakFrameData
        ? (peakFrameData.leftShoulder.y + peakFrameData.rightShoulder.y) / 2
        : 0;
      const wristShoulderDelta = peakY - peakShoulderY;
      const hasWristAboveShoulder =
        wristShoulderDelta <= MIN_WRIST_ABOVE_SHOULDER_DELTA;

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
    // Look back up to 7 frames to find where the motion truly started
    // (Reduced from 10 to better align with labeled shot starts)
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
