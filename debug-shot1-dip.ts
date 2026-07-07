import * as fs from 'fs';

// Load pose data for video 6
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

console.log("Shot 1 Analysis (labeled 68-106, detected 85-103):");
console.log("===================================================\n");

let prevWristY: number | null = null;

console.log("Frame | WristY | Velocity | Direction | Notes");
console.log("------|--------|----------|-----------|------");

for (let frameIdx = 60; frameIdx <= 100; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const lm = frame.landmarks;
  const rightWristY = lm[RIGHT_WRIST].y;
  const avgWristY = (lm[LEFT_WRIST].y + lm[RIGHT_WRIST].y) / 2;

  const velocity = prevWristY !== null ? rightWristY - prevWristY : 0;
  const direction = velocity > 0.001 ? "DOWN" : velocity < -0.001 ? "UP" : "FLAT";

  let notes = "";
  if (frameIdx === 68) notes = "LABELED START";
  if (frameIdx === 85) notes = "DETECTED START";

  console.log(`${frameIdx.toString().padStart(5)} | ${rightWristY.toFixed(3)} | ${velocity >= 0 ? "+" : ""}${velocity.toFixed(4)} | ${direction.padEnd(4)} | ${notes}`);

  prevWristY = rightWristY;
}

console.log("\n\nShot 3 Analysis (labeled 838-862, detected 828-857):");
console.log("=====================================================\n");

prevWristY = null;

console.log("Frame | WristY | Velocity | Direction | Notes");
console.log("------|--------|----------|-----------|------");

for (let frameIdx = 820; frameIdx <= 850; frameIdx++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
  if (!frame || !frame.landmarks) continue;

  const lm = frame.landmarks;
  const rightWristY = lm[RIGHT_WRIST].y;

  const velocity = prevWristY !== null ? rightWristY - prevWristY : 0;
  const direction = velocity > 0.001 ? "DOWN" : velocity < -0.001 ? "UP" : "FLAT";

  let notes = "";
  if (frameIdx === 828) notes = "DETECTED START";
  if (frameIdx === 838) notes = "LABELED START";

  console.log(`${frameIdx.toString().padStart(5)} | ${rightWristY.toFixed(3)} | ${velocity >= 0 ? "+" : ""}${velocity.toFixed(4)} | ${direction.padEnd(4)} | ${notes}`);

  prevWristY = rightWristY;
}
