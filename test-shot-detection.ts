#!/usr/bin/env npx tsx
/**
 * Direct test for shot detection logic using synthetic pose data.
 * This simulates the wrist motion patterns from the labeled video.
 */

import { ShotBoundaryDetector } from './src/detection/shot-detector';
import type { PoseLandmarks } from './src/pose/types';
import { LANDMARK_INDEX } from './src/pose/types';

// Based on chris 5_labels.json:
// - legs_start_bending: 55
// - ball_starts_upward: 60
// - set_point: 70
// - arms_fully_extended: 76
// - feet_land: 80

function createMockLandmarks(wristY: number, shoulderY: number = 0.4): PoseLandmarks {
  // Create a minimal landmarks array with just the landmarks we need
  const landmarks = new Array(33).fill(null).map(() => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  // Set wrist positions (both left and right to same Y for simplicity)
  landmarks[LANDMARK_INDEX.LEFT_WRIST] = { x: 0.4, y: wristY, z: 0, visibility: 0.9 };
  landmarks[LANDMARK_INDEX.RIGHT_WRIST] = { x: 0.6, y: wristY, z: 0, visibility: 0.9 };

  // Set shoulder positions
  landmarks[LANDMARK_INDEX.LEFT_SHOULDER] = { x: 0.35, y: shoulderY, z: 0, visibility: 0.9 };
  landmarks[LANDMARK_INDEX.RIGHT_SHOULDER] = { x: 0.65, y: shoulderY, z: 0, visibility: 0.9 };

  return {
    landmarks,
    poseConfidence: 0.9,
    timestamp: 0,
    frameIndex: 0,
  };
}

function generateShotSequence(totalFrames: number): PoseLandmarks[] {
  const sequence: PoseLandmarks[] = [];

  // Shot phases based on labels:
  // Frame 0-54: Idle/preparation - wrists at mid height (~0.5)
  // Frame 55-59: Ball starts dipping - wrists go down slightly (~0.55)
  // Frame 60-70: Ball rises - wrists go up (Y decreases from 0.5 to 0.3)
  // Frame 70-76: Extension - wrists at highest point (~0.25)
  // Frame 77-80: Release/follow-through - wrists come back down (~0.35)
  // Frame 81+: Recovery - wrists return to mid height (~0.5)

  for (let i = 0; i < totalFrames; i++) {
    let wristY: number;

    if (i < 55) {
      // Idle - slight variation around 0.5
      wristY = 0.5 + Math.sin(i * 0.1) * 0.02;
    } else if (i < 60) {
      // Ball dip - wrists go down slightly
      const t = (i - 55) / 5;
      wristY = 0.5 + t * 0.05; // Goes from 0.5 to 0.55
    } else if (i < 70) {
      // Ball rises - wrists go up (Y decreases)
      const t = (i - 60) / 10;
      wristY = 0.55 - t * 0.30; // Goes from 0.55 to 0.25
    } else if (i < 76) {
      // Extension - wrists at highest
      const t = (i - 70) / 6;
      wristY = 0.25 - t * 0.03; // Goes from 0.25 to 0.22 (peak)
    } else if (i < 85) {
      // Follow-through - wrists come down
      const t = (i - 76) / 9;
      wristY = 0.22 + t * 0.18; // Goes from 0.22 to 0.40
    } else {
      // Recovery
      const t = Math.min(1, (i - 85) / 15);
      wristY = 0.40 + t * 0.10; // Goes back to 0.5
    }

    const landmarks = createMockLandmarks(wristY);
    landmarks.frameIndex = i;
    landmarks.timestamp = i * (1000 / 30); // 30fps
    sequence.push(landmarks);
  }

  return sequence;
}

// Run the test
console.log('=== Shot Detection Test with Synthetic Data ===\n');

const detector = new ShotBoundaryDetector();
const sequence = generateShotSequence(124);

// Log wrist positions for frames 50-90
console.log('Wrist Y positions for frames 50-90:');
for (let i = 50; i < 90 && i < sequence.length; i++) {
  const wristY = sequence[i]!.landmarks[LANDMARK_INDEX.LEFT_WRIST]!.y;
  const prevWristY = i > 0 ? sequence[i - 1]!.landmarks[LANDMARK_INDEX.LEFT_WRIST]!.y : wristY;
  const velocity = wristY - prevWristY;
  const marker = velocity < -0.015 ? ' <-- UPWARD' : velocity > 0.015 ? ' <-- DOWNWARD' : '';
  console.log(`  Frame ${i}: wristY=${wristY.toFixed(3)}, velocity=${velocity.toFixed(4)}${marker}`);
}

console.log('\nRunning shot detection...\n');

const shots = detector.detectShots(sequence);

console.log(`\nDetected ${shots.length} shot(s)`);

if (shots.length > 0) {
  for (const shot of shots) {
    console.log(`  Shot: frames ${shot.start.frameIndex} - ${shot.end.frameIndex}`);
    console.log(`    Start confidence: ${shot.start.confidence.toFixed(2)}`);
    console.log(`    End confidence: ${shot.end.confidence.toFixed(2)}`);
  }
} else {
  console.log('\nNo shots detected. Checking detector internals...');

  // Run detectBoundaries to see what's happening
  const boundaries = detector.detectBoundaries(sequence);
  console.log(`Boundaries found: ${boundaries.length}`);
  for (const b of boundaries) {
    console.log(`  ${b.type} at frame ${b.frameIndex}, confidence: ${b.confidence.toFixed(2)}`);
  }
}
