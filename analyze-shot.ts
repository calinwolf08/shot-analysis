import { readFileSync } from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';

const videoName = process.argv[2] || '20190804_140654';
const startFrame = parseInt(process.argv[3] || '29');
const endFrame = parseInt(process.argv[4] || '42');

const poseData = JSON.parse(readFileSync('test-data/' + videoName + '/poses.json', 'utf-8'));

// Analyze specific frame range
const frames = poseData.frames.filter(f => f.frameIndex >= startFrame && f.frameIndex <= endFrame && f.landmarks);

let totalShoulderDiffX = 0, totalHipDiffX = 0, totalShoulderZ = 0, totalHipZ = 0;
let count = 0;

for (const frame of frames) {
  const lm = frame.landmarks;
  const ls = lm[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = lm[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lh = lm[LANDMARK_INDEX.LEFT_HIP];
  const rh = lm[LANDMARK_INDEX.RIGHT_HIP];

  if (ls && rs && lh && rh && ls.visibility > 0.3 && rs.visibility > 0.3) {
    totalShoulderDiffX += rs.x - ls.x;
    totalHipDiffX += rh.x - lh.x;
    totalShoulderZ += rs.z - ls.z;
    totalHipZ += rh.z - lh.z;
    count++;
  }
}

if (count > 0) {
  const avgShouldX = totalShoulderDiffX / count;
  const avgHipX = totalHipDiffX / count;
  const avgShoulderZ = totalShoulderZ / count;
  const avgHipZ = totalHipZ / count;
  const absZ = Math.abs(avgShoulderZ);
  const absHipZ = Math.abs(avgHipZ);
  const shoulderSep = Math.abs(avgShouldX);
  const hipSep = Math.abs(avgHipX);
  const avgSep = (shoulderSep + hipSep) / 2;
  const ratio = absHipZ > 0.1 ? absZ / absHipZ : 999;

  console.log('Analyzing frames ' + startFrame + '-' + endFrame + ':');
  console.log('  shoulderDiffX: ' + avgShouldX.toFixed(3) + ' (isFront: ' + (avgShouldX < 0) + ', isBack: ' + (avgShouldX > 0) + ')');
  console.log('  hipDiffX:      ' + avgHipX.toFixed(3) + ' (separation: ' + hipSep.toFixed(3) + ')');
  console.log('  shoulderSep:   ' + shoulderSep.toFixed(3));
  console.log('  avgSep:        ' + avgSep.toFixed(3));
  console.log('  shoulderZ:     ' + avgShoulderZ.toFixed(3) + ' (abs: ' + absZ.toFixed(3) + ')');
  console.log('  hipZ:          ' + avgHipZ.toFixed(3) + ' (abs: ' + absHipZ.toFixed(3) + ')');
  console.log('  shoulder/hip Z ratio: ' + ratio.toFixed(2));
  console.log('  hipZConsistent: ' + (absHipZ > 0.25 && Math.sign(avgHipZ) === Math.sign(avgShoulderZ)));
  console.log();

  // Check thresholds
  const frontBackThreshold = 0.15;
  const sideViewZThreshold = 0.45;
  const pureSideShoulderThreshold = 0.02;
  const frontAngleThreshold = 0.35;
  const behindAngleThreshold = 0.40;

  console.log('Threshold checks:');
  console.log('  avgSep > frontBackThreshold (0.15): ' + (avgSep > frontBackThreshold) + ' (' + avgSep.toFixed(3) + ')');
  console.log('  shoulderSep < pureSide (0.02): ' + (shoulderSep < pureSideShoulderThreshold) + ' (' + shoulderSep.toFixed(3) + ')');
  console.log('  absZ > sideViewZ (0.45): ' + (absZ > sideViewZThreshold) + ' (' + absZ.toFixed(3) + ')');
  console.log('  avgZDiff > frontAngle (0.35): ' + (avgShoulderZ > frontAngleThreshold) + ' (' + avgShoulderZ.toFixed(3) + ')');
  console.log('  avgZDiff < -frontAngle: ' + (avgShoulderZ < -frontAngleThreshold) + ' (' + avgShoulderZ.toFixed(3) + ')');

  // Predict result
  const isFrontView = avgShouldX < 0;
  const isBackView = avgShouldX > 0;
  let predicted = 'unknown';

  if (avgSep > frontBackThreshold) {
    predicted = 'CASE 1';
  } else if (shoulderSep < pureSideShoulderThreshold && absZ > sideViewZThreshold) {
    predicted = 'CASE 2';
  } else if (absZ > sideViewZThreshold) {
    predicted = 'CASE 3';
  } else {
    // CASE 4
    if (isFrontView) {
      if (avgShoulderZ > frontAngleThreshold) {
        predicted = 'front-left';
      } else if (avgShoulderZ < -frontAngleThreshold) {
        predicted = 'front-right';
      } else {
        predicted = 'front';
      }
    } else if (isBackView) {
      if (avgShoulderZ > behindAngleThreshold) {
        predicted = 'behind-left';
      } else if (avgShoulderZ < -behindAngleThreshold) {
        predicted = 'behind-right';
      } else {
        predicted = 'behind';
      }
    }
  }
  console.log('\nPredicted orientation: ' + predicted);
}
