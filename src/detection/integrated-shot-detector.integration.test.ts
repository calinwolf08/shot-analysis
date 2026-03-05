/**
 * Integration tests for ShotDetector with realistic landmark sequences.
 * Tests the full detection pipeline with various shot scenarios.
 *
 * @see Feature 4.4.9 - Integration tests with realistic landmark sequences
 */

import { describe, it, expect } from "vitest";
import { createShotDetector } from "./integrated-shot-detector";
import { ShotPhase } from "./types";
import type { PoseLandmarks, Landmark } from "../pose/types";
import { LANDMARK_INDEX } from "../pose/types";

/**
 * Helper to create a single landmark with default values.
 */
function createLandmark(
  x: number,
  y: number,
  z: number = 0,
  visibility: number = 0.95,
  confidence: number = 0.95,
): Landmark {
  return { x, y, z, visibility, confidence };
}

/**
 * Helper to create a full set of 33 landmarks with realistic body proportions.
 */
function createRealisticLandmarks(
  wristY: number,
  hipY: number = 0.55,
  kneeAngleFactor: number = 1, // 1 = standing, < 1 = bent
): Landmark[] {
  const landmarks: Landmark[] = [];

  // Initialize all with default values
  for (let i = 0; i < 33; i++) {
    landmarks.push(createLandmark(0.5, 0.5, 0));
  }

  // Face landmarks (relative to body position)
  const headY = 0.15;
  landmarks[LANDMARK_INDEX.NOSE] = createLandmark(0.5, headY);
  landmarks[LANDMARK_INDEX.LEFT_EYE] = createLandmark(0.48, headY - 0.02);
  landmarks[LANDMARK_INDEX.RIGHT_EYE] = createLandmark(0.52, headY - 0.02);
  landmarks[LANDMARK_INDEX.LEFT_EAR] = createLandmark(0.46, headY);
  landmarks[LANDMARK_INDEX.RIGHT_EAR] = createLandmark(0.54, headY);

  // Shoulders
  const shoulderY = 0.28;
  landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = createLandmark(0.4, shoulderY);
  landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = createLandmark(0.6, shoulderY);

  // Elbows - position between shoulders and wrists
  const elbowY = (shoulderY + wristY) / 2;
  landmarks[LANDMARK_INDEX.LEFT_ELBOW] = createLandmark(0.38, elbowY);
  landmarks[LANDMARK_INDEX.RIGHT_ELBOW] = createLandmark(0.62, elbowY);

  // Wrists and hands
  landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.42, wristY);
  landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.58, wristY);
  landmarks[LANDMARK_INDEX.LEFT_INDEX] = createLandmark(0.43, wristY - 0.03);
  landmarks[LANDMARK_INDEX.RIGHT_INDEX] = createLandmark(0.57, wristY - 0.03);
  landmarks[LANDMARK_INDEX.LEFT_PINKY] = createLandmark(0.41, wristY - 0.02);
  landmarks[LANDMARK_INDEX.RIGHT_PINKY] = createLandmark(0.59, wristY - 0.02);
  landmarks[LANDMARK_INDEX.LEFT_THUMB] = createLandmark(0.44, wristY - 0.01);
  landmarks[LANDMARK_INDEX.RIGHT_THUMB] = createLandmark(0.56, wristY - 0.01);

  // Hips
  landmarks[LANDMARK_INDEX.LEFT_HIP] = createLandmark(0.45, hipY);
  landmarks[LANDMARK_INDEX.RIGHT_HIP] = createLandmark(0.55, hipY);

  // Knees - affected by kneeAngleFactor
  const baseKneeY = 0.75;
  const kneeY = baseKneeY - (1 - kneeAngleFactor) * 0.05;
  landmarks[LANDMARK_INDEX.LEFT_KNEE] = createLandmark(0.45, kneeY);
  landmarks[LANDMARK_INDEX.RIGHT_KNEE] = createLandmark(0.55, kneeY);

  // Ankles
  const ankleY = 0.92;
  landmarks[LANDMARK_INDEX.LEFT_ANKLE] = createLandmark(0.45, ankleY);
  landmarks[LANDMARK_INDEX.RIGHT_ANKLE] = createLandmark(0.55, ankleY);
  landmarks[LANDMARK_INDEX.LEFT_HEEL] = createLandmark(0.44, ankleY + 0.02);
  landmarks[LANDMARK_INDEX.RIGHT_HEEL] = createLandmark(0.56, ankleY + 0.02);
  landmarks[LANDMARK_INDEX.LEFT_FOOT_INDEX] = createLandmark(0.46, ankleY + 0.04);
  landmarks[LANDMARK_INDEX.RIGHT_FOOT_INDEX] = createLandmark(0.54, ankleY + 0.04);

  return landmarks;
}

