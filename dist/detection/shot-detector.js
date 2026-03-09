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
import { LANDMARK_INDEX } from "../pose/types";
import { movingAverage } from "../utils/smoothing";
/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
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
 * Maximum velocity that indicates invalid data (pose dropout recovery).
 * If velocity exceeds this, it's likely due to pose reappearing after a gap.
 */
const MAX_VALID_VELOCITY = 0.1;
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
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Detects all shot boundaries in a sequence of pose landmarks.
     *
     * @param sequence - Array of PoseLandmarks from consecutive frames
     * @param originalFrameIndices - Optional array mapping sequence indices to original frame numbers
     * @returns Array of detected boundaries (start/end pairs)
     */
    detectBoundaries(sequence, originalFrameIndices) {
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
        const upwardFrames = velocities.filter((v) => v < -this.config.velocityThreshold).length;
        console.log(`[ShotDetector] Velocity stats: min=${minVel.toFixed(4)}, max=${maxVel.toFixed(4)}, avg=${avgVel.toFixed(4)}`);
        console.log(`[ShotDetector] Threshold: ${this.config.velocityThreshold}, frames exceeding: ${upwardFrames}`);
        console.log(`[ShotDetector] Wrist Y range: ${Math.min(...frameData.map((f) => f.avgWristY)).toFixed(3)} - ${Math.max(...frameData.map((f) => f.avgWristY)).toFixed(3)}`);
        // Debug: Log frames 50-85 (expected shot range based on labels)
        console.log(`[ShotDetector] Frame-by-frame analysis for shot region (50-85):`);
        for (let i = 50; i < Math.min(85, frameData.length); i++) {
            const f = frameData[i];
            if (f) {
                const marker = f.wristVelocity < -this.config.velocityThreshold ? " <-- UPWARD" : "";
                console.log(`  Frame ${i}: wristY=${f.avgWristY.toFixed(3)}, velocity=${f.wristVelocity.toFixed(4)}${marker}`);
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
    detectShots(sequence, originalFrameIndices) {
        const boundaries = this.detectBoundaries(sequence, originalFrameIndices);
        return this.pairBoundaries(boundaries, sequence.length);
    }
    /**
     * Extracts relevant landmark data from each frame.
     */
    extractFrameData(sequence, originalFrameIndices) {
        const frameData = [];
        for (let i = 0; i < sequence.length; i++) {
            const landmarks = sequence[i].landmarks;
            const leftWrist = landmarks[LANDMARK_INDEX.LEFT_WRIST];
            const rightWrist = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
            const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
            const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
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
            const smoothedY = movingAverage(avgWristYValues, this.config.smoothingWindowSize);
            for (let i = 0; i < frameData.length; i++) {
                // Create new object to maintain immutability of input
                frameData[i].avgWristY = smoothedY[i];
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
    calculateVelocities(frameData) {
        for (let i = 1; i < frameData.length; i++) {
            const current = frameData[i];
            const previous = frameData[i - 1];
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
            frameData[0].wristVelocity = 0;
        }
    }
    /**
     * Finds shot start and end boundaries based on velocity patterns.
     * Uses gap tolerance to handle small breaks in upward motion.
     */
    findBoundaries(frameData, totalFrames) {
        const boundaries = [];
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
            const frame = frameData[i];
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
                        console.log(`[ShotDetector] Frame gap ${originalGap} at filtered ${i} (orig ${frame.originalFrameIndex}), resetting`);
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
                    if (upwardFrameCount >= this.config.minUpwardFrames &&
                        shotStartFrame === -1) {
                        // Start of potential shot - look back to find actual start
                        shotStartFrame = this.findMotionStart(frameData, i);
                        console.log(`[ShotDetector] Potential shot start at frame ${shotStartFrame}`);
                    }
                    // Track peak (lowest Y = highest position)
                    if (frame.avgWristY < peakY) {
                        peakY = frame.avgWristY;
                        peakFrame = i;
                    }
                }
                else {
                    gapFrames++;
                    // If we have a potential shot and gap is too large, evaluate
                    if (shotStartFrame !== -1 && gapFrames > MAX_GAP_FRAMES) {
                        // Calculate total motion range (Y drop from start to peak)
                        const startY = frameData[shotStartFrame]?.avgWristY ?? 0;
                        const yRange = startY - peakY;
                        // Require minimum upward frames AND minimum Y range for a valid shot
                        const minFrames = this.config.minShotDuration / 2;
                        const minYRange = 0.08; // Minimum 8% of frame height movement
                        console.log(`[ShotDetector] Gap at frame ${i}: upwardFrames=${upwardFrameCount}, yRange=${yRange.toFixed(3)}`);
                        if (upwardFrameCount >= minFrames && yRange >= minYRange) {
                            // Confirmed shot start
                            inShot = true;
                            boundaries.push({
                                type: "start",
                                frameIndex: shotStartFrame,
                                confidence: this.calculateStartConfidence(frameData, shotStartFrame, peakFrame),
                                isPartial: shotStartFrame === 0,
                            });
                            console.log(`[ShotDetector] Confirmed shot start at frame ${shotStartFrame} (upward=${upwardFrameCount}, yRange=${yRange.toFixed(3)})`);
                        }
                        else {
                            // Too short or not enough movement, reset
                            console.log(`[ShotDetector] Rejected as pump fake (upward=${upwardFrameCount} < ${minFrames} or yRange=${yRange.toFixed(3)} < ${minYRange})`);
                            shotStartFrame = -1;
                            peakY = Infinity;
                            peakFrame = -1;
                        }
                        upwardFrameCount = 0;
                    }
                }
            }
            else {
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
            if (upwardFrameCount >= minFrames && yRange >= minYRange) {
                boundaries.push({
                    type: "start",
                    frameIndex: shotStartFrame,
                    confidence: this.calculateStartConfidence(frameData, shotStartFrame, frameData.length - 1),
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
    findMotionStart(frameData, currentFrame) {
        // Look back up to 10 frames to find where the motion truly started
        const lookback = 10;
        let startFrame = currentFrame;
        for (let i = currentFrame - 1; i >= Math.max(0, currentFrame - lookback); i--) {
            const frame = frameData[i];
            const nextFrame = frameData[i + 1];
            if (!frame || !nextFrame)
                break;
            // If velocity was still negative (upward), keep looking back
            if (nextFrame.wristVelocity < 0) {
                startFrame = i;
            }
            else {
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
    checkStartsInMotion(frameData) {
        if (frameData.length < this.config.minUpwardFrames + 1) {
            return false;
        }
        // Check if the first few frames have consistent upward velocity
        let upwardCount = 0;
        for (let i = 1; i < Math.min(frameData.length, this.config.minUpwardFrames + 2); i++) {
            if (frameData[i].wristVelocity < -this.config.velocityThreshold) {
                upwardCount++;
            }
        }
        // If most of the initial frames show upward motion, we're starting mid-shot
        return upwardCount >= this.config.minUpwardFrames;
    }
    /**
     * Calculates confidence score for a shot start detection.
     */
    calculateStartConfidence(frameData, startFrame, endFrame) {
        // Calculate average upward velocity during the rise
        let totalVelocity = 0;
        let count = 0;
        for (let i = startFrame + 1; i <= endFrame && i < frameData.length; i++) {
            if (frameData[i].wristVelocity < 0) {
                totalVelocity += Math.abs(frameData[i].wristVelocity);
                count++;
            }
        }
        if (count === 0)
            return 0.5;
        const avgVelocity = totalVelocity / count;
        // Map velocity to confidence (higher velocity = higher confidence)
        const confidence = Math.min(1, avgVelocity / 0.05 + 0.5);
        return Math.round(confidence * 100) / 100;
    }
    /**
     * Calculates confidence score for a shot end detection.
     */
    calculateEndConfidence(frameData, peakFrame, endFrame) {
        if (peakFrame < 0 || endFrame <= peakFrame)
            return 0.5;
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
    pairBoundaries(boundaries, totalFrames) {
        const shots = [];
        const starts = boundaries.filter((b) => b.type === "start");
        const ends = boundaries.filter((b) => b.type === "end");
        for (let i = 0; i < starts.length; i++) {
            const start = starts[i];
            // Find the matching end (first end after this start)
            const matchingEnd = ends.find((e) => e.frameIndex > start.frameIndex &&
                (i === starts.length - 1 ||
                    e.frameIndex < (starts[i + 1]?.frameIndex ?? totalFrames)));
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
export function createShotBoundaryDetector(config = {}) {
    return new ShotBoundaryDetector(config);
}
//# sourceMappingURL=shot-detector.js.map