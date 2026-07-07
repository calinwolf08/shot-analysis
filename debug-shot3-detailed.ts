import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

const RIGHT_WRIST = 16;

// Calculate velocity for each frame (using right wrist Y)
console.log("Velocity analysis for Shot 3 region:");
console.log("=====================================\n");

let prevY: number | null = null;
const VELOCITY_THRESHOLD = 0.012;
let upwardCount = 0;
let potentialStart = -1;

console.log("Frame | WristY | Velocity | isUpward | upwardCount | Notes");
console.log("------|--------|----------|----------|-------------|------");

for (let frameIdx = 815; frameIdx <= 870; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const lm = frame.landmarks;
  const wristY = lm[RIGHT_WRIST].y;

  let velocity = prevY !== null ? wristY - prevY : 0;
  const isUpward = velocity < -VELOCITY_THRESHOLD;

  let notes = "";
  if (isUpward) {
    upwardCount++;
    if (upwardCount === 3 && potentialStart === -1) {
      potentialStart = frameIdx - 2; // Approximate where upward motion started
      notes = `Potential start at ${potentialStart}`;
    }
  } else {
    if (upwardCount >= 3) {
      notes = `Gap after ${upwardCount} upward frames`;
    }
    upwardCount = 0;
  }

  console.log(`${frameIdx.toString().padStart(5)} | ${wristY.toFixed(3)} | ${velocity >= 0 ? "+" : ""}${velocity.toFixed(4)} | ${isUpward ? "YES" : "no "} | ${upwardCount.toString().padStart(11)} | ${notes}`);

  prevY = wristY;
}

console.log(`\nExpected start: 838`);
console.log(`Detected start: 828`);
