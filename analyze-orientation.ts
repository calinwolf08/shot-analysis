import * as fs from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';

const poses = JSON.parse(fs.readFileSync('test-data/20190804_140654/poses.json', 'utf8'));
const posesV1 = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf8'));

interface ShotInfo {
  name: string;
  start: number;
  end: number;
  poseData?: any;
}

// Video 20190804_140654 failing shots
const shotsV4: ShotInfo[] = [
  { name: 'V4-Shot 1 (labeled side-left)', start: 29, end: 42 },
  { name: 'V4-Shot 2 (labeled behind-left)', start: 141, end: 166 },
  { name: 'V4-Shot 3 (labeled behind-left)', start: 265, end: 282 },
  { name: 'V4-Shot 6 (labeled side-right)', start: 628, end: 651 },
  { name: 'V4-Shot 7 (labeled side-right)', start: 753, end: 774 },
];

// Video 20181219_173607 regressions
const shotsV1: ShotInfo[] = [
  { name: 'V1-Shot 1 (labeled front-right) - REGRESSION', start: 32, end: 55, poseData: posesV1 },
  { name: 'V1-Shot 2 (labeled side-left) - PASSES', start: 318, end: 346, poseData: posesV1 },
];

const posesV3 = JSON.parse(fs.readFileSync('test-data/20190124_175609/poses.json', 'utf8'));

// Video 20190124_175609 regressions
const shotsV3: ShotInfo[] = [
  { name: 'V3-Shot 3 (labeled side-left) - REGRESSION', start: 573, end: 597, poseData: posesV3 },
];

const allShots = [...shotsV4.map(s => ({ ...s, poseData: poses })), ...shotsV1, ...shotsV3];

function analyzeShot(shot: ShotInfo) {
  console.log('\n=== ' + shot.name + ' (frames ' + shot.start + '-' + shot.end + ') ===');

  const poseData = shot.poseData || poses;
  const frames = poseData.frames.filter(
    (f: any) => f.frameIndex >= shot.start && f.frameIndex <= shot.end
  );

  let totalShoulderDiffX = 0;
  let totalHipDiffX = 0;
  let totalShoulderZ = 0;
  let totalHipZ = 0;
  let validSamples = 0;

  for (const frame of frames) {
    if (!frame.landmarks) continue;

    const leftShoulder = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const rightShoulder = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const leftHip = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
    const rightHip = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;

    const minVis = 0.3;
    if (leftShoulder.visibility < minVis || rightShoulder.visibility < minVis ||
        leftHip.visibility < minVis || rightHip.visibility < minVis) continue;

    totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
    totalHipDiffX += rightHip.x - leftHip.x;
    totalShoulderZ += rightShoulder.z - leftShoulder.z;
    totalHipZ += rightHip.z - leftHip.z;
    validSamples++;
  }

  if (validSamples < 1) {
    console.log('  No valid samples');
    return;
  }

  const avgShoulderDiffX = totalShoulderDiffX / validSamples;
  const avgHipDiffX = totalHipDiffX / validSamples;
  const avgZDiff = totalShoulderZ / validSamples;
  const avgHipZDiff = totalHipZ / validSamples;

  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
  const absZDiff = Math.abs(avgZDiff);
  const absHipZDiff = Math.abs(avgHipZDiff);
  const zRatio = absHipZDiff > 0.1 ? absZDiff / absHipZDiff : 999;

  const isFrontView = avgShoulderDiffX < 0;

  console.log('  Samples:', validSamples);
  console.log('  shoulderDiffX:', avgShoulderDiffX.toFixed(4), isFrontView ? '(isFrontView)' : '(isBackView)');
  console.log('  hipDiffX:', avgHipDiffX.toFixed(4));
  console.log('  shoulderSep:', shoulderSeparation.toFixed(4), ', hipSep:', hipSeparation.toFixed(4), ', avgSep:', avgSeparation.toFixed(4));
  console.log('  shoulderZ:', avgZDiff.toFixed(4), ', hipZ:', avgHipZDiff.toFixed(4));
  console.log('  absZDiff:', absZDiff.toFixed(4), ', absHipZDiff:', absHipZDiff.toFixed(4));
  console.log('  zRatio (shoulder/hip):', zRatio.toFixed(3));
  console.log('  hipZConsistent:', absHipZDiff > 0.25 && Math.sign(avgHipZDiff) === Math.sign(avgZDiff));
}

for (const shot of allShots) {
  analyzeShot(shot);
}
