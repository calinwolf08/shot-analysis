import { runDetection, adaptPoseDataToDetector } from './src/testing/detection.js';
import { LANDMARK_INDEX } from './src/pose/types.js';
import * as fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20190804_140617/poses.json', 'utf-8'));
const result = runDetection(poseData);
const adapted = adaptPoseDataToDetector(poseData);

console.log('Detected shots:', result.shots.length);
result.shots.forEach((shot, i) => {
  console.log(`Shot ${i+1}: frame ${shot.startFrame} - ${shot.endFrame}`);
});

// Expected shots from labels:
console.log('\nExpected shots from labels:');
console.log('Shot 1: frame 68 - 106 (side-right)');
console.log('Shot 2: frame 196 - 223 (side-right)');
console.log('Shot 3: frame 838 - 862 (side-left)');

// Check shoulder metrics for each detected shot
console.log('\n--- Shoulder metrics for each detected shot ---');
result.shots.forEach((shot, idx) => {
  let totalShoulderDiffX = 0;
  let totalShoulderZ = 0;
  let validSamples = 0;

  // Find frames in this shot
  for (let i = 0; i < adapted.indexToFrame.length; i++) {
    const frame = adapted.indexToFrame[i];
    if (frame >= shot.startFrame && frame <= shot.endFrame) {
      const pose = adapted.landmarks[i];
      const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];

      if (!leftShoulder || !rightShoulder) continue;
      if ((leftShoulder.visibility ?? 0) < 0.3 || (rightShoulder.visibility ?? 0) < 0.3) continue;

      totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
      totalShoulderZ += rightShoulder.z - leftShoulder.z;
      validSamples++;
    }
  }

  if (validSamples > 0) {
    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgShoulderZ = totalShoulderZ / validSamples;
    const shoulderSep = Math.abs(avgShoulderDiffX);
    const isExpected = idx === 0 || idx === 1 || idx === 5;

    // Also calculate best wrist-above-shoulder delta
    let bestWristAboveShoulder = Infinity;
    for (let i = 0; i < adapted.indexToFrame.length; i++) {
      const frame = adapted.indexToFrame[i];
      if (frame >= shot.startFrame && frame <= shot.endFrame) {
        const pose = adapted.landmarks[i];
        const leftWrist = pose.landmarks[LANDMARK_INDEX.LEFT_WRIST];
        const rightWrist = pose.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
        const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
        const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];

        const avgWristY = (leftWrist.y + rightWrist.y) / 2;
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const delta = avgWristY - avgShoulderY;
        if (delta < bestWristAboveShoulder) {
          bestWristAboveShoulder = delta;
        }
      }
    }

    // Check abs(Z) - for true behind view, abs(Z) should be small (both shoulders equidistant)
    // For side view with body rotation, abs(Z) should be larger (one shoulder closer)
    const absAvgShoulderZ = Math.abs(avgShoulderZ);
    const isLikelyBehindView = shoulderSep > 0.15 && absAvgShoulderZ < 0.35;

    console.log(`\nShot ${idx + 1} (${shot.startFrame}-${shot.endFrame}) ${isExpected ? '✓ EXPECTED' : '✗ FALSE POSITIVE'}`);
    console.log(`  avgShoulderDiffX: ${avgShoulderDiffX.toFixed(4)} (${avgShoulderDiffX > 0 ? 'back view' : 'front view'})`);
    console.log(`  avgShoulderZ: ${avgShoulderZ.toFixed(4)}`);
    console.log(`  abs(avgShoulderZ): ${absAvgShoulderZ.toFixed(4)}`);
    console.log(`  shoulderSep: ${shoulderSep.toFixed(4)}`);
    console.log(`  bestWristAboveShoulder: ${bestWristAboveShoulder.toFixed(4)} ${bestWristAboveShoulder < 0 ? '(wrist above shoulder)' : '(wrist below shoulder)'}`);
    console.log(`  Likely behind view (shoulderSep > 0.15 AND absZ < 0.35): ${isLikelyBehindView ? 'YES' : 'NO'}`);
    console.log(`  Would be filtered by old Filter 1: ${shoulderSep > 0.12 && avgShoulderDiffX > 0 ? 'YES' : 'NO'}`);
  }
});
