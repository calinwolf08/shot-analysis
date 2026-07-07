import * as fs from 'fs';

const RIGHT_WRIST = 16;
const VELOCITY_THRESHOLD = 0.012;

// Debug findMotionStart behavior
const poseData = JSON.parse(fs.readFileSync('./test-data/20201212_134104/poses.json', 'utf-8'));

console.log("20201212 frame-by-frame analysis:");
console.log("==================================\n");

let prevY: number | null = null;

for (let frameIdx = 70; frameIdx <= 100; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const wristY = frame.landmarks[RIGHT_WRIST].y;
  const velocity = prevY !== null ? wristY - prevY : 0;
  const isUpward = velocity < -VELOCITY_THRESHOLD;

  console.log(`Frame ${frameIdx}: wristY=${wristY.toFixed(3)}, velocity=${velocity >= 0 ? "+" : ""}${velocity.toFixed(4)}, isUpward=${isUpward}`);

  prevY = wristY;
}

console.log(`\nLabeled start: 75`);
console.log(`The gather phase is frames 75-83`);
