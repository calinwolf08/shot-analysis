import { loadPoseData, loadLabelData } from './src/testing/loader';
import { runDetection, adaptPoseDataToDetector } from './src/testing/detection';
import { LANDMARK_INDEX } from './src/pose/types';
import { createShotBoundaryDetector } from './src/detection/shot-detector';

const poseResult = loadPoseData('test-data/20200606_111929/poses.json');
const labelResult = loadLabelData('test-data/20200606_111929/labels.json');

if (!poseResult.success || !labelResult.success) {
  console.log('Load error');
  process.exit(1);
}

const poseData = poseResult.data;
const detection = runDetection(poseData);
const labels = labelResult.data;

console.log('Detected shots:');
for (const shot of detection.shots) {
  console.log('  Start:', shot.startFrame, 'End:', shot.endFrame);
}

console.log('\nLabeled shots:');
for (const shot of labels.shots) {
  console.log('  Shot', shot.shotNumber, '- Start:', shot.startFrame, 'End:', shot.endFrame, 'Orientation:', shot.cameraOrientation);
}

// Analyze frames around shot 5 (frames 1287-1312) and velocity
console.log('\n=== Analysis of frames around shot 5 (1277-1340) with velocity ===');
const startAnalysis = 1277;
const endAnalysis = 1340;

