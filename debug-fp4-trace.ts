import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// LANDMARK indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

const VELOCITY_THRESHOLD = -0.012; // From config

// Trace the detection for FALSE POS 4 region (frames 650-700)
console.log("FALSE POS 4 Detection Trace:");
console.log("============================\n");

let prevWristY: number | null = null;
let smoothedWristY: number | null = null;
const alpha = 0.7;

console.log("Frame | WristY | SmoothedY | Velocity | IsUpward | ShoulderY | Delta");
console.log("------|--------|-----------|----------|----------|-----------|-------");

for (let frameIdx = 650; frameIdx <= 710; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const lm = frame.landmarks;
  const leftWrist = lm[LEFT_WRIST];
  const rightWrist = lm[RIGHT_WRIST];
  const leftShoulder = lm[LEFT_SHOULDER];
  const rightShoulder = lm[RIGHT_SHOULDER];

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const delta = avgWristY - avgShoulderY;

  // Apply smoothing (moving average approximation)
  if (smoothedWristY === null) {
    smoothedWristY = avgWristY;
  } else {
    smoothedWristY = (smoothedWristY + avgWristY + avgWristY) / 3; // 3-frame moving avg
  }

  const velocity = prevWristY !== null ? smoothedWristY - prevWristY : 0;
  const isUpward = velocity < VELOCITY_THRESHOLD;

  console.log(
    `${frameIdx.toString().padStart(5)} | ${avgWristY.toFixed(3)} | ${smoothedWristY.toFixed(3)} | ${velocity >= 0 ? '+' : ''}${velocity.toFixed(4)} | ${isUpward ? 'YES' : 'no '} | ${avgShoulderY.toFixed(3)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`
  );

  prevWristY = smoothedWristY;
}
