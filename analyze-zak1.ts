import { loadPoseData } from './src/testing/loader.js';
import { LANDMARK_INDEX } from './src/pose/types.js';

async function analyze() {
  const result = loadPoseData('test-data/zak-1/poses.json');
  if (!result.success) {
    console.log('Failed to load pose data: ' + result.error);
    return;
  }
  const poseData = result.data;

  // All shots - both passing and failing
  const allShots = [
    { shot: 1, start: 2, end: 29, detectedOri: 'side-right', expectedOri: 'front-right', pass: false },
    { shot: 2, start: 109, end: 129, detectedOri: 'side-right', expectedOri: 'side-right', pass: true },
    { shot: 3, start: 247, end: 263, detectedOri: 'side-right', expectedOri: 'side-right', pass: true },
    { shot: 4, start: 342, end: 359, detectedOri: 'behind', expectedOri: 'behind-right', pass: false },
    { shot: 5, start: 433, end: 456, detectedOri: 'behind', expectedOri: 'behind', pass: true },
    { shot: 6, start: 532, end: 552, detectedOri: 'side-left', expectedOri: 'front', pass: false },
    { shot: 7, start: 678, end: 695, detectedOri: 'front-left', expectedOri: 'side-left', pass: false },
    { shot: 8, start: 785, end: 801, detectedOri: 'front-left', expectedOri: 'side-left', pass: false },
    { shot: 9, start: 896, end: 916, detectedOri: 'front', expectedOri: 'front-left', pass: false },
  ];
  const failingShots = allShots;

  for (const shot of failingShots) {
    console.log('\n=== Shot ' + shot.shot + ' (frames ' + shot.start + '-' + shot.end + ') ===');
    console.log('Detected: ' + shot.detectedOri + ', Expected: ' + shot.expectedOri);

    // Get frames for this shot
    const shotFrames = poseData.frames.filter(f => f.frameIndex >= shot.start && f.frameIndex <= shot.end);

    let totalShoulderDiffX = 0;
    let totalHipDiffX = 0;
    let totalShoulderZ = 0;
    let totalHipZ = 0;
    let validSamples = 0;

    for (const frame of shotFrames) {
      if (frame.landmarks === null) continue;

      const landmarks = frame.landmarks;
      const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
      const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
      const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;

      const minVisibility = 0.3;
      if (leftShoulder.visibility < minVisibility || rightShoulder.visibility < minVisibility ||
          leftHip.visibility < minVisibility || rightHip.visibility < minVisibility) continue;

      totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
      totalHipDiffX += rightHip.x - leftHip.x;
      totalShoulderZ += rightShoulder.z - leftShoulder.z;
      totalHipZ += rightHip.z - leftHip.z;
      validSamples++;
    }

    if (validSamples > 0) {
      const avgShoulderDiffX = totalShoulderDiffX / validSamples;
      const avgHipDiffX = totalHipDiffX / validSamples;
      const avgZDiff = totalShoulderZ / validSamples;
      const avgHipZDiff = totalHipZ / validSamples;

      const shoulderSeparation = Math.abs(avgShoulderDiffX);
      const hipSeparation = Math.abs(avgHipDiffX);
      const absZDiff = Math.abs(avgZDiff);
      const absHipZDiff = Math.abs(avgHipZDiff);

      console.log('Samples: ' + validSamples);
      console.log('avgShoulderDiffX: ' + avgShoulderDiffX.toFixed(4));
      console.log('avgHipDiffX: ' + avgHipDiffX.toFixed(4));
      console.log('shoulderSeparation: ' + shoulderSeparation.toFixed(4));
      console.log('hipSeparation: ' + hipSeparation.toFixed(4));
      console.log('avgZDiff: ' + avgZDiff.toFixed(4) + ' (shoulder)');
      console.log('avgHipZDiff: ' + avgHipZDiff.toFixed(4) + ' (hip)');
      console.log('isFrontView: ' + (avgShoulderDiffX < 0) + ' (shoulderDiffX < 0)');
      console.log('isBackView: ' + (avgShoulderDiffX > 0) + ' (shoulderDiffX > 0)');

      // Additional thresholds analysis
      const frontBackThreshold = 0.15;
      const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
      console.log('avgSeparation: ' + avgSeparation.toFixed(4) + ' (frontBackThreshold: 0.15)');
      console.log('absZDiff > 0.45 (sideViewZThreshold): ' + (absZDiff > 0.45));
    }
  }
}
analyze();
