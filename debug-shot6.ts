import { loadPoseData } from './src/testing/loader.js';
import { LANDMARK_INDEX } from './src/pose/types.js';
import type { PoseData, Frame } from './src/testing/types.js';

function analyzeShot(poseData: PoseData, name: string, start: number, end: number) {
  console.log('\n=== ' + name + ' (frames ' + start + '-' + end + ') ===');

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

  if (validSamples === 0) return;

  const avgShoulderDiffX = totalShoulderDiffX / validSamples;
  const avgHipDiffX = totalHipDiffX / validSamples;
  const avgZDiff = totalShoulderZ / validSamples;
  const avgHipZDiff = totalHipZ / validSamples;

  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
  const absZDiff = Math.abs(avgZDiff);
  const absHipZDiff = Math.abs(avgHipZDiff);

  const isFrontView = avgShoulderDiffX < 0;
  const isBackView = avgShoulderDiffX > 0;

  // Hip-based front/back determination
  const hipFrontView = avgHipDiffX < 0;
  const hipBackView = avgHipDiffX > 0;

  console.log('Shoulder: diffX=' + avgShoulderDiffX.toFixed(3) + ', sep=' + shoulderSeparation.toFixed(3) + ', Z=' + avgZDiff.toFixed(3));
  console.log('Hip: diffX=' + avgHipDiffX.toFixed(3) + ', sep=' + hipSeparation.toFixed(3) + ', Z=' + avgHipZDiff.toFixed(3));
  console.log('avgSeparation=' + avgSeparation.toFixed(3) + ', absZDiff=' + absZDiff.toFixed(3));
  console.log('Shoulder view: isFront=' + isFrontView + ', isBack=' + isBackView);
  console.log('Hip view: isFront=' + hipFrontView + ', isBack=' + hipBackView);
  console.log('CASE: avgSep>' + 0.15 + '?' + (avgSeparation > 0.15) + ', absZDiff>' + 0.45 + '?' + (absZDiff > 0.45));
}

async function analyze() {
  // Shot 6 (front, detected side-left)
  const zakResult = loadPoseData('test-data/zak-1/poses.json');
  if (zakResult.success) {
    analyzeShot(zakResult.data, 'zak-1 Shot 6 (expected: front)', 532, 552);
    analyzeShot(zakResult.data, 'zak-1 Shot 7 (expected: side-left)', 678, 695);
    analyzeShot(zakResult.data, 'zak-1 Shot 8 (expected: side-left)', 785, 801);
  }

  // Compare with passing front shot
  const frontResult = loadPoseData('test-data/20190107_211108/poses.json');
  if (frontResult.success) {
    analyzeShot(frontResult.data, '20190107 Shot 1 (expected: front, PASSING)', 33, 62);
  }

  // Compare with passing side-left shots
  const sideLResult = loadPoseData('test-data/20190124_175609/poses.json');
  if (sideLResult.success) {
    analyzeShot(sideLResult.data, '20190124 Shot 2 (expected: side-left, PASSING)', 273, 303);
  }
}
analyze();
