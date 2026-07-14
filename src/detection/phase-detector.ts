/**
 * Phase identification for basketball shot analysis.
 *
 * This module provides the PhaseDetector class which analyzes sequences of
 * pose landmarks to identify the 6 phases of a basketball shot:
 * - Gather: Ball received, preparing to shoot
 * - Load: Lowering into legs, ball may dip
 * - Rise: Legs extending, ball moving upward
 * - SetPoint: Ball at highest point before release
 * - Release: Shooting arm extends, wrist snaps
 * - FollowThrough: Arm fully extended, held
 *
 * Phase transitions are based on:
 * - Hip vertical position (load detection)
 * - Knee angle (load to rise transition)
 * - Wrist height peaks (set point)
 * - Hand separation velocity (release)
 * - Arm extension angle (follow-through)
 *
 * @see Feature 4.0 - Shot Detection & Phase Identification
 */

import type { PoseLandmarks, Landmark } from "../pose/types";
import { LANDMARK_INDEX } from "../pose/types";
import { ShotPhase, type PhaseRange, type ShotPhases } from "./types";
import { movingAverage } from "../utils/smoothing";
import { calculateAngle } from "../utils/geometry";

/**
 * Configuration options for the phase detector.
 */
export interface PhaseDetectorConfig {
  /**
   * Number of frames to use for smoothing landmark positions.
   * Higher values = more noise reduction but more lag. Default: 3
   */
  readonly smoothingWindowSize?: number;

  /**
   * Threshold for hysteresis to prevent phase flickering.
   * Phases won't transition unless the signal exceeds this threshold. Default: 0.01
   */
  readonly hysteresisThreshold?: number;

  /**
   * Minimum number of frames for a phase to be considered valid.
   * Default: 2
   */
  readonly minPhaseDuration?: number;

  /**
   * Threshold for detecting hand separation during release.
   * Distance between index fingers normalized to shoulder width. Default: 0.15
   */
  readonly handSeparationThreshold?: number;

  /**
   * Threshold for hip drop detection during load phase.
   * Normalized change in hip Y position. Default: 0.015
   */
  readonly hipDropThreshold?: number;

  /**
   * Threshold for wrist velocity to detect upward motion during rise.
   * Negative value (upward in image coords). Default: -0.01
   */
  readonly wristVelocityThreshold?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<PhaseDetectorConfig> = {
  smoothingWindowSize: 3,
  hysteresisThreshold: 0.01,
  minPhaseDuration: 2,
  handSeparationThreshold: 0.15,
  hipDropThreshold: 0.015,
  wristVelocityThreshold: -0.01,
};

/**
 * Result of phase detection on a shot sequence.
 */
export interface PhaseDetectionResult {
  /** Detected phases with frame ranges */
  readonly phases: ShotPhases;
  /** Overall confidence score for the detection (0-1) */
  readonly confidence: number;
}

/**
 * Internal frame analysis data.
 */
interface FrameAnalysis {
  readonly frameIndex: number;
  readonly avgWristY: number;
  /** Smoothed average wrist X (horizontal). Used for set-point detection. */
  readonly avgWristX: number;
  readonly avgHipY: number;
  readonly kneeAngle: number;
  readonly handSeparation: number;
  readonly wristVelocity: number;
  readonly hipVelocity: number;
  readonly avgConfidence: number;
  /**
   * Signed facing hint: nose.x − mean(ear.x). For a side-on shooter the
   * nose sits toward the basket relative to the ears, so the sign of this
   * (aggregated over the shot) tells us which way the basket is.
   */
  readonly faceDir: number;
}

/**
 * Phase boundary detection state.
 */
interface PhaseState {
  currentPhase: ShotPhase | null;
  phaseStartFrame: number;
  phases: Map<ShotPhase, PhaseRange>;
  peakWristFrame: number;
  peakWristY: number;
  maxHipY: number;
  maxHipFrame: number;
  initialHipY: number;
  handsTogetheer: boolean;
}

/**
 * Identifies shot phases from pose landmark sequences.
 *
 * The detector uses biomechanical indicators to identify when each phase
 * of a basketball shot occurs:
 *
 * - **Gather**: Detected when hands come together and wrists start moving
 * - **Load**: Detected by hip dropping (increased Y) and knee bending
 * - **Rise**: Detected by sustained upward wrist movement and knee extension
 * - **SetPoint**: Detected at wrist height peak (minimum Y value)
 * - **Release**: Detected by rapid hand separation
 * - **FollowThrough**: Detected after release with shooting arm extended
 *
 * @example
 * ```typescript
 * const detector = createPhaseDetector();
 * const landmarks = await getPoseLandmarks(videoFrames);
 * const result = detector.detectPhases(landmarks, shotStart, shotEnd);
 *
 * console.log('Phases detected:', Object.keys(result.phases));
 * console.log('Set point at frame:', result.phases[ShotPhase.SetPoint]?.startFrame);
 * ```
 */
export class PhaseDetector {
  private readonly config: Required<PhaseDetectorConfig>;

