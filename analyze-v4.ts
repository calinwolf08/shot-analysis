import { readFileSync } from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';

const videoName = process.argv[2] || '20190804_140654';
const poseData = JSON.parse(readFileSync('test-data/' + videoName + '/poses.json', 'utf-8'));
const labels = JSON.parse(readFileSync('test-data/' + videoName + '/labels.json', 'utf-8'));

// Analyze each shot's pose data
for (const shot of labels.shots) {
  const frames = poseData.frames.filter(f => f.frameIndex >= shot.startFrame && f.frameIndex <= shot.endFrame && f.landmarks);

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
    const ratio = absHipZ > 0.1 ? absZ / absHipZ : 999;

    console.log('Shot ' + shot.shotNumber + ' (' + shot.cameraOrientation + '):');
    console.log('  shoulderDiffX: ' + avgShouldX.toFixed(3) + ' (isFront: ' + (avgShouldX < 0) + ', isBack: ' + (avgShouldX > 0) + ')');
    console.log('  hipDiffX:      ' + avgHipX.toFixed(3) + ' (separation: ' + hipSep.toFixed(3) + ')');
    console.log('  shoulderSep:   ' + shoulderSep.toFixed(3));
    console.log('  shoulderZ:     ' + avgShoulderZ.toFixed(3) + ' (abs: ' + absZ.toFixed(3) + ')');
    console.log('  hipZ:          ' + avgHipZ.toFixed(3) + ' (abs: ' + absHipZ.toFixed(3) + ')');
    console.log('  shoulder/hip Z ratio: ' + ratio.toFixed(2));
    console.log('  hipZConsistent: ' + (absHipZ > 0.25 && Math.sign(avgHipZ) === Math.sign(avgShoulderZ)));
    console.log();
  }
}
