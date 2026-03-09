import * as fs from 'fs';

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface Frame {
  frameIndex: number;
  landmarks: Landmark[];
}

interface PoseData {
  frames: Frame[];
}

function analyzeVideo(videoDir: string, startFrame: number, endFrame: number, label: string) {
  const poses: PoseData = JSON.parse(fs.readFileSync('test-data/' + videoDir + '/poses.json', 'utf-8'));

  const shotFrames = poses.frames.filter(f => f.frameIndex >= startFrame && f.frameIndex <= endFrame);

  console.log('Analysis for ' + videoDir + ' (frames ' + startFrame + '-' + endFrame + ') - ' + label + ':');
  console.log('');

  let totalShoulderDiffX = 0;
  let totalHipDiffX = 0;
  let totalZDiff = 0;
  let count = 0;

  for (const frame of shotFrames) {
    const ls = frame.landmarks[11]; // Left shoulder
    const rs = frame.landmarks[12]; // Right shoulder
    const lh = frame.landmarks[23]; // Left hip
    const rh = frame.landmarks[24]; // Right hip

    const shoulderDiffX = rs.x - ls.x;
    const hipDiffX = rh.x - lh.x;
    const zDiff = rs.z - ls.z;

    totalShoulderDiffX += shoulderDiffX;
    totalHipDiffX += hipDiffX;
    totalZDiff += zDiff;
    count++;
  }

  const avgShoulderDiffX = totalShoulderDiffX / count;
  const avgHipDiffX = totalHipDiffX / count;
  const avgZDiff = totalZDiff / count;
  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const avgSeparation = (shoulderSeparation + hipSeparation) / 2;

  console.log('  Avg Shoulder X diff: ' + avgShoulderDiffX.toFixed(4) + ' (separation: ' + shoulderSeparation.toFixed(4) + ')');
  console.log('  Avg Hip X diff:      ' + avgHipDiffX.toFixed(4) + ' (separation: ' + hipSeparation.toFixed(4) + ')');
  console.log('  Avg Separation:      ' + avgSeparation.toFixed(4));
  console.log('  Avg Z diff:          ' + avgZDiff.toFixed(4) + ' (abs: ' + Math.abs(avgZDiff).toFixed(4) + ')');
  console.log('  Is Front View (shoulderDiffX < 0): ' + (avgShoulderDiffX < 0));
  console.log('  Is Back View (shoulderDiffX > 0):  ' + (avgShoulderDiffX > 0));
  console.log('');
}

// Video 1: Shot 3 (frames 566-596, detected 561-587) - expecting "behind"
analyzeVideo('20181219_173607', 561, 587, 'behind');

// Also check all shots from video 1
analyzeVideo('20181219_173607', 30, 55, 'front-right');
analyzeVideo('20181219_173607', 317, 346, 'side-left');
analyzeVideo('20181219_173607', 833, 865, 'side-right');
