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

  return {
    avgShoulderDiffX: totalShoulderDiffX / validSamples,
    avgHipDiffX: totalHipDiffX / validSamples,
    avgZDiff: totalShoulderZ / validSamples,
    avgHipZDiff: totalHipZ / validSamples,
    shoulderSeparation: Math.abs(totalShoulderDiffX / validSamples),
    hipSeparation: Math.abs(totalHipDiffX / validSamples),
  };
}

async function analyze() {
  // Check all front-related orientations across passing videos
  const data = [
    { video: '20181219_173607', shots: [
      { start: 31, end: 58, ori: 'front-right' },
      { start: 327, end: 350, ori: 'side-left' },
      { start: 566, end: 596, ori: 'behind' },
      { start: 825, end: 864, ori: 'side-right' },
    ]},
    { video: '20190107_211108', shots: [
      { start: 33, end: 62, ori: 'front' },
    ]},
    { video: '20190124_175609', shots: [
      { start: 15, end: 41, ori: 'front-left' },
      { start: 273, end: 303, ori: 'side-left' },
      { start: 579, end: 602, ori: 'side-left' },
      { start: 803, end: 828, ori: 'side-left' },
      { start: 944, end: 967, ori: 'side-left' },
    ]},
  ];

  console.log('Video,Shot,Orientation,ShoulderDiffX,ShoulderSep,HipSep,ZDiff,HipZDiff,ZRatio,XRatio');

  for (const videoData of data) {
    const result = loadPoseData('test-data/' + videoData.video + '/poses.json');
    if (!result.success) continue;

    for (let i = 0; i < videoData.shots.length; i++) {
      const shot = videoData.shots[i];
      const m = getMetrics(result.data, shot.start, shot.end);
      if (!m) continue;

      const zRatio = Math.abs(m.avgHipZDiff) > 0.1 ? Math.abs(m.avgZDiff) / Math.abs(m.avgHipZDiff) : 999;
      const xRatio = m.hipSeparation > 0.01 ? m.shoulderSeparation / m.hipSeparation : 999;
      console.log([
        videoData.video,
        i + 1,
        shot.ori,
        m.avgShoulderDiffX.toFixed(4),
        m.shoulderSeparation.toFixed(4),
        m.hipSeparation.toFixed(4),
        m.avgZDiff.toFixed(4),
        m.avgHipZDiff.toFixed(4),
        zRatio.toFixed(2),
        xRatio.toFixed(2),
      ].join(','));
    }
  }

  console.log('\n--- ZAK-1 ---');
  const zakResult = loadPoseData('test-data/zak-1/poses.json');
  if (!zakResult.success) return;

  const zakShots = [
    { start: 2, end: 29, ori: 'front-right' },
    { start: 109, end: 129, ori: 'side-right' },
    { start: 247, end: 263, ori: 'side-right' },
    { start: 342, end: 359, ori: 'behind-right' },
    { start: 433, end: 456, ori: 'behind' },
    { start: 532, end: 552, ori: 'front' },
    { start: 678, end: 695, ori: 'side-left' },
    { start: 785, end: 801, ori: 'side-left' },
    { start: 896, end: 916, ori: 'front-left' },
  ];

  for (let i = 0; i < zakShots.length; i++) {
    const shot = zakShots[i];
    const m = getMetrics(zakResult.data, shot.start, shot.end);
    if (!m) continue;

    const zRatio = Math.abs(m.avgHipZDiff) > 0.1 ? Math.abs(m.avgZDiff) / Math.abs(m.avgHipZDiff) : 999;
    const xRatio = m.hipSeparation > 0.01 ? m.shoulderSeparation / m.hipSeparation : 999;
    console.log([
      'zak-1',
      i + 1,
      shot.ori,
      m.avgShoulderDiffX.toFixed(4),
      m.shoulderSeparation.toFixed(4),
      m.hipSeparation.toFixed(4),
      m.avgZDiff.toFixed(4),
      m.avgHipZDiff.toFixed(4),
      zRatio.toFixed(2),
      xRatio.toFixed(2),
    ].join(','));
  }
}
analyze();
