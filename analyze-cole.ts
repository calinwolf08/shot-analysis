import { loadPoseData } from './src/testing/loader.js';
import { establishGroundBaseline } from './src/keyframe-detector.js';

async function analyze() {
  const poseResult = loadPoseData('test-data/20190103_180930/poses.json');
  if (!poseResult.success) {
    console.error('Failed to load pose data:', poseResult.error);
    return;
  }

  const poseData = poseResult.data;

  // Shot 2: Start at 249, release around 264
  const startFrame = 249;
  const releaseFrame = 264;
  const endFrame = 270;
  const jumpSearchStart = Math.max(startFrame, releaseFrame - 15);

  console.log('jumpSearchStart:', jumpSearchStart);

  const baseline = establishGroundBaseline(
    poseData.frames,
    jumpSearchStart,
    endFrame,
    0.4,
    0.5
  );

  console.log('Ground baseline:', baseline);

  const leaveThreshold = 0.015;
  const landThreshold = 0.03;

  // Now check ankle positions with baseline
  console.log('\n=== Checking deviations from baseline ===');
  const LEFT_ANKLE = 27;
  const RIGHT_ANKLE = 28;

  for (let i = 0; i < poseData.frames.length; i++) {
    const frame = poseData.frames[i];
    if (!frame || !frame.landmarks) continue;

    const frameIdx = frame.frameIndex;
    if (frameIdx >= 249 && frameIdx <= 270) {
      const leftAnkle = frame.landmarks[LEFT_ANKLE];
      const rightAnkle = frame.landmarks[RIGHT_ANKLE];

      if (leftAnkle && rightAnkle) {
        const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
        const deviation = baseline ? baseline.ankleY - avgAnkleY : 0;
        const leaveStatus = deviation > leaveThreshold ? 'LEAVE' : 'ground';
        const landStatus = deviation > landThreshold ? 'IN AIR' : 'landed';

        console.log('Frame ' + frameIdx + ': ankleY=' + avgAnkleY.toFixed(4) +
                    ' deviation=' + deviation.toFixed(4) +
                    ' [leave:' + leaveStatus + ', land:' + landStatus + ']');
      }
    }
  }
}

analyze();
