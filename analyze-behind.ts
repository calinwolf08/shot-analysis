import { loadPoseData } from './src/testing/loader.js';
import { LANDMARK_INDEX } from './src/pose/types.js';
import type { PoseData, Frame } from './src/testing/types.js';

function getMetrics(poseData: PoseData, start: number, end: number) {
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

  if (validSamples === 0) return null;

  const shoulderSep = Math.abs(totalShoulderDiffX / validSamples);
  const hipSep = Math.abs(totalHipDiffX / validSamples);
  return {
    avgZDiff: totalShoulderZ / validSamples,
    avgHipZDiff: totalHipZ / validSamples,
    shoulderSep,
    hipSep,
    xRatio: hipSep > 0.01 ? shoulderSep / hipSep : 999,
  };
}

async function analyze() {
  console.log('Behind-related shots - analyze Z-diff values:');
  console.log('');

  // All behind-related shots across all videos
  const data = [
    { video: '20181219_173607', shots: [{ start: 566, end: 596, ori: 'behind' }]},
    { video: '20190804_140654', shots: [
      { start: 135, end: 167, ori: 'behind-left' },
      { start: 257, end: 286, ori: 'behind-left' },
      { start: 371, end: 398, ori: 'behind' },
      { start: 506, end: 537, ori: 'behind-right' },
    ]},
    { video: 'zak-1', shots: [
      { start: 342, end: 359, ori: 'behind-right' },
      { start: 437, end: 459, ori: 'behind' },
    ]},
  ];

  for (const videoData of data) {
    const result = loadPoseData('test-data/' + videoData.video + '/poses.json');
    if (!result.success) continue;

    for (const shot of videoData.shots) {
      const m = getMetrics(result.data, shot.start, shot.end);
      if (!m) continue;
      console.log(videoData.video + ' (' + shot.ori + '): ZDiff=' + m.avgZDiff.toFixed(3) +
        ', HipZ=' + m.avgHipZDiff.toFixed(3) +
        ', ShoulderSep=' + m.shoulderSep.toFixed(3) +
        ', HipSep=' + m.hipSep.toFixed(3) +
        ', XRatio=' + m.xRatio.toFixed(2));
    }
  }
}
analyze();
