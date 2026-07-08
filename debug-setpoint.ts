import fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20190804_140654/poses.json', 'utf-8'));
const labels = JSON.parse(fs.readFileSync('test-data/20190804_140654/labels.json', 'utf-8'));

// Simulate the detectSetPoint algorithm for Shot 7
const shot = labels.shots.find((s: any) => s.shotNumber === 7);
// Use labeled values instead of detected
const ballStartsUpwardFrame = shot.ball_starts_upward; // From label: 754
const endFrame = shot.endFrame; // From label: 782

console.log('=== Debug detectSetPoint for Shot 7 ===');
console.log(`ball_starts_upward: ${ballStartsUpwardFrame}`);
console.log(`endFrame: ${endFrame}`);

const shotDuration = endFrame - ballStartsUpwardFrame + 1;
const searchEndFrame = ballStartsUpwardFrame + Math.floor(shotDuration * 0.7);
console.log(`searchEndFrame: ${searchEndFrame}`);

// Collect wrist Y data
const frameData: Array<{frameIndex: number, wristY: number}> = [];
console.log('\nChecking frame visibility:');
for (const frame of poseData.frames) {
  if (frame.frameIndex < ballStartsUpwardFrame || frame.frameIndex > searchEndFrame) continue;
  if (!frame.landmarks) {
    console.log(`  Frame ${frame.frameIndex}: NO LANDMARKS`);
    continue;
  }

  const leftWrist = frame.landmarks[15];
  const rightWrist = frame.landmarks[16];
  const leftVis = leftWrist?.visibility || 0;
  const rightVis = rightWrist?.visibility || 0;

  // Use single wrist if available (like getFrameWristY does)
  const leftVisible = leftVis >= 0.3;
  const rightVisible = rightVis >= 0.3;

  if (!leftVisible && !rightVisible) {
    console.log(`  Frame ${frame.frameIndex}: BOTH LOW VIS (left=${leftVis.toFixed(2)}, right=${rightVis.toFixed(2)})`);
    continue;
  }

  let wristY: number;
  if (leftVisible && rightVisible) {
    wristY = (leftWrist.y + rightWrist.y) / 2;
  } else if (leftVisible) {
    wristY = leftWrist.y;
  } else {
    wristY = rightWrist.y;
  }

  frameData.push({frameIndex: frame.frameIndex, wristY});
}


frameData.sort((a, b) => a.frameIndex - b.frameIndex);

console.log('\nFrame data:');
for (const d of frameData) {
  console.log(`  Frame ${d.frameIndex}: wristY = ${d.wristY.toFixed(4)}`);
}

// Calculate velocities
console.log('\nVelocities:');
const velocities: number[] = [];
for (let i = 1; i < frameData.length; i++) {
  const vel = frameData[i].wristY - frameData[i-1].wristY;
  velocities.push(vel);
  console.log(`  v[${i}] = ${vel.toFixed(4)} (frame ${frameData[i].frameIndex})`);
}

// Strategy 1: Look for first local minimum
console.log('\nLooking for first local minimum:');
let consecutiveDecreasing = 0;
const plateauVelocityThreshold = 0.001;

for (let i = 0; i < velocities.length; i++) {
  const velocity = velocities[i];

  if (velocity < -0.005) {
    consecutiveDecreasing++;
    console.log(`  i=${i}: vel=${velocity.toFixed(4)} -> consecutiveDecreasing=${consecutiveDecreasing}`);
  } else if (consecutiveDecreasing >= 2 && velocity > -plateauVelocityThreshold) {
    const frameIndex = i + 1;
    console.log(`  i=${i}: FOUND PLATEAU! vel=${velocity.toFixed(4)}, frameData[${frameIndex}].frameIndex=${frameData[frameIndex]?.frameIndex}`);
    break;
  } else if (velocity > 0.002) {
    console.log(`  i=${i}: vel=${velocity.toFixed(4)} -> RESET (vel > 0.002)`);
    consecutiveDecreasing = 0;
  } else {
    console.log(`  i=${i}: vel=${velocity.toFixed(4)} -> no change (vel between -0.005 and 0.002)`);
  }
}
