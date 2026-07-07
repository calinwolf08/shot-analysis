import * as fs from 'fs';

// Simulate the findDipStart logic for video 6 shot 1
const poseData = JSON.parse(fs.readFileSync('test-data/20190804_140617/poses.json', 'utf8'));
const frames = poseData.frames;

const LANDMARK = { LEFT_WRIST: 15, RIGHT_WRIST: 16, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 };

function getFrameData(frameIndex: number) {
  const frameObj = frames.find((f: any) => f.frameIndex === frameIndex);
  if (!frameObj) return null;

  const rw = frameObj.landmarks[LANDMARK.RIGHT_WRIST];
  const lw = frameObj.landmarks[LANDMARK.LEFT_WRIST];
  const ls = frameObj.landmarks[LANDMARK.LEFT_SHOULDER];
  const rs = frameObj.landmarks[LANDMARK.RIGHT_SHOULDER];

  return {
    rightWristY: rw.y,
    avgWristY: (lw.y + rw.y) / 2,
    avgShoulderY: (ls.y + rs.y) / 2
  };
}

// Simulate findDipStart with upwardStartFrame = 85 (what the algorithm detects)
const upwardStartFrame = 85;
const maxDipLookback = 15;

console.log(`Simulating findDipStart for video 6 shot 1`);
console.log(`upwardStartFrame = ${upwardStartFrame}`);
console.log();

// Find dip point (highest Y = lowest wrist position) before upward start
let dipFrame = upwardStartFrame;
let dipY = getFrameData(upwardStartFrame)!.rightWristY;

console.log('Looking for dip point (highest Y):');
for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - maxDipLookback); i--) {
  const frame = getFrameData(i);
  if (!frame) break;

  const rawY = frame.rightWristY;
  const decision = rawY >= dipY ? `NEW DIP (${rawY.toFixed(3)} >= ${dipY.toFixed(3)})` :
                   rawY < dipY - 0.02 ? `STOP (${rawY.toFixed(3)} < ${dipY.toFixed(3)} - 0.02)` :
                   `continue (${rawY.toFixed(3)})`;
  console.log(`  Frame ${i}: rightWristY=${rawY.toFixed(3)} - ${decision}`);

  if (rawY >= dipY) {
    dipY = rawY;
    dipFrame = i;
  } else if (rawY < dipY - 0.02) {
    break;
  }
}

console.log(`\nDip point found: frame=${dipFrame}, dipY=${dipY.toFixed(3)}`);

// Now find where the downward motion started
const dipStartLookback = 12;
let dipStartFrame = dipFrame;
let consecutivePlateau = 0;
const maxPlateauFrames = 4;

console.log('\nLooking for dip start (where downward motion began):');
for (let i = dipFrame - 1; i >= Math.max(0, dipFrame - dipStartLookback); i--) {
  const frame = getFrameData(i);
  if (!frame) break;

  const rawY = frame.rightWristY;
  const progressFromDip = dipY - rawY;

  console.log(`  Frame ${i}: rightWristY=${rawY.toFixed(3)}, progressFromDip=${progressFromDip.toFixed(3)}`);

  if (progressFromDip >= 0.005) {
    dipStartFrame = i;
    consecutivePlateau = 0;
  } else if (progressFromDip >= 0) {
    consecutivePlateau++;
    if (consecutivePlateau > maxPlateauFrames) {
      console.log(`  -> Stopping: plateau exceeded ${maxPlateauFrames} frames`);
      break;
    }
  } else {
    console.log(`  -> Stopping: progressFromDip < 0`);
    break;
  }
}

console.log(`\nDip start found: frame=${dipStartFrame}`);

// Calculate metrics
const dipStartY = getFrameData(dipStartFrame)!.rightWristY;
const dipMagnitude = dipY - dipStartY;
console.log(`\nDip metrics:`);
console.log(`  dipStartY = ${dipStartY.toFixed(3)}`);
console.log(`  dipY = ${dipY.toFixed(3)}`);
console.log(`  dipMagnitude = ${dipMagnitude.toFixed(3)}`);
console.log(`  distanceToDip = ${upwardStartFrame - dipFrame}`);

// Count continuous down frames
let continuousDownFrames = 0;
let maxContinuousDownFrames = 0;
let prevY: number | null = null;

for (let i = dipStartFrame; i <= dipFrame; i++) {
  const frame = getFrameData(i);
  if (!frame) continue;

  const rawY = frame.rightWristY;
  if (prevY !== null) {
    const velocity = rawY - prevY;
    if (velocity > 0.001) {
      continuousDownFrames++;
      maxContinuousDownFrames = Math.max(maxContinuousDownFrames, continuousDownFrames);
    } else {
      continuousDownFrames = 0;
    }
  }
  prevY = rawY;
}

console.log(`  maxContinuousDownFrames = ${maxContinuousDownFrames}`);

const isLargeContinuousDip = dipMagnitude >= 0.05 && maxContinuousDownFrames >= 5;
const minDistanceToDip = 3;
const distanceToDip = upwardStartFrame - dipFrame;
const isDipFarEnough = distanceToDip >= minDistanceToDip;

console.log(`\nDecision:`);
console.log(`  isLargeContinuousDip = ${isLargeContinuousDip}`);
console.log(`  isDipFarEnough = ${isDipFarEnough} (distanceToDip=${distanceToDip} >= ${minDistanceToDip}?)`);
console.log(`  Result: ${(!isLargeContinuousDip || !isDipFarEnough) ? 'RETURN upwardStartFrame' : 'RETURN dipStartFrame'}`);

// What SHOULD happen for the labeled start at frame 68
console.log(`\n--- Expected vs Actual ---`);
console.log(`Expected shot start: frame 68`);
console.log(`Algorithm would return: frame ${(!isLargeContinuousDip || !isDipFarEnough) ? upwardStartFrame : dipStartFrame}`);