let prevWristY: number | null = null;
for (let i = startAnalysis; i <= endAnalysis; i++) {
  const frame = poseData.frames.find(f => f.frameIndex === i);
  if (!frame || !frame.landmarks) {
    console.log(`Frame ${i}: NO LANDMARKS`);
    prevWristY = null;
    continue;
  }

  const lw = frame.landmarks[LANDMARK_INDEX.LEFT_WRIST];
  const rw = frame.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
  const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];

  const avgWristY = ((lw?.y ?? 0) + (rw?.y ?? 0)) / 2;
  const avgShoulderY = ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
  const wristAboveShoulder = avgWristY < avgShoulderY;

  // Calculate velocity (negative = upward)
  let velocity = 0;
  let velocityStr = '';
  if (prevWristY !== null) {
    velocity = avgWristY - prevWristY;
    const upward = velocity < -0.012;
    velocityStr = `vel=${velocity.toFixed(4)} ${upward ? 'UP' : ''}`;
  }

  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, shoulderY=${avgShoulderY.toFixed(3)}, ${velocityStr}`);
  prevWristY = avgWristY;
}

// Check total frame count
console.log('\n=== Total frames ===');
console.log('Total frames in poses.json:', poseData.frames.length);
console.log('Last frame index:', poseData.frames[poseData.frames.length - 1]?.frameIndex);
console.log('Frames with landmarks:', poseData.frames.filter(f => f.landmarks !== null).length);

// Check frame gaps around shot 5
console.log('\n=== Frame gaps in pose data ===');
const frames1280to1320 = poseData.frames.filter(f => f.frameIndex >= 1280 && f.frameIndex <= 1320);
console.log('Frames 1280-1320:', frames1280to1320.map(f => f.frameIndex).join(', '));

// Check if there are any large gaps
const framesWithLandmarks = poseData.frames.filter(f => f.landmarks !== null);
console.log('\n=== Gaps in landmark data ===');
for (let i = 1; i < framesWithLandmarks.length; i++) {
  const prev = framesWithLandmarks[i-1]!;
  const curr = framesWithLandmarks[i]!;
  const gap = curr.frameIndex - prev.frameIndex;
  if (gap > 1 && prev.frameIndex >= 1280 && curr.frameIndex <= 1340) {
    console.log(`Gap of ${gap} frames between ${prev.frameIndex} and ${curr.frameIndex}`);
  }
}

// Check Y range during shot 5
console.log('\n=== Y range during shot 5 ===');
const shot5Frames = poseData.frames.filter(f => f.frameIndex >= 1287 && f.frameIndex <= 1312 && f.landmarks !== null);
const wristYValues = shot5Frames.map(f => {
  const lw = f.landmarks![LANDMARK_INDEX.LEFT_WRIST];
  const rw = f.landmarks![LANDMARK_INDEX.RIGHT_WRIST];
  return ((lw?.y ?? 0) + (rw?.y ?? 0)) / 2;
});
const startY = wristYValues[0];
const minY = Math.min(...wristYValues);
const yRange = (startY ?? 0) - minY;
console.log(`Start Y: ${startY?.toFixed(3)}, Min Y: ${minY.toFixed(3)}, Y range: ${yRange.toFixed(3)}`);
console.log(`Required Y range for detection: 0.08`);

// Check wrist-shoulder delta for all frames in shot 5
console.log('\n=== Wrist-Shoulder delta for all frames in shot 5 ===');
for (const frame of shot5Frames) {
  if (!frame.landmarks) continue;
  const lw = frame.landmarks[LANDMARK_INDEX.LEFT_WRIST];
  const rw = frame.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
  const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const wristY = ((lw?.y ?? 0) + (rw?.y ?? 0)) / 2;
  const shoulderY = ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
  const delta = wristY - shoulderY;
  const passes = delta <= -0.049;
  console.log(`Frame ${frame.frameIndex}: wristY=${wristY.toFixed(3)}, shoulderY=${shoulderY.toFixed(3)}, delta=${delta.toFixed(3)}, passes=${passes}`);
}

// Check if shooting wrist goes above shoulder (using single wrist)
console.log('\n=== RIGHT wrist vs RIGHT shoulder (shooting arm) ===');
for (const frame of shot5Frames) {
  if (!frame.landmarks) continue;
  const rw = frame.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const wristY = rw?.y ?? 0;
  const shoulderY = rs?.y ?? 0;
  const delta = wristY - shoulderY;
  const passes = delta <= -0.049;
  console.log(`Frame ${frame.frameIndex}: rwristY=${wristY.toFixed(3)}, rshoulderY=${shoulderY.toFixed(3)}, delta=${delta.toFixed(3)}, passes=${passes}`);
}

// Analyze orientation for shots 4 and 5
console.log('\n=== Orientation analysis for shots 4 and 5 ===');

// Shot 4: frames 964-987
console.log('\nShot 4 (frames 964-987):');
const shot4Frames = poseData.frames.filter(f => f.frameIndex >= 964 && f.frameIndex <= 987 && f.landmarks !== null);
let shot4TotalShoulderDiffX = 0;
let shot4TotalHipDiffX = 0;
let shot4TotalShoulderZ = 0;
let shot4ValidSamples = 0;
for (const frame of shot4Frames) {
  if (!frame.landmarks) continue;
  const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) continue;
  const shoulderDiffX = rs.x - ls.x;
  const hipDiffX = rh.x - lh.x;
  const shoulderZ = rs.z - ls.z;
  shot4TotalShoulderDiffX += shoulderDiffX;
  shot4TotalHipDiffX += hipDiffX;
  shot4TotalShoulderZ += shoulderZ;
  shot4ValidSamples++;
}
const shot4AvgShoulderDiffX = shot4TotalShoulderDiffX / shot4ValidSamples;
const shot4AvgHipDiffX = shot4TotalHipDiffX / shot4ValidSamples;
const shot4AvgZDiff = shot4TotalShoulderZ / shot4ValidSamples;
console.log(`  Avg shoulder diff X: ${shot4AvgShoulderDiffX.toFixed(4)}`);
console.log(`  Avg hip diff X: ${shot4AvgHipDiffX.toFixed(4)}`);
console.log(`  Avg shoulder Z diff: ${shot4AvgZDiff.toFixed(4)}`);
console.log(`  isFrontView (shoulderDiffX < 0): ${shot4AvgShoulderDiffX < 0}`);
console.log(`  Avg separation: ${((Math.abs(shot4AvgShoulderDiffX) + Math.abs(shot4AvgHipDiffX)) / 2).toFixed(4)}`);

// Shot 5: frames 1287-1312
console.log('\nShot 5 (frames 1287-1312):');
let shot5TotalShoulderDiffX = 0;
let shot5TotalHipDiffX = 0;
let shot5TotalShoulderZ = 0;
let shot5ValidSamples = 0;
for (const frame of shot5Frames) {
  if (!frame.landmarks) continue;
  const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) continue;
  const shoulderDiffX = rs.x - ls.x;
  const hipDiffX = rh.x - lh.x;
  const shoulderZ = rs.z - ls.z;
  shot5TotalShoulderDiffX += shoulderDiffX;
  shot5TotalHipDiffX += hipDiffX;
  shot5TotalShoulderZ += shoulderZ;
  shot5ValidSamples++;
}
const shot5AvgShoulderDiffX = shot5TotalShoulderDiffX / shot5ValidSamples;
const shot5AvgHipDiffX = shot5TotalHipDiffX / shot5ValidSamples;
const shot5AvgZDiff = shot5TotalShoulderZ / shot5ValidSamples;
console.log(`  Avg shoulder diff X: ${shot5AvgShoulderDiffX.toFixed(4)}`);
console.log(`  Avg hip diff X: ${shot5AvgHipDiffX.toFixed(4)}`);
console.log(`  Avg shoulder Z diff: ${shot5AvgZDiff.toFixed(4)}`);
console.log(`  isFrontView (shoulderDiffX < 0): ${shot5AvgShoulderDiffX < 0}`);
console.log(`  Avg separation: ${((Math.abs(shot5AvgShoulderDiffX) + Math.abs(shot5AvgHipDiffX)) / 2).toFixed(4)}`);
console.log(`  frontThreshold = 0.15, requires avgSeparation > 0.15 for clear front view`);
console.log(`  frontAngleThreshold = 0.35, requires avgZDiff < -0.35 for front-right`);
console.log(`  Currently frontAngleThreshold is 0.35, avgZDiff = ${shot5AvgZDiff.toFixed(4)}`);
console.log(`  Result: ${Math.abs(shot5AvgZDiff) < 0.35 ? "front (no angle)" : (shot5AvgZDiff < -0.35 ? "front-right" : "front-left")}`);

// Check hip Z diff for shots 4 and 5
let shot4TotalHipZ = 0;
for (const frame of shot4Frames) {
  if (!frame.landmarks) continue;
  const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];
  if (!lh || !rh) continue;
  shot4TotalHipZ += rh.z - lh.z;
}
const shot4AvgHipZDiff = shot4TotalHipZ / shot4ValidSamples;
console.log(`\nShot 4 hip Z diff: ${shot4AvgHipZDiff.toFixed(4)}`);

let shot5TotalHipZ = 0;
for (const frame of shot5Frames) {
  if (!frame.landmarks) continue;
  const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];
  if (!lh || !rh) continue;
  shot5TotalHipZ += rh.z - lh.z;
}
const shot5AvgHipZDiff = shot5TotalHipZ / shot5ValidSamples;
console.log(`Shot 5 hip Z diff: ${shot5AvgHipZDiff.toFixed(4)}`);

// For comparison, check shot 1 (side-right) to understand the thresholds better
console.log('\n=== Shot 1 for comparison (side-right) ===');
const shot1Frames = poseData.frames.filter(f => f.frameIndex >= 102 && f.frameIndex <= 124 && f.landmarks !== null);
let shot1TotalShoulderDiffX = 0;
let shot1TotalHipDiffX = 0;
let shot1TotalShoulderZ = 0;
let shot1TotalHipZ = 0;
let shot1ValidSamples = 0;
for (const frame of shot1Frames) {
  if (!frame.landmarks) continue;
  const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) continue;
  shot1TotalShoulderDiffX += rs.x - ls.x;
  shot1TotalHipDiffX += rh.x - lh.x;
  shot1TotalShoulderZ += rs.z - ls.z;
  shot1TotalHipZ += rh.z - lh.z;
  shot1ValidSamples++;
}
console.log(`  Avg shoulder diff X: ${(shot1TotalShoulderDiffX / shot1ValidSamples).toFixed(4)}`);
console.log(`  Avg hip diff X: ${(shot1TotalHipDiffX / shot1ValidSamples).toFixed(4)}`);
console.log(`  Avg separation: ${((Math.abs(shot1TotalShoulderDiffX / shot1ValidSamples) + Math.abs(shot1TotalHipDiffX / shot1ValidSamples)) / 2).toFixed(4)}`);
console.log(`  Avg shoulder Z diff: ${(shot1TotalShoulderZ / shot1ValidSamples).toFixed(4)}`);
console.log(`  Avg hip Z diff: ${(shot1TotalHipZ / shot1ValidSamples).toFixed(4)}`);
