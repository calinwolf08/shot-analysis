import { loadPoseData } from './src/testing/loader.js';
import { LANDMARK_INDEX } from './src/pose/types.js';
import type { PoseData, Frame } from './src/testing/types.js';

function analyzeShot(poseData: PoseData, shotName: string, start: number, end: number, expected: string) {
  console.log('\n=== ' + shotName + ' (frames ' + start + '-' + end + ', expected: ' + expected + ') ===');

  const shotFrames = poseData.frames.filter((f: Frame) => f.frameIndex >= start && f.frameIndex <= end);

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

    console.log('Samples: ' + validSamples);
    console.log('avgShoulderDiffX: ' + avgShoulderDiffX.toFixed(4) + ' (isFront: ' + (avgShoulderDiffX < 0) + ')');
    console.log('avgHipDiffX: ' + avgHipDiffX.toFixed(4));
    console.log('shoulderSeparation: ' + shoulderSeparation.toFixed(4));
    console.log('hipSeparation: ' + hipSeparation.toFixed(4));
    console.log('avgZDiff: ' + avgZDiff.toFixed(4) + ' (shoulder)');
    console.log('avgHipZDiff: ' + avgHipZDiff.toFixed(4) + ' (hip)');
  }
}

async function analyze() {
  // Video 1 - shot 1 is front-right (passing)
  const result1 = loadPoseData('test-data/20181219_173607/poses.json');
  if (result1.success) {
    analyzeShot(result1.data, 'Video1-Shot1 (PASSING)', 31, 58, 'front-right');
    analyzeShot(result1.data, 'Video1-Shot2 (PASSING)', 327, 350, 'side-left');
    analyzeShot(result1.data, 'Video1-Shot3 (PASSING)', 566, 596, 'behind');
  }

  // Video 3 - has front-left and side-left (passing)
  const result3 = loadPoseData('test-data/20190124_175609/poses.json');
  if (result3.success) {
    analyzeShot(result3.data, 'Video3-Shot1 (PASSING)', 15, 41, 'front-left');
    analyzeShot(result3.data, 'Video3-Shot2 (PASSING)', 273, 303, 'side-left');
  }

  // zak-1 - failing shots
  const resultZak = loadPoseData('test-data/zak-1/poses.json');
  if (resultZak.success) {
    analyzeShot(resultZak.data, 'Zak-Shot1 (FAILING)', 2, 29, 'front-right');
    analyzeShot(resultZak.data, 'Zak-Shot7 (FAILING)', 678, 695, 'side-left');
    analyzeShot(resultZak.data, 'Zak-Shot8 (FAILING)', 785, 801, 'side-left');
    analyzeShot(resultZak.data, 'Zak-Shot9 (FAILING)', 896, 916, 'front-left');
  }
}
analyze();
