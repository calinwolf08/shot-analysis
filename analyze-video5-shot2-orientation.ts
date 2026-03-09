import fs from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Detected frame range for shot 2: 287-307
console.log('=== Video 5 Shot 2 (detected frames 287-307, expected: side-left) ===');

let totalShoulderDiffX = 0;
let totalHipDiffX = 0;
let totalShoulderZ = 0;
let totalHipZ = 0;
let validSamples = 0;

for (let i = 287; i <= 307; i++) {
  const frame = data.frames[i];
  if (!frame || !frame.landmarks) continue;

  const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];

  if (!ls || !rs || !lh || !rh) continue;

  const minVisibility = 0.3;
  if (ls.visibility < minVisibility || rs.visibility < minVisibility ||
      lh.visibility < minVisibility || rh.visibility < minVisibility) continue;

  totalShoulderDiffX += rs.x - ls.x;
  totalHipDiffX += rh.x - lh.x;
  totalShoulderZ += rs.z - ls.z;
  totalHipZ += rh.z - lh.z;
  validSamples++;
}

const avgShoulderDiffX = totalShoulderDiffX / validSamples;
const avgHipDiffX = totalHipDiffX / validSamples;
const avgZDiff = totalShoulderZ / validSamples;
const avgHipZDiff = totalHipZ / validSamples;

const shoulderSeparation = Math.abs(avgShoulderDiffX);
const hipSeparation = Math.abs(avgHipDiffX);
const absZDiff = Math.abs(avgZDiff);
const absHipZDiff = Math.abs(avgHipZDiff);

console.log(`avgShoulderDiffX = ${avgShoulderDiffX.toFixed(4)}`);
console.log(`avgHipDiffX = ${avgHipDiffX.toFixed(4)}`);
console.log(`avgZDiff = ${avgZDiff.toFixed(4)}`);
console.log(`avgHipZDiff = ${avgHipZDiff.toFixed(4)}`);
console.log(`shoulderSep = ${shoulderSeparation.toFixed(4)}`);
console.log(`hipSep = ${hipSeparation.toFixed(4)}`);
console.log(`absZDiff = ${absZDiff.toFixed(4)}`);
console.log(`absHipZDiff = ${absHipZDiff.toFixed(4)}`);

// Check conditions
const sideViewZThreshold = 0.45;
const sideThreshold = 0.05;
console.log('\nConditions:');
const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
const moderateShoulderSep = shoulderSeparation > sideThreshold && shoulderSeparation < 0.12;
const hipFollowsShoulder = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.15;
const higherShoulderSep = shoulderSeparation > 0.07;
const isHigherSepSideLeft = avgZDiff > 0 && absHipZDiff < 0.24;

console.log(`moderateZForSide = ${moderateZForSide} (absZDiff=${absZDiff.toFixed(3)})`);
console.log(`moderateShoulderSep = ${moderateShoulderSep} (shoulderSep=${shoulderSeparation.toFixed(3)})`);
console.log(`hipFollowsShoulder = ${hipFollowsShoulder}`);
console.log(`higherShoulderSep = ${higherShoulderSep}`);
console.log(`isHigherSepSideLeft = ${isHigherSepSideLeft} (avgZDiff > 0 && absHipZDiff < 0.24)`);
console.log(`  avgZDiff > 0: ${avgZDiff > 0}`);
console.log(`  absHipZDiff < 0.24: ${absHipZDiff < 0.24}`);
