import fs from 'fs';
import { detectSetPoint, calculateElbowAngle } from './src/keyframe-detector';
import type { Frame } from './src/testing/types';

const poseData = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));

// Shot 4 parameters from detected values
const ballStartsUpwardFrame = 836;
const endFrame = 866;

// Convert pose frames to the expected Frame type
const frames: Frame[] = poseData.frames.map((f: any) => ({
  frameIndex: f.frameIndex,
  timestamp: f.timestamp,
  poseConfidence: f.poseConfidence,
  landmarks: f.landmarks
}));

console.log('=== Debug detectSetPoint for Shot 4 ===');
console.log(`ballStartsUpwardFrame: ${ballStartsUpwardFrame}`);
console.log(`endFrame: ${endFrame}`);

// Manual debug of Strategy 2
const shotDuration = endFrame - ballStartsUpwardFrame + 1;
const searchEndFrame = ballStartsUpwardFrame + Math.floor(shotDuration * 0.7);
console.log(`searchEndFrame: ${searchEndFrame}`);

// Collect frame data
const frameData: Array<{frameIndex: number, wristY: number, elbowAngle: number | null}> = [];

for (const frame of frames) {
  if (frame.frameIndex < ballStartsUpwardFrame || frame.frameIndex > searchEndFrame) continue;
  if (!frame.landmarks) continue;

  const leftWrist = frame.landmarks[15];
  const rightWrist = frame.landmarks[16];

  const leftVisible = leftWrist && leftWrist.visibility >= 0.3;
  const rightVisible = rightWrist && rightWrist.visibility >= 0.3;

  let wristY: number | null = null;
  if (leftVisible && rightVisible) {
    wristY = (leftWrist!.y + rightWrist!.y) / 2;
  } else if (leftVisible) {
    wristY = leftWrist!.y;
  } else if (rightVisible) {
    wristY = rightWrist!.y;
  }

  if (wristY === null) continue;

  // Calculate elbow angle (simplified)
  let elbowAngle: number | null = null;
  const rightShoulder = frame.landmarks[12];
  const rightElbow = frame.landmarks[14];
  const leftShoulder = frame.landmarks[11];
  const leftElbow = frame.landmarks[13];

  // Try right arm
  if (rightShoulder && rightElbow && rightWrist &&
      rightShoulder.visibility >= 0.3 && rightElbow.visibility >= 0.3 && rightWrist.visibility >= 0.3) {
    elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
  } else if (leftShoulder && leftElbow && leftWrist &&
             leftShoulder.visibility >= 0.3 && leftElbow.visibility >= 0.3 && leftWrist.visibility >= 0.3) {
    elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  }

  frameData.push({frameIndex: frame.frameIndex, wristY, elbowAngle});
}

frameData.sort((a, b) => a.frameIndex - b.frameIndex);

console.log('\nframeData:');
const startingWristY = frameData[0]?.wristY ?? 1.0;
console.log(`startingWristY: ${startingWristY}`);

// Calculate velocities
const velocities: number[] = [];
for (let i = 1; i < frameData.length; i++) {
  velocities.push(frameData[i].wristY - frameData[i-1].wristY);
}

for (let i = 0; i < frameData.length; i++) {
  const d = frameData[i];
  const ballHasRisen = (startingWristY - d.wristY) > 0.05;
  const elbowCocked = d.elbowAngle !== null && d.elbowAngle < 100;
  const vel = i > 0 ? velocities[i-1].toFixed(4) : 'N/A';
  console.log(`  Frame ${d.frameIndex}: wristY=${d.wristY.toFixed(4)}, elbow=${d.elbowAngle?.toFixed(1) ?? 'N/A'}, vel=${vel}, ballRisen=${ballHasRisen}, elbowCocked=${elbowCocked}`);
}

// Trace Strategy 1
console.log('\nStrategy 1 trace:');
let consecutiveDecreasing = 0;
const plateauVelocityThreshold = 0.002;

for (let i = 0; i < velocities.length; i++) {
  const velocity = velocities[i];

  if (velocity < -0.005) {
    consecutiveDecreasing++;
    console.log(`  i=${i}: vel=${velocity.toFixed(4)} -> consecutive=${consecutiveDecreasing}`);
  } else if (consecutiveDecreasing >= 2 && velocity > -plateauVelocityThreshold) {
    const frameIndex = i + 1;
    const data = frameData[frameIndex];
    const elbowCocked = data?.elbowAngle !== null && data?.elbowAngle! < 100;
    console.log(`  i=${i}: PLATEAU! vel=${velocity.toFixed(4)}, frame=${data?.frameIndex}, elbow=${data?.elbowAngle?.toFixed(1)}, elbowCocked=${elbowCocked}`);
    if (elbowCocked) {
      console.log(`  -> RETURN ${data?.frameIndex}`);
      break;
    } else {
      console.log(`  -> RESET (elbow not cocked)`);
      consecutiveDecreasing = 0;
    }
  } else if (velocity > 0.002) {
    console.log(`  i=${i}: vel=${velocity.toFixed(4)} -> RESET`);
    consecutiveDecreasing = 0;
  } else {
    console.log(`  i=${i}: vel=${velocity.toFixed(4)} -> no change (in deadband)`);
  }
}

function calculateAngle(a: any, b: any, c: any): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  const cosAngle = dot / (magBA * magBC);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

const result = detectSetPoint(frames, ballStartsUpwardFrame, endFrame);
console.log(`\nDetected set_point: ${result}`);
