import { createShotBoundaryDetector } from './src/detection/shot-detector';
import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// Convert to detector format
const landmarks: any[] = [];
const indexToFrame: number[] = [];

for (const frame of poseData.frames) {
  if (frame.landmarks !== null) {
    landmarks.push({
      landmarks: frame.landmarks.map((l: any) => ({
        ...l,
        confidence: l.visibility
      })),
      poseConfidence: frame.poseConfidence
    });
    indexToFrame.push(frame.frameIndex);
  }
}

// LANDMARK indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

// Analyze each detected shot's false positive range
const falsePositiveRanges = [
  { start: 294, end: 322, label: "False positive 1" },
  { start: 432, end: 446, label: "False positive 2" },
  { start: 550, end: 563, label: "False positive 3" },
  { start: 663, end: 695, label: "False positive 4" },
];

for (const range of falsePositiveRanges) {
  console.log(`\n=== ${range.label} (frames ${range.start}-${range.end}) ===`);

  // Find frames in this range
  for (let i = 0; i < indexToFrame.length; i++) {
    const frameIdx = indexToFrame[i];
    if (frameIdx >= range.start - 5 && frameIdx <= range.end + 5) {
      const lm = landmarks[i].landmarks;
      const leftWrist = lm[LEFT_WRIST];
      const rightWrist = lm[RIGHT_WRIST];
      const leftShoulder = lm[LEFT_SHOULDER];
      const rightShoulder = lm[RIGHT_SHOULDER];

      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const wristAboveShoulder = avgShoulderY - avgWristY;  // Positive = wrist above

      // Check velocity from previous frame
      if (i > 0 && indexToFrame[i-1] === frameIdx - 1) {
        const prevLm = landmarks[i-1].landmarks;
        const prevAvgWristY = (prevLm[LEFT_WRIST].y + prevLm[RIGHT_WRIST].y) / 2;
        const velocity = avgWristY - prevAvgWristY;  // Negative = upward
        console.log(`  Frame ${frameIdx}: wristY=${avgWristY.toFixed(3)}, shoulderY=${avgShoulderY.toFixed(3)}, wristAbove=${wristAboveShoulder.toFixed(3)}, velocity=${velocity.toFixed(4)}`);
      }
    }
  }
}

// Also check the TRUE shots for comparison
console.log("\n=== TRUE SHOT 1 (frames 68-106) ===");
for (let i = 0; i < indexToFrame.length; i++) {
  const frameIdx = indexToFrame[i];
  if (frameIdx >= 80 && frameIdx <= 105) {
    const lm = landmarks[i].landmarks;
    const leftWrist = lm[LEFT_WRIST];
    const rightWrist = lm[RIGHT_WRIST];
    const leftShoulder = lm[LEFT_SHOULDER];
    const rightShoulder = lm[RIGHT_SHOULDER];

    const avgWristY = (leftWrist.y + rightWrist.y) / 2;
    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const wristAboveShoulder = avgShoulderY - avgWristY;

    if (i > 0 && indexToFrame[i-1] === frameIdx - 1) {
      const prevLm = landmarks[i-1].landmarks;
      const prevAvgWristY = (prevLm[LEFT_WRIST].y + prevLm[RIGHT_WRIST].y) / 2;
      const velocity = avgWristY - prevAvgWristY;
      console.log(`  Frame ${frameIdx}: wristY=${avgWristY.toFixed(3)}, shoulderY=${avgShoulderY.toFixed(3)}, wristAbove=${wristAboveShoulder.toFixed(3)}, velocity=${velocity.toFixed(4)}`);
    }
  }
}
