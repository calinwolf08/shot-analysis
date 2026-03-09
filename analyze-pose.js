const fs = require('fs');

function analyzeVideo(videoDir, startFrame, endFrame) {
  const poses = JSON.parse(fs.readFileSync('test-data/' + videoDir + '/poses.json'));

  const shotFrames = poses.frames.filter(f => f.frameIndex >= startFrame && f.frameIndex <= endFrame);

  console.log('Analysis for ' + videoDir + ' (frames ' + startFrame + '-' + endFrame + '):');
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

  console.log('  Avg Shoulder X diff: ' + avgShoulderDiffX.toFixed(4) + ' (abs: ' + Math.abs(avgShoulderDiffX).toFixed(4) + ')');
  console.log('  Avg Hip X diff:      ' + avgHipDiffX.toFixed(4) + ' (abs: ' + Math.abs(avgHipDiffX).toFixed(4) + ')');
  console.log('  Avg Z diff:          ' + avgZDiff.toFixed(4) + ' (abs: ' + Math.abs(avgZDiff).toFixed(4) + ')');
  console.log('  Is Front View (shoulderDiffX < 0): ' + (avgShoulderDiffX < 0));
  console.log('');
}

// Video 2: Shot 1 (frames 33-62, detected 39-56)
analyzeVideo('20190107_211108', 39, 56);

// Video 1: Shot 1 (frames 31-58, detected 30-55) - expecting front-right
analyzeVideo('20181219_173607', 30, 55);
