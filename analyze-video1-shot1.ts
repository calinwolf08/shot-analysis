import fs from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';
const data = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));

console.log('=== Video 1 Shot 1 (frames 32-55, expected: front-right) ===');

let totalShoulderDiffX = 0;
let totalHipDiffX = 0;
let totalShoulderZ = 0;
let totalHipZ = 0;
let validSamples = 0;

for (let i = 32; i <= 55; i++) {
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

// Check CASE 4 conditions
const sideViewZThreshold = 0.45;
const sideThreshold = 0.05;
const isFrontView = avgShoulderDiffX < 0;

console.log(`\nisFrontView = ${isFrontView}`);
console.log(`\nCASE 4 conditions:`);
const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
const moderateShoulderSep = shoulderSeparation > sideThreshold && shoulderSeparation < 0.12;
const hipFollowsShoulder = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.15;
const hipNotHighlyConsistent_025 = absHipZDiff < 0.25;
const hipNotHighlyConsistent_027 = absHipZDiff < 0.27;

console.log(`moderateZForSide = ${moderateZForSide} (absZDiff=${absZDiff.toFixed(3)}, range: 0.30-${sideViewZThreshold})`);
console.log(`moderateShoulderSep = ${moderateShoulderSep} (shoulderSep=${shoulderSeparation.toFixed(3)}, range: ${sideThreshold}-0.12)`);
console.log(`hipFollowsShoulder = ${hipFollowsShoulder} (absHipZDiff=${absHipZDiff.toFixed(3)}, signs match: ${Math.sign(avgHipZDiff) === Math.sign(avgZDiff)})`);
console.log(`hipNotHighlyConsistent (0.25) = ${hipNotHighlyConsistent_025}`);
console.log(`hipNotHighlyConsistent (0.27) = ${hipNotHighlyConsistent_027}`);

console.log(`\nWith threshold 0.25: ${moderateZForSide && moderateShoulderSep && hipFollowsShoulder && hipNotHighlyConsistent_025 ? 'side-right' : 'falls through'}`);
console.log(`With threshold 0.27: ${moderateZForSide && moderateShoulderSep && hipFollowsShoulder && hipNotHighlyConsistent_027 ? 'side-right' : 'falls through'}`);
