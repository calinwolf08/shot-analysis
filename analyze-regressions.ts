import fs from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';

function analyzeShot(videoDir: string, startFrame: number, endFrame: number, label: string) {
  const data = JSON.parse(fs.readFileSync(`test-data/${videoDir}/poses.json`, 'utf-8'));

  console.log(`\n=== ${videoDir} - ${label} (frames ${startFrame}-${endFrame}) ===`);

  let totalShoulderDiffX = 0;
  let totalHipDiffX = 0;
  let totalShoulderZ = 0;
  let totalHipZ = 0;
  let validSamples = 0;

  for (let i = startFrame; i <= endFrame; i++) {
    const frame = data.frames[i];
    if (!frame || !frame.landmarks) continue;

    const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
    const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];

    if (!ls || !rs || !lh || !rh) continue;

    const minVisibility = 0.3;
    if (ls.visibility < minVisibility || rs.visibility < minVisibility ||
        lh.visibility < minVisibility || rh.visibility < minVisibility) continue;

    totalShoulderDiffX += rs.x - ls.x;
    totalHipDiffX += rh.x - lh.x;
    totalShoulderZ += rs.z - ls.z;
    totalHipZ += rh.z - lh.z;
    validSamples++;
  }

  if (validSamples === 0) {
    console.log('No valid samples!');
    return;
  }

  const avgShoulderDiffX = totalShoulderDiffX / validSamples;
  const avgHipDiffX = totalHipDiffX / validSamples;
  const avgZDiff = totalShoulderZ / validSamples;
  const avgHipZDiff = totalHipZ / validSamples;

  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const absZDiff = Math.abs(avgZDiff);
  const absHipZDiff = Math.abs(avgHipZDiff);

  const shoulderHipZRatio = absHipZDiff > 0.1 ? absZDiff / absHipZDiff : 999;
  const shoulderHipXRatio = hipSeparation > 0.01 ? shoulderSeparation / hipSeparation : 999;

  console.log(`shoulderDiffX=${avgShoulderDiffX.toFixed(4)}, hipDiffX=${avgHipDiffX.toFixed(4)}`);
  console.log(`shoulderZ=${avgZDiff.toFixed(4)}, hipZ=${avgHipZDiff.toFixed(4)}`);
  console.log(`shoulderSep=${shoulderSeparation.toFixed(4)}, hipSep=${hipSeparation.toFixed(4)}`);
  console.log(`absZDiff=${absZDiff.toFixed(4)}, absHipZDiff=${absHipZDiff.toFixed(4)}`);
  console.log(`shoulderHipZRatio=${shoulderHipZRatio.toFixed(3)}, shoulderHipXRatio=${shoulderHipXRatio.toFixed(3)}`);

  // Check which conditions apply
  const isFrontView = avgShoulderDiffX < 0;
  console.log(`isFrontView=${isFrontView}`);

  // New CASE 3a check (the regression causing front classification)
  if (isFrontView && shoulderSeparation < 0.05 && shoulderHipZRatio < 1.6 && shoulderHipXRatio < 1.6) {
    console.log(`--> CASE 3a: Would return FRONT (shoulderSep=${shoulderSeparation.toFixed(3)} < 0.05, ZRatio=${shoulderHipZRatio.toFixed(3)} < 1.6, XRatio=${shoulderHipXRatio.toFixed(3)} < 1.6)`);
  }
}

// Video 1 shot 1: expected front-right, detected side-right
analyzeShot('20181219_173607', 32, 55, 'Shot 1 (expected: front-right)');

// Video 3 shots 2, 3, 5: expected side-left, now detecting front
analyzeShot('20190124_175609', 277, 297, 'Shot 2 (expected: side-left)');
analyzeShot('20190124_175609', 573, 597, 'Shot 3 (expected: side-left)');
analyzeShot('20190124_175609', 939, 968, 'Shot 5 (expected: side-left)');

// Video 5 shot 3: expected front (now fixed)
analyzeShot('20190818_142631', 555, 573, 'Shot 3 (expected: front)');
