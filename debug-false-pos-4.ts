import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// LANDMARK indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

console.log("FALSE POS 4 Analysis (frames 663-695):");
console.log("======================================\n");

console.log("Frame-by-frame analysis:");
let prevWristY: number | null = null;

for (let frameIdx = 658; frameIdx <= 700; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const lm = frame.landmarks;
  const leftWrist = lm[LEFT_WRIST];
  const rightWrist = lm[RIGHT_WRIST];
  const leftShoulder = lm[LEFT_SHOULDER];
  const rightShoulder = lm[RIGHT_SHOULDER];

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const wristShoulderDelta = avgWristY - avgShoulderY;
  const velocity = prevWristY !== null ? avgWristY - prevWristY : 0;

  console.log(`  Frame ${frameIdx}: wristY=${avgWristY.toFixed(3)}, ` +
    `shoulderY=${avgShoulderY.toFixed(3)}, ` +
    `delta=${wristShoulderDelta.toFixed(3)}, ` +
    `velocity=${velocity.toFixed(4)}`);

  prevWristY = avgWristY;
}

// Compare with TRUE Shot 3
console.log("\n\nTRUE Shot 3 Analysis (frames 828-862):");
console.log("=======================================\n");

console.log("Frame-by-frame analysis:");
prevWristY = null;

for (let frameIdx = 825; frameIdx <= 865; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const lm = frame.landmarks;
  const leftWrist = lm[LEFT_WRIST];
  const rightWrist = lm[RIGHT_WRIST];
  const leftShoulder = lm[LEFT_SHOULDER];
  const rightShoulder = lm[RIGHT_SHOULDER];

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const wristShoulderDelta = avgWristY - avgShoulderY;
  const velocity = prevWristY !== null ? avgWristY - prevWristY : 0;

  console.log(`  Frame ${frameIdx}: wristY=${avgWristY.toFixed(3)}, ` +
    `shoulderY=${avgShoulderY.toFixed(3)}, ` +
    `delta=${wristShoulderDelta.toFixed(3)}, ` +
    `velocity=${velocity.toFixed(4)}`);

  prevWristY = avgWristY;
}