  constructor(config: PhaseDetectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detects all shot phases within a frame range.
   *
   * @param sequence - Array of PoseLandmarks from consecutive frames
   * @param startFrame - Starting frame index (inclusive)
   * @param endFrame - Ending frame index (inclusive)
   * @returns Phase detection result with frame ranges and confidence
   */
  detectPhases(
    sequence: readonly PoseLandmarks[],
    startFrame: number,
    endFrame: number,
  ): PhaseDetectionResult {
    if (sequence.length === 0 || startFrame > endFrame) {
      return { phases: {}, confidence: 0 };
    }

    // Ensure frame indices are within bounds
    const actualStart = Math.max(0, startFrame);
    const actualEnd = Math.min(sequence.length - 1, endFrame);

    if (actualEnd - actualStart < 1) {
      return { phases: {}, confidence: 0 };
    }

    // Analyze each frame
    const frameData = this.analyzeFrames(sequence, actualStart, actualEnd);

    if (frameData.length < 2) {
      return { phases: {}, confidence: 0 };
    }

    // Identify phases using the analyzed data
    const phases = this.identifyPhases(frameData, actualStart);

    // Debug: Check for out-of-bounds phases
    for (const [phaseName, phaseRange] of Object.entries(phases)) {
      if (
        phaseRange &&
        (phaseRange.startFrame < actualStart || phaseRange.endFrame > actualEnd)
      ) {
        console.log(
          `[PhaseDetector] WARNING: Phase ${phaseName} out of bounds: ${phaseRange.startFrame}-${phaseRange.endFrame} (expected ${actualStart}-${actualEnd})`,
        );
      }
    }

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(frameData, phases);

    return { phases, confidence };
  }

  /**
   * Analyzes each frame to extract relevant metrics for phase detection.
   */
  private analyzeFrames(
    sequence: readonly PoseLandmarks[],
    startFrame: number,
    endFrame: number,
  ): FrameAnalysis[] {
    const frameData: FrameAnalysis[] = [];

    // Extract raw values
    const wristYValues: number[] = [];
    const wristXValues: number[] = [];
    const hipYValues: number[] = [];

    for (let i = startFrame; i <= endFrame; i++) {
      const landmarks = sequence[i]!.landmarks;
      const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST]!;
      const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST]!;
      const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP]!;
      const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP]!;

