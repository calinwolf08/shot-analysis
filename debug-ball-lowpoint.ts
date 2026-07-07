import * as fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));

console.log('=== Analyzing ball_low_point detection for shot 3 (behind) ===\n');

// Shot 3: detected start=561, end=588
const startFrame = 561;
const endFrame = 588;
const shotDuration = endFrame - startFrame + 1;
const searchWindow = 0.6; // ballLowPointSearchWindow
const searchEndFrame = startFrame + Math.floor(shotDuration * searchWindow);

console.log(`Shot 3 boundaries: start=${startFrame}, end=${endFrame}, searchEndFrame=${searchEndFrame}`);
console.log(`Search window: first 60% = frames ${startFrame}-${searchEndFrame}\n`);

const visThreshold = 0.3;

function getFrameWristY(frame: any, threshold: number): number | null {
  if (!frame.landmarks) return null;
  const leftWrist = frame.landmarks[15];
  const rightWrist = frame.landmarks[16];
  const leftVisible = leftWrist && leftWrist.visibility >= threshold;
  const rightVisible = rightWrist && rightWrist.visibility >= threshold;

  if (leftVisible && rightVisible) {
    return (leftWrist.y + rightWrist.y) / 2;
  } else if (leftVisible) {
    return leftWrist.y;
  } else if (rightVisible) {
    return rightWrist.y;
  }
  return null;
}

// Check which frames pass visibility threshold
console.log(`Checking frames ${startFrame}-${searchEndFrame} with visibility threshold ${visThreshold}:\n`);

let maxWristY = -Infinity;
let maxWristYFrame: number | null = null;

for (const frame of poseData.frames) {
  const frameIdx = frame.frameIndex;
  if (frameIdx < startFrame || frameIdx > searchEndFrame) continue;

  const wristY = getFrameWristY(frame, visThreshold);
  const leftWrist = frame.landmarks?.[15];
  const rightWrist = frame.landmarks?.[16];
  const avgVis = leftWrist && rightWrist ? (leftWrist.visibility + rightWrist.visibility) / 2 : 0;
  const rawWristY = leftWrist && rightWrist ? (leftWrist.y + rightWrist.y) / 2 : 'N/A';

  if (wristY !== null) {
    console.log(`  Frame ${frameIdx}: wristY=${wristY.toFixed(3)} (PASSES VIS)`);
    if (wristY > maxWristY) {
      maxWristY = wristY;
      maxWristYFrame = frameIdx;
    }
  } else {
    console.log(`  Frame ${frameIdx}: rawWristY=${typeof rawWristY === 'number' ? rawWristY.toFixed(3) : rawWristY}, avgVis=${avgVis.toFixed(2)} (BELOW VIS)`);
  }
}

console.log(`\nResult: maxWristYFrame = ${maxWristYFrame}, maxWristY = ${maxWristY.toFixed(3)}`);
console.log(`Expected: ball_low_point = 561`);