/**
 * Helper to create PoseLandmarks from landmark array.
 */
function createPoseLandmarks(
  landmarks: Landmark[],
  poseConfidence: number = 0.95,
): PoseLandmarks {
  return { landmarks, poseConfidence };
}

/**
 * Creates a realistic basketball shot sequence with proper biomechanics.
 *
 * Phases:
 * 1. Gather (frames 0-8): Player catches ball, hands come together
 * 2. Load (frames 9-14): Knees bend, hips drop, ball at pocket
 * 3. Rise (frames 15-25): Explosive upward motion, ball rises
 * 4. Set Point (frames 26-30): Ball at peak, ready to release
 * 5. Release (frames 31-35): Ball leaves hands
 * 6. Follow Through (frames 36-45): Arm extended, hold position
 */
function createRealisticShotSequence(): PoseLandmarks[] {
  const frames: PoseLandmarks[] = [];

  // Gather phase (0-8): Ball at waist level, hands coming together
  for (let i = 0; i <= 8; i++) {
    const wristY = 0.55 - i * 0.01; // Gradually raising hands
    const landmarks = createRealisticLandmarks(wristY);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Load phase (9-14): Knees bend, slight hip drop, ball at shooting pocket
  for (let i = 9; i <= 14; i++) {
    const progress = (i - 9) / 5;
    const wristY = 0.46 - progress * 0.02; // Hands stay relatively stable
    const hipY = 0.55 + progress * 0.03; // Hips drop
    const kneeAngleFactor = 1 - progress * 0.2; // Knees bend
    const landmarks = createRealisticLandmarks(wristY, hipY, kneeAngleFactor);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Rise phase (15-25): Explosive upward motion
  for (let i = 15; i <= 25; i++) {
    const progress = (i - 15) / 10;
    const wristY = 0.44 - progress * 0.32; // Rapid upward motion
    const hipY = 0.58 - progress * 0.05; // Hips rise
    const kneeAngleFactor = 0.8 + progress * 0.2; // Knees extend
    const landmarks = createRealisticLandmarks(wristY, hipY, kneeAngleFactor);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Set Point phase (26-30): Ball at peak
  for (let i = 26; i <= 30; i++) {
    const wristY = 0.12 + (i - 26) * 0.005; // Slight variation at peak
    const landmarks = createRealisticLandmarks(wristY, 0.53);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Release phase (31-35): Ball leaves hands
  for (let i = 31; i <= 35; i++) {
    const progress = (i - 31) / 4;
    const wristY = 0.125 + progress * 0.08; // Hands start to separate
    const landmarks = createRealisticLandmarks(wristY, 0.54);
    // Shooting hand stays higher, guide hand drops
    landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.38, wristY + progress * 0.15);
    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.58, wristY - progress * 0.02);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Follow Through phase (36-45): Arm extended, gradual return
  for (let i = 36; i <= 45; i++) {
    const progress = (i - 36) / 9;
    const leftWristY = 0.28 + progress * 0.25;
    const rightWristY = 0.13 + progress * 0.35;
    const landmarks = createRealisticLandmarks(leftWristY, 0.55);
    landmarks[LANDMARK_INDEX.LEFT_WRIST] = createLandmark(0.35, leftWristY);
    landmarks[LANDMARK_INDEX.RIGHT_WRIST] = createLandmark(0.58, rightWristY);
    frames.push(createPoseLandmarks(landmarks));
  }

  return frames;
}

/**
 * Creates a quick release shot (Curry-style) with abbreviated phases.
 */
function createQuickReleaseShotSequence(): PoseLandmarks[] {
  const frames: PoseLandmarks[] = [];

  // Abbreviated gather/load (0-4)
  for (let i = 0; i <= 4; i++) {
    const wristY = 0.5 - i * 0.06;
    const landmarks = createRealisticLandmarks(wristY, 0.55 + i * 0.01);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Quick rise (5-10)
  for (let i = 5; i <= 10; i++) {
    const progress = (i - 5) / 5;
    const wristY = 0.26 - progress * 0.18;
    const landmarks = createRealisticLandmarks(wristY, 0.56 - progress * 0.02);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Brief set point (11-12)
  for (let i = 11; i <= 12; i++) {
    const landmarks = createRealisticLandmarks(0.08, 0.54);
    frames.push(createPoseLandmarks(landmarks));
  }

  // Quick release and follow through (13-20)
  for (let i = 13; i <= 20; i++) {
    const progress = (i - 13) / 7;
    const wristY = 0.1 + progress * 0.45;
    const landmarks = createRealisticLandmarks(wristY, 0.55);
    frames.push(createPoseLandmarks(landmarks));
  }

  return frames;
}

/**
 * Creates a sequence with two shots separated by a gap.
 */
function createTwoShotsSequence(): PoseLandmarks[] {
  const shot1 = createRealisticShotSequence();

  // Gap between shots (neutral stance)
  const gap: PoseLandmarks[] = [];
  for (let i = 0; i < 25; i++) {
    const landmarks = createRealisticLandmarks(0.55);
    gap.push(createPoseLandmarks(landmarks));
  }

  const shot2 = createRealisticShotSequence();

  return [...shot1, ...gap, ...shot2];
}

describe("ShotDetector Integration Tests", () => {
  describe("realistic shot detection", () => {
    it("detects a complete shot with all phases", () => {
      const detector = createShotDetector();
      const sequence = createRealisticShotSequence();
      const shots = detector.processFrames(sequence);

      expect(shots.length).toBe(1);

      const shot = shots[0]!;
      expect(shot.shotIndex).toBe(0);
      expect(shot.frameRange.start).toBeGreaterThanOrEqual(0);
      expect(shot.frameRange.end).toBeLessThanOrEqual(sequence.length - 1);
    });

    it("identifies key phases in a realistic shot", () => {
      const detector = createShotDetector();
      const sequence = createRealisticShotSequence();
      const shots = detector.processFrames(sequence);

      expect(shots.length).toBe(1);

      const phases = shots[0]!.phases;
      const detectedPhases = Object.keys(phases).filter(
        k => phases[k as ShotPhase] !== undefined
      );

      // Should detect at least 3 phases
      expect(detectedPhases.length).toBeGreaterThanOrEqual(3);
    });

    it("detects set point near the peak of wrist position", () => {
      const detector = createShotDetector();
      const sequence = createRealisticShotSequence();
      const shots = detector.processFrames(sequence);

      if (shots.length > 0 && shots[0]!.phases[ShotPhase.SetPoint]) {
        const setPoint = shots[0]!.phases[ShotPhase.SetPoint]!;
        // Set point should be around frames 26-30 in our sequence
        expect(setPoint.startFrame).toBeGreaterThanOrEqual(20);
        expect(setPoint.endFrame).toBeLessThanOrEqual(35);
      }
    });
  });

  describe("quick release shot detection", () => {
    it("detects a quick release shot", () => {
      const detector = createShotDetector({
        boundaryConfig: {
          minShotDuration: 10, // Allow shorter shots
        },
      });
      const sequence = createQuickReleaseShotSequence();
      const shots = detector.processFrames(sequence);

      expect(shots.length).toBe(1);
    });

    it("handles abbreviated phases in quick release", () => {
      const detector = createShotDetector({
        boundaryConfig: {
          minShotDuration: 10,
        },
      });
      const sequence = createQuickReleaseShotSequence();
      const shots = detector.processFrames(sequence);

      if (shots.length > 0) {
        const shot = shots[0]!;
        // Quick release should still have some phases
        const phaseCount = Object.values(shot.phases).filter(p => p !== undefined).length;
        expect(phaseCount).toBeGreaterThan(0);
      }
    });
  });

  describe("multiple shots detection", () => {
    it("detects two consecutive shots", () => {
      const detector = createShotDetector();
      const sequence = createTwoShotsSequence();
      const shots = detector.processFrames(sequence);

      expect(shots.length).toBe(2);
    });

    it("assigns correct shot indices to multiple shots", () => {
      const detector = createShotDetector();
      const sequence = createTwoShotsSequence();
      const shots = detector.processFrames(sequence);

      if (shots.length >= 2) {
        expect(shots[0]!.shotIndex).toBe(0);
        expect(shots[1]!.shotIndex).toBe(1);
      }
    });

    it("separates shots with distinct frame ranges", () => {
      const detector = createShotDetector();
      const sequence = createTwoShotsSequence();
      const shots = detector.processFrames(sequence);

      if (shots.length >= 2) {
        // Second shot should start after first shot ends
        expect(shots[1]!.frameRange.start).toBeGreaterThan(shots[0]!.frameRange.end);
      }
    });
  });

  describe("incremental processing equivalence", () => {
    it("produces same results as batch processing", () => {
      const batchDetector = createShotDetector();
      const incrementalDetector = createShotDetector();

      const sequence = createRealisticShotSequence();

      // Batch processing
      const batchShots = batchDetector.processFrames(sequence);

      // Incremental processing
      for (const frame of sequence) {
        incrementalDetector.processFrame(frame);
      }
      const incrementalShots = incrementalDetector.finalize();

      // Should detect same number of shots
      expect(incrementalShots.length).toBe(batchShots.length);

      // Shot ranges should be the same
      if (batchShots.length > 0 && incrementalShots.length > 0) {
        expect(incrementalShots[0]!.frameRange.start).toBe(batchShots[0]!.frameRange.start);
        expect(incrementalShots[0]!.frameRange.end).toBe(batchShots[0]!.frameRange.end);
      }
    });

    it("provides real-time phase detection during processing", () => {
      const detector = createShotDetector();
      const sequence = createRealisticShotSequence();

      const phaseChanges: Array<{ frame: number; phase?: string | undefined }> = [];
      let lastPhase: string | undefined;

      for (let i = 0; i < sequence.length; i++) {
        const result = detector.processFrame(sequence[i]!);
        if (result.currentPhase !== lastPhase) {
          phaseChanges.push({ frame: i, phase: result.currentPhase });
          lastPhase = result.currentPhase;
        }
      }

      // Should see some phase transitions during the shot
      expect(phaseChanges.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases with realistic data", () => {
    it("handles sequence with player standing still", () => {
      const detector = createShotDetector();
      const stillFrames: PoseLandmarks[] = [];

      for (let i = 0; i < 60; i++) {
        const landmarks = createRealisticLandmarks(0.55);
        stillFrames.push(createPoseLandmarks(landmarks));
      }

      const shots = detector.processFrames(stillFrames);
      expect(shots.length).toBe(0);
    });

    it("handles sequence with walking motion (not shooting)", () => {
      const detector = createShotDetector();
      const walkingFrames: PoseLandmarks[] = [];

      for (let i = 0; i < 60; i++) {
        // Slight arm swing while walking
        const armSwing = Math.sin(i * 0.3) * 0.05;
        const landmarks = createRealisticLandmarks(0.55 + armSwing);
        walkingFrames.push(createPoseLandmarks(landmarks));
      }

      const shots = detector.processFrames(walkingFrames);
      // Walking should not be detected as a shot
      expect(shots.length).toBe(0);
    });

    it("handles partial shot at beginning of sequence", () => {
      const detector = createShotDetector();
      const fullSequence = createRealisticShotSequence();

      // Take only the second half of the shot (mid-rise to end)
      const partialSequence = fullSequence.slice(15);

      const shots = detector.processFrames(partialSequence);

      // Should still detect the partial shot
      // The shot may start at frame 0 or 1 depending on detection algorithm
      if (shots.length > 0) {
        expect(shots[0]!.frameRange.start).toBeLessThanOrEqual(5);
      }
    });

    it("handles partial shot at end of sequence", () => {
      const detector = createShotDetector();
      const fullSequence = createRealisticShotSequence();

      // Take only the first half of the shot (start to mid-rise)
      const partialSequence = fullSequence.slice(0, 20);

      const shots = detector.processFrames(partialSequence);

      // May or may not detect depending on minimum duration
      // But should not crash
      expect(Array.isArray(shots)).toBe(true);
    });

    it("handles low confidence landmarks", () => {
      const detector = createShotDetector();
      const sequence = createRealisticShotSequence();

      // Lower confidence for some frames
      const lowConfSequence = sequence.map((frame, i) => {
        if (i >= 20 && i <= 30) {
          const landmarks = frame.landmarks.map(l => ({
            ...l,
            confidence: 0.5,
            visibility: 0.6,
          }));
          return { ...frame, landmarks, poseConfidence: 0.5 };
        }
        return frame;
      });

      const shots = detector.processFrames(lowConfSequence);

      // Should still detect the shot despite lower confidence in some frames
      expect(shots.length).toBe(1);
    });
  });

  describe("reset functionality", () => {
    it("allows detection of new shot after reset", () => {
      const detector = createShotDetector();
      const sequence = createRealisticShotSequence();

      // Process first shot
      for (const frame of sequence) {
        detector.processFrame(frame);
      }
      const firstShots = detector.finalize();

      // Reset
      detector.reset();

      // Process second shot
      for (const frame of sequence) {
        detector.processFrame(frame);
      }
      const secondShots = detector.finalize();

      // Both should detect one shot
      expect(firstShots.length).toBe(1);
      expect(secondShots.length).toBe(1);

      // Second shot should have shotIndex 0 (reset)
      expect(secondShots[0]!.shotIndex).toBe(0);
    });
  });
});
