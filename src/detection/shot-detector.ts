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
  velocityThreshold: 0.015,
  smoothingWindowSize: 3,
  minShotDuration: 20,
  minUpwardFrames: 3,
  armReturnThreshold: 1.0,
  confirmationWindow: 3,
};

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
  /** Frame index */
  readonly frameIndex: number;
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
   * @returns Array of detected boundaries (start/end pairs)
   */
  detectBoundaries(sequence: readonly PoseLandmarks[]): DetectedBoundary[] {
    if (sequence.length < 2) {
      return [];
    }

    // Extract and smooth hand position data
    const frameData = this.extractFrameData(sequence);

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
   * @returns Array of detected shots with boundaries
   */
  detectShots(sequence: readonly PoseLandmarks[]): DetectedShot[] {
    const boundaries = this.detectBoundaries(sequence);
    return this.pairBoundaries(boundaries, sequence.length);
  }

  /**
   * Extracts relevant landmark data from each frame.
   */
  private extractFrameData(sequence: readonly PoseLandmarks[]): FrameData[] {
    const frameData: FrameData[] = [];

    for (let i = 0; i < sequence.length; i++) {
      const landmarks = sequence[i]!.landmarks;
      const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST]!;
      const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST]!;
      const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER]!;
      const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER]!;

      frameData.push({
        frameIndex: i,
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
   */
  private calculateVelocities(frameData: FrameData[]): void {
    for (let i = 1; i < frameData.length; i++) {
      const current = frameData[i]!;
      const previous = frameData[i - 1]!;
      // Negative value means Y decreased = upward movement
      current.wristVelocity = current.avgWristY - previous.avgWristY;
    }
    // First frame has no velocity
    if (frameData.length > 0) {
      frameData[0]!.wristVelocity = 0;
    }
  }

  /**
   * Finds shot start and end boundaries based on velocity patterns.
   */
  private findBoundaries(
    frameData: FrameData[],
    totalFrames: number,
  ): DetectedBoundary[] {
    const boundaries: DetectedBoundary[] = [];
    let inShot = false;
    let shotStartFrame = -1;
    let consecutiveUpwardFrames = 0;
    let peakFrame = -1;
    let peakY = Infinity;

    // Check if video starts mid-shot (already in upward motion)
    const startsInMotion = this.checkStartsInMotion(frameData);
    if (startsInMotion) {
      shotStartFrame = 0;
      consecutiveUpwardFrames = this.config.minUpwardFrames;
    }

    for (let i = 0; i < frameData.length; i++) {
      const frame = frameData[i]!;
      const isUpward = frame.wristVelocity < -this.config.velocityThreshold;

      if (!inShot) {
        // Looking for shot start
        if (isUpward) {
          consecutiveUpwardFrames++;
          if (
            consecutiveUpwardFrames >= this.config.minUpwardFrames &&
            shotStartFrame === -1
          ) {
            // Start of potential shot
            shotStartFrame = Math.max(0, i - this.config.minUpwardFrames + 1);
          }
        } else {
          if (shotStartFrame !== -1) {
            // Had a potential start but movement stopped - check if sustained
            const duration = i - shotStartFrame;
            if (duration >= this.config.minShotDuration / 2) {
              // Confirmed shot start
              inShot = true;
              peakFrame = i;
              peakY = frame.avgWristY;
              boundaries.push({
                type: "start",
                frameIndex: shotStartFrame,
                confidence: this.calculateStartConfidence(
                  frameData,
                  shotStartFrame,
                  i,
                ),
                isPartial: shotStartFrame === 0,
              });
            } else {
              // Too short, reset (pump fake filter)
              shotStartFrame = -1;
            }
          }
          consecutiveUpwardFrames = 0;
        }

        // Track peak position for shots in progress
        if (inShot === false && shotStartFrame !== -1) {
          if (frame.avgWristY < peakY) {
            peakY = frame.avgWristY;
            peakFrame = i;
          }
        }
      } else {
        // In a shot, looking for end
        if (frame.avgWristY < peakY) {
          peakY = frame.avgWristY;
          peakFrame = i;
        }

        // Check for shot end: arm returning down
        const shoulderY = (frame.leftShoulder.y + frame.rightShoulder.y) / 2;
        const wristBelowShoulder =
          frame.avgWristY > shoulderY * this.config.armReturnThreshold;
        const significantDrop = frame.avgWristY > peakY + 0.1;

        if (wristBelowShoulder && significantDrop) {
          // Shot ended
          boundaries.push({
            type: "end",
            frameIndex: i,
            confidence: this.calculateEndConfidence(frameData, peakFrame, i),
            isPartial: false,
          });
          inShot = false;
          shotStartFrame = -1;
          consecutiveUpwardFrames = 0;
          peakFrame = -1;
          peakY = Infinity;
        }
      }
    }

    // Handle shot in progress (still rising) at end of sequence
    if (shotStartFrame !== -1 && !inShot) {
      const duration = frameData.length - shotStartFrame;
      if (duration >= this.config.minShotDuration / 2) {
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
        // Mark end as partial
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
