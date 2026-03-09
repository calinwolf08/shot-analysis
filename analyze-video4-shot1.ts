import fs from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';
const data = JSON.parse(fs.readFileSync('test-data/20190804_140654/poses.json', 'utf-8'));

console.log('=== Video 4 Shot 1 (frames 29-42, expected: side-left) ===');

let totalShoulderDiffX = 0;
let totalHipDiffX = 0;
let totalShoulderZ = 0;
let totalHipZ = 0;
let validSamples = 0;

for (let i = 29; i <= 42; i++) {
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