      wristYValues.push((leftWrist.y + rightWrist.y) / 2);
      wristXValues.push((leftWrist.x + rightWrist.x) / 2);
      hipYValues.push((leftHip.y + rightHip.y) / 2);
    }

    // Apply smoothing
    const smoothedWristY =
      this.config.smoothingWindowSize > 1
        ? movingAverage(wristYValues, this.config.smoothingWindowSize)
        : wristYValues;

    const smoothedWristX =
      this.config.smoothingWindowSize > 1
        ? movingAverage(wristXValues, this.config.smoothingWindowSize)
        : wristXValues;

    const smoothedHipY =
      this.config.smoothingWindowSize > 1
        ? movingAverage(hipYValues, this.config.smoothingWindowSize)
        : hipYValues;

    // Build frame analysis data
    for (let i = startFrame; i <= endFrame; i++) {
      const idx = i - startFrame;
      const landmarks = sequence[i]!.landmarks;

      const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST]!;
      const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST]!;
      const leftIndex = landmarks[LANDMARK_INDEX.LEFT_INDEX]!;
      const rightIndex = landmarks[LANDMARK_INDEX.RIGHT_INDEX]!;
      const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER]!;
      const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER]!;
      const nose = landmarks[LANDMARK_INDEX.NOSE]!;
      const leftEar = landmarks[LANDMARK_INDEX.LEFT_EAR]!;
      const rightEar = landmarks[LANDMARK_INDEX.RIGHT_EAR]!;
      const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP]!;
      const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP]!;
      const leftKnee = landmarks[LANDMARK_INDEX.LEFT_KNEE]!;
      const rightKnee = landmarks[LANDMARK_INDEX.RIGHT_KNEE]!;
      const leftAnkle = landmarks[LANDMARK_INDEX.LEFT_ANKLE]!;
      const rightAnkle = landmarks[LANDMARK_INDEX.RIGHT_ANKLE]!;

      // Calculate hand separation (distance between index fingers)
      const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
      const handDx = rightIndex.x - leftIndex.x;
      const handDy = rightIndex.y - leftIndex.y;
      const handDistance = Math.sqrt(handDx * handDx + handDy * handDy);
      const handSeparation =
        shoulderWidth > 0 ? handDistance / shoulderWidth : handDistance;

      // Calculate knee angle (average of both knees)
      const leftKneeAngle = this.calculateKneeAngle(
        leftHip,
        leftKnee,
        leftAnkle,
      );
      const rightKneeAngle = this.calculateKneeAngle(
        rightHip,
        rightKnee,
        rightAnkle,
      );
      const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

      // Calculate velocities (change from previous frame)
      const wristVelocity =
        idx > 0 ? smoothedWristY[idx]! - smoothedWristY[idx - 1]! : 0;

      const hipVelocity =
        idx > 0 ? smoothedHipY[idx]! - smoothedHipY[idx - 1]! : 0;

      // Average confidence of key landmarks
      const avgConfidence =
        (leftWrist.confidence +
          rightWrist.confidence +
          leftHip.confidence +
          rightHip.confidence +
          leftKnee.confidence +
          rightKnee.confidence) /
        6;

      // Facing hint: nose relative to the mean ear X. Weighted toward the
      // more-visible ear so a side view (one ear occluded) still reads.
      const earX =
        leftEar.confidence + rightEar.confidence > 0
          ? (leftEar.x * leftEar.confidence +
              rightEar.x * rightEar.confidence) /
            (leftEar.confidence + rightEar.confidence)
          : (leftEar.x + rightEar.x) / 2;
      const faceDir = nose.x - earX;

      frameData.push({
        frameIndex: i,
        avgWristY: smoothedWristY[idx]!,
        avgWristX: smoothedWristX[idx]!,
        avgHipY: smoothedHipY[idx]!,
        kneeAngle,
        handSeparation,
        wristVelocity,
        hipVelocity,
        avgConfidence,
        faceDir,
      });
    }

    return frameData;
  }

  /**
   * Calculates knee angle from hip-knee-ankle landmarks.
   */
  private calculateKneeAngle(
    hip: Landmark,
    knee: Landmark,
    ankle: Landmark,
  ): number {
    return calculateAngle(
      { x: hip.x, y: hip.y, z: hip.z },
      { x: knee.x, y: knee.y, z: knee.z },
      { x: ankle.x, y: ankle.y, z: ankle.z },
    );
  }

  /**
   * Identifies phases from analyzed frame data.
   */
  private identifyPhases(
    frameData: FrameAnalysis[],
    baseFrame: number,
  ): ShotPhases {
    const state: PhaseState = {
      currentPhase: null,
      phaseStartFrame: baseFrame,
      phases: new Map(),
      peakWristFrame: -1,
      peakWristY: Infinity,
      maxHipY: 0,
      maxHipFrame: -1,
      initialHipY: frameData[0]?.avgHipY ?? 0,
      handsTogetheer: false,
    };

    // Find key points in the sequence
    this.findKeyPoints(frameData, state);

    // Identify phases based on key points
    this.assignPhases(frameData, state, baseFrame);

    // Calculate the maximum allowed frame index
    const maxFrameIndex = baseFrame + frameData.length - 1;

    // Convert Map to ShotPhases object, clamping endFrames to maxFrameIndex
    const phases: Partial<Record<ShotPhase, PhaseRange>> = {};
    for (const [phase, range] of state.phases) {
      phases[phase] = {
        startFrame: range.startFrame,
        endFrame: Math.min(range.endFrame, maxFrameIndex),
      };
    }

    return phases as ShotPhases;
  }

  /**
   * Finds the set point: the frame where the wrists are furthest from the
   * basket, just before extending toward it to release. Searches the rise
   * (up to the wrist-height peak) for the horizontal turning point.
   *
   * Basket direction is inferred from the shooter's facing (nose vs ears),
   * which is robust for the side-on framing the app requires. Returns null
   * when there's no clear facing/horizontal signal (e.g. a frontal view or
   * synthetic data), so the caller falls back to the wrist-height peak.
   */
  private findSetPointFrame(
    frameData: FrameAnalysis[],
    state: PhaseState,
    riseStartFrame: number,
    baseFrame: number,
  ): number | null {
    if (state.peakWristFrame < 0) return null;

    const peakIdx = state.peakWristFrame - baseFrame;
    const startIdx = Math.max(
      0,
      (riseStartFrame >= 0 ? riseStartFrame : baseFrame) - baseFrame,
    );
    // Need a few frames of rise to find a turning point within.
    if (peakIdx - startIdx < 2) return null;

    // Basket direction from facing: mean(nose.x − ear.x) over the rise. A
    // side-on shooter has a clear sign; a frontal view is ~0 → bail.
    let faceSum = 0;
    for (let i = startIdx; i <= peakIdx; i++) faceSum += frameData[i]!.faceDir;
    const faceMean = faceSum / (peakIdx - startIdx + 1);
    const MIN_FACING = 0.02; // normalized; below this the view is too frontal
    if (Math.abs(faceMean) < MIN_FACING) return null;
    const basketDir = Math.sign(faceMean); // +1: basket at +x, −1: at −x

    // The wrist must actually travel horizontally during the rise, else
    // there's no meaningful turning point (fall back to the height peak).
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = startIdx; i <= peakIdx; i++) {
      const x = frameData[i]!.avgWristX;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const MIN_TRAVEL = 0.03; // normalized wrist X range over the rise
    if (maxX - minX < MIN_TRAVEL) return null;

    // Set point = furthest from the basket (turning point before the push).
    let bestIdx = startIdx;
    let bestVal = basketDir * frameData[startIdx]!.avgWristX;
    for (let i = startIdx + 1; i <= peakIdx; i++) {
      const v = basketDir * frameData[i]!.avgWristX;
      if (v < bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }

    const setPointFrame = baseFrame + bestIdx;
    // Must leave at least one rise frame before it.
    if (setPointFrame <= (riseStartFrame >= 0 ? riseStartFrame : baseFrame)) {
      return null;
    }
    return setPointFrame;
  }

  /**
   * Finds key biomechanical points in the sequence.
   */
  private findKeyPoints(frameData: FrameAnalysis[], state: PhaseState): void {
    // Find peak wrist position (minimum Y = highest point)
    for (const frame of frameData) {
      if (frame.avgWristY < state.peakWristY) {
        state.peakWristY = frame.avgWristY;
        state.peakWristFrame = frame.frameIndex;
      }
    }

    // Find maximum hip drop (maximum Y = lowest point during load)
    // Only look before the wrist peak
    for (const frame of frameData) {
      if (frame.frameIndex <= state.peakWristFrame) {
        if (frame.avgHipY > state.maxHipY) {
          state.maxHipY = frame.avgHipY;
          state.maxHipFrame = frame.frameIndex;
        }
      }
    }

    // Check if hands come together at any point
    const minSeparation = Math.min(...frameData.map((f) => f.handSeparation));
    state.handsTogetheer = minSeparation < 0.5;
  }

  /**
   * Assigns phase ranges based on key points and transitions.
   */
  private assignPhases(
    frameData: FrameAnalysis[],
    state: PhaseState,
    baseFrame: number,
  ): void {
    const n = frameData.length;
    if (n < 3) return;

    // Find key transition points
    let gatherStart = -1;
    let gatherEnd = -1;
    let loadStart = -1;
    let loadEnd = -1;
    let riseStart = -1;
    let riseEnd = -1;
    let setPointStart = -1;
    let setPointEnd = -1;
    let releaseStart = -1;
    let releaseEnd = -1;
    let followThroughStart = -1;
    let followThroughEnd = -1;

    // === GATHER DETECTION ===
    // Gather starts when hands begin moving together and wrists start rising
    // Look for initial downward or together movement before the upward motion starts
    let sustainedUpwardStart = -1;
    for (let i = 1; i < n; i++) {
      const frame = frameData[i]!;

      // Check for sustained upward movement (negative velocity)
      if (frame.wristVelocity < this.config.wristVelocityThreshold) {
        if (sustainedUpwardStart === -1) {
          sustainedUpwardStart = i - 1;
        }
      } else if (sustainedUpwardStart !== -1) {
        // If we had sustained upward movement for at least 3 frames, this is likely the rise
        if (i - sustainedUpwardStart >= 3) {
          break;
        }
        sustainedUpwardStart = -1;
      }
    }

    // Gather is from the start to just before sustained upward movement
    if (sustainedUpwardStart > 0) {
      gatherStart = baseFrame;
      gatherEnd = baseFrame + Math.max(0, sustainedUpwardStart - 1);

      // Ensure gather has minimum duration
      if (gatherEnd - gatherStart + 1 >= this.config.minPhaseDuration) {
        state.phases.set(ShotPhase.Gather, {
          startFrame: gatherStart,
          endFrame: gatherEnd,
        });
      }
    }

    // === LOAD DETECTION ===
    // Load phase: look for hip drop (increasing Y) and knee bending
    // Find where hip Y increases significantly from initial position
    let hipDropStart = -1;
    let hipDropPeak = -1;
    const hipDropThreshold = this.config.hipDropThreshold;

    for (let i = 1; i < n; i++) {
      const frame = frameData[i]!;

      // Hip dropping = Y increasing (moving down in image coords)
      if (frame.avgHipY > state.initialHipY + hipDropThreshold) {
        if (hipDropStart === -1) {
          hipDropStart = frame.frameIndex;
        }
        if (frame.avgHipY >= state.maxHipY - hipDropThreshold) {
          hipDropPeak = frame.frameIndex;
        }
      }
    }

    if (
      hipDropStart !== -1 &&
      hipDropPeak !== -1 &&
      hipDropStart < state.peakWristFrame
    ) {
      loadStart = hipDropStart;
      loadEnd = hipDropPeak;

      // Ensure load doesn't overlap too much with gather
      if (gatherEnd !== -1 && loadStart <= gatherEnd) {
        loadStart = gatherEnd + 1;
      }

      if (
        loadStart <= loadEnd &&
        loadEnd - loadStart + 1 >= this.config.minPhaseDuration
      ) {
        state.phases.set(ShotPhase.Load, {
          startFrame: loadStart,
          endFrame: loadEnd,
        });
      }
    }

    // === RISE DETECTION ===
    // Rise phase: sustained upward wrist movement with knee extension
    // Find where wrists consistently move upward (negative velocity)
    let consistentRiseStart = -1;
    let consistentRiseEnd = -1;
    let consecutiveUpward = 0;

    for (let i = 1; i < n; i++) {
      const frame = frameData[i]!;

      if (
        frame.wristVelocity < this.config.wristVelocityThreshold &&
        frame.frameIndex < state.peakWristFrame
      ) {
        if (consistentRiseStart === -1) {
          consistentRiseStart = frame.frameIndex;
        }
        consecutiveUpward++;
        consistentRiseEnd = frame.frameIndex;
      } else if (consecutiveUpward > 0 && consecutiveUpward < 3) {
        // Reset if not sustained
        consistentRiseStart = -1;
        consecutiveUpward = 0;
      }
    }

    if (
      consistentRiseStart !== -1 &&
      consistentRiseEnd !== -1 &&
      consecutiveUpward >= 3
    ) {
      riseStart = consistentRiseStart;
      riseEnd = state.peakWristFrame;

      // Ensure rise doesn't overlap with load
      if (loadEnd !== -1 && riseStart <= loadEnd) {
        riseStart = loadEnd + 1;
      }

      if (
        riseStart <= riseEnd &&
        riseEnd - riseStart + 1 >= this.config.minPhaseDuration
      ) {
        state.phases.set(ShotPhase.Rise, {
          startFrame: riseStart,
          endFrame: riseEnd,
        });
      }
    }

    // === SET POINT DETECTION ===
    // The set point is where the wrists stop moving away from the basket
    // and begin extending toward it — the start of the push to release.
    // This is *earlier* than the wrist's vertical peak (which is full
    // extension, essentially the release). We find it as the horizontal
    // turning point of the wrist; a near-frontal view (no clear horizontal
    // motion) falls back to the old wrist-height-peak plateau.
    const turningFrame = this.findSetPointFrame(
      frameData,
      state,
      riseStart,
      baseFrame,
    );

    if (turningFrame !== null) {
      setPointStart = turningFrame;
      setPointEnd = turningFrame;
      state.phases.set(ShotPhase.SetPoint, {
        startFrame: turningFrame,
        endFrame: turningFrame,
      });

      // Rise ends where the set point begins (it previously ran to the
      // vertical peak, which is now part of the release/extension).
      const rise = state.phases.get(ShotPhase.Rise);
      if (rise && rise.endFrame >= turningFrame) {
        const newRiseEnd = turningFrame - 1;
        if (newRiseEnd >= rise.startFrame) {
          state.phases.set(ShotPhase.Rise, {
            startFrame: rise.startFrame,
            endFrame: newRiseEnd,
          });
          riseEnd = newRiseEnd;
        }
      }
    } else if (state.peakWristFrame >= 0) {
      // Fallback: wrist at peak (minimum Y), brief plateau.
      const peakIdx = state.peakWristFrame - baseFrame;
      const peakThreshold = 0.02;
      let setStart = state.peakWristFrame;
      let setEnd = state.peakWristFrame;

      // Expand backward
      for (let i = peakIdx - 1; i >= 0; i--) {
        const frame = frameData[i]!;
        if (Math.abs(frame.avgWristY - state.peakWristY) <= peakThreshold) {
          setStart = frame.frameIndex;
        } else {
          break;
        }
      }

      // Expand forward
      for (let i = peakIdx + 1; i < n; i++) {
        const frame = frameData[i]!;
        if (Math.abs(frame.avgWristY - state.peakWristY) <= peakThreshold) {
          setEnd = frame.frameIndex;
        } else {
          break;
        }
      }

      // Ensure set point doesn't overlap with rise
      if (riseEnd !== -1 && setStart <= riseEnd) {
        setStart = riseEnd + 1;
      }

      setPointStart = setStart;
      setPointEnd = setEnd;

      if (setPointStart <= setPointEnd) {
        state.phases.set(ShotPhase.SetPoint, {
          startFrame: setPointStart,
          endFrame: setPointEnd,
        });
      }
    }

    // === RELEASE DETECTION ===
    // Release: rapid hand separation after set point, typically 2-4 frames
    // The release phase captures the moment of ball release (wrist snap)
    let separationStart = -1;
    let separationEnd = -1;
    // Release is brief - typically 2-4 frames for the actual ball release
    // Everything after is follow-through (arm held/returning)
    const typicalReleaseDuration = 3;

    // Release starts right after set point
    if (setPointEnd !== -1) {
      separationStart = setPointEnd + 1;
      // Calculate how many frames remain
      const remainingFrames = baseFrame + n - 1 - separationStart + 1;

      if (remainingFrames <= typicalReleaseDuration) {
        // Short sequence - release takes most of what remains, leave at least 1 for follow-through
        separationEnd = Math.max(
          separationStart,
          baseFrame + n - 1 - Math.min(2, Math.floor(remainingFrames / 2)),
        );
      } else {
        // Normal sequence - release is fixed duration
        separationEnd = separationStart + typicalReleaseDuration - 1;
      }
    }

    // Fallback if no set point was detected
    if (separationStart === -1 && state.peakWristFrame >= 0) {
      separationStart = state.peakWristFrame + 1;
      const remainingFrames = baseFrame + n - 1 - separationStart + 1;
      if (remainingFrames <= typicalReleaseDuration) {
        separationEnd = Math.max(
          separationStart,
          baseFrame + n - 1 - Math.min(2, Math.floor(remainingFrames / 2)),
        );
      } else {
        separationEnd = separationStart + typicalReleaseDuration - 1;
      }
    }

    if (separationStart !== -1 && separationStart <= separationEnd) {
      releaseStart = separationStart;
      releaseEnd = separationEnd;

      // Ensure release doesn't overlap with set point
      if (setPointEnd !== -1 && releaseStart <= setPointEnd) {
        releaseStart = setPointEnd + 1;
      }

      if (releaseStart <= releaseEnd) {
        state.phases.set(ShotPhase.Release, {
          startFrame: releaseStart,
          endFrame: releaseEnd,
        });
      }
    }

    // === FOLLOW-THROUGH DETECTION ===
    // Follow-through: after release, arm stays extended
    // Determine where follow-through starts based on what phases were detected
    let afterRelease = -1;
    if (releaseEnd !== -1) {
      afterRelease = releaseEnd + 1;
    } else if (setPointEnd !== -1) {
      afterRelease = setPointEnd + 1;
    } else if (state.peakWristFrame >= 0) {
      // Fallback: use peak wrist frame + 1
      afterRelease = state.peakWristFrame + 1;
    }

    const lastFrameIndex = baseFrame + n - 1;

    if (afterRelease !== -1 && afterRelease <= lastFrameIndex) {
      followThroughStart = afterRelease;
      followThroughEnd = lastFrameIndex;

      // Ensure follow-through doesn't overlap with release
      if (releaseEnd !== -1 && followThroughStart <= releaseEnd) {
        followThroughStart = releaseEnd + 1;
      }

      // For follow-through at end of sequence, allow even 1 frame
      // (shot may be cut off, so we want to capture what we can)
      const isEndOfSequence = followThroughEnd === lastFrameIndex;
      const minDuration = isEndOfSequence ? 1 : this.config.minPhaseDuration;

      if (
        followThroughStart <= followThroughEnd &&
        followThroughEnd - followThroughStart + 1 >= minDuration
      ) {
        state.phases.set(ShotPhase.FollowThrough, {
          startFrame: followThroughStart,
          endFrame: followThroughEnd,
        });
      }
    }
  }

  /**
   * Calculates overall confidence for the phase detection.
   */
  private calculateOverallConfidence(
    frameData: FrameAnalysis[],
    phases: ShotPhases,
  ): number {
    if (frameData.length === 0) return 0;

    // Base confidence from landmark quality
    const avgLandmarkConfidence =
      frameData.reduce((sum, f) => sum + f.avgConfidence, 0) / frameData.length;

    // Count detected phases (more phases = higher confidence)
    const detectedPhases = Object.keys(phases).length;
    const phaseRatio = detectedPhases / 6; // 6 possible phases

    // Calculate coverage (what percentage of frames are covered by phases)
    let coveredFrames = 0;
    const allFrames = new Set<number>();
    for (const frame of frameData) {
      allFrames.add(frame.frameIndex);
    }

    for (const range of Object.values(phases)) {
      if (range) {
        for (let i = range.startFrame; i <= range.endFrame; i++) {
          if (allFrames.has(i)) {
            coveredFrames++;
          }
        }
      }
    }
    const coverage = allFrames.size > 0 ? coveredFrames / allFrames.size : 0;

    // Combined confidence
    const confidence =
      avgLandmarkConfidence * 0.3 + phaseRatio * 0.4 + coverage * 0.3;

    return Math.min(1, Math.max(0, confidence));
  }
}

/**
 * Factory function to create a PhaseDetector.
 *
 * @param config - Optional configuration options
 * @returns A new PhaseDetector instance
 */
export function createPhaseDetector(
  config: PhaseDetectorConfig = {},
): PhaseDetector {
  return new PhaseDetector(config);
}
