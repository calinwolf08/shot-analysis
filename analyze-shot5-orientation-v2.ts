import fs from 'fs';
import { LANDMARK_INDEX } from './src/pose/types';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Replicate the updated orientation detection logic
function analyzeOrientationUpdated(startFrame: number, endFrame: number, label: string) {
  console.log(`\n=== ${label} (frames ${startFrame}-${endFrame}) ===`);

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
    return 'unknown';
  }

  const avgShoulderDiffX = totalShoulderDiffX / validSamples;
  const avgHipDiffX = totalHipDiffX / validSamples;
  const avgZDiff = totalShoulderZ / validSamples;
  const avgHipZDiff = totalHipZ / validSamples;

  const isFrontView = avgShoulderDiffX < 0;
  const frontBackThreshold = 0.15;
  const pureSideShoulderThreshold = 0.02;
  const sideThreshold = 0.05;
  const frontAngleThreshold = 0.35;
  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
  const absZDiff = Math.abs(avgZDiff);
  const sideViewZThreshold = 0.45;
  const absHipZDiff = Math.abs(avgHipZDiff);

  console.log(`avgShoulderDiffX = ${avgShoulderDiffX.toFixed(4)}, avgHipDiffX = ${avgHipDiffX.toFixed(4)}`);
  console.log(`avgZDiff = ${avgZDiff.toFixed(4)}, avgHipZDiff = ${avgHipZDiff.toFixed(4)}`);
  console.log(`shoulderSep = ${shoulderSeparation.toFixed(4)}, hipSep = ${hipSeparation.toFixed(4)}`);
  console.log(`absZDiff = ${absZDiff.toFixed(4)}, absHipZDiff = ${absHipZDiff.toFixed(4)}`);

  // CASE 1
  if (avgSeparation > frontBackThreshold) {
    console.log('CASE 1: Good shoulder separation');
    // ... simplified
    return isFrontView ? (avgZDiff > frontAngleThreshold ? 'front-left' : 'front') : 'behind';
  }
  // CASE 2
  else if (shoulderSeparation < pureSideShoulderThreshold && absZDiff > sideViewZThreshold) {
    console.log('CASE 2: Pure side view');
    return avgZDiff > 0 ? 'side-left' : 'side-right';
  }
  // CASE 3
  else if (absZDiff > sideViewZThreshold) {
    console.log('CASE 3: Large Z-depth');

    if (hipSeparation < 0.01) {
      console.log('  -> Front (hipSeparation < 0.01)');
      return 'front';
    }

    const shoulderHipZRatio = absHipZDiff > 0.1 ? absZDiff / absHipZDiff : 999;
    const shoulderHipXRatio = hipSeparation > 0.01 ? shoulderSeparation / hipSeparation : 999;

    console.log(`  shoulderHipZRatio = ${shoulderHipZRatio.toFixed(3)}`);
    console.log(`  shoulderHipXRatio = ${shoulderHipXRatio.toFixed(3)}`);

    // NEW: CASE 3a - Front view with small shoulder separation
    if (isFrontView && shoulderSeparation < 0.05 && shoulderHipZRatio < 1.6 && shoulderHipXRatio < 1.6) {
      console.log('  -> CASE 3a: Front (small shoulderSep, low Z/X ratios)');
      return 'front';
    }

    const frontLeftShoulderThreshold = 0.08;
    const maxZRatioForFrontLeft = 1.7;

    if (isFrontView && shoulderSeparation > frontLeftShoulderThreshold && shoulderHipZRatio < maxZRatioForFrontLeft) {
      console.log(`  -> Front-left/right (shoulderSep > ${frontLeftShoulderThreshold}, Zratio < ${maxZRatioForFrontLeft})`);
      return avgZDiff > 0 ? 'front-left' : 'front-right';
    }

    console.log('  -> Side view (fallthrough)');
    return avgZDiff > 0 ? 'side-left' : 'side-right';
  }
  // CASE 4
  else {
    console.log('CASE 4: Angled view');

    if (isFrontView) {
      // Check for side views with moderate Z-depth
      const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
      const moderateShoulderSep = shoulderSeparation > sideThreshold && shoulderSeparation < 0.12;
      const hipFollowsShoulder = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.20;

      console.log(`  moderateZForSide = ${moderateZForSide}`);
      console.log(`  moderateShoulderSep = ${moderateShoulderSep}`);
      console.log(`  hipFollowsShoulder = ${hipFollowsShoulder}`);

      if (moderateZForSide && moderateShoulderSep && hipFollowsShoulder) {
        console.log('  -> Side view (moderate Z, moderate shoulder sep, hip follows)');
        return avgZDiff > 0 ? 'side-left' : 'side-right';
      }

      if (avgZDiff > frontAngleThreshold) {
        console.log(`  -> front-left (avgZDiff ${avgZDiff.toFixed(3)} > ${frontAngleThreshold})`);
        return 'front-left';
      }
      console.log('  -> front');
      return 'front';
    }
  }

  return 'unknown';
}

// Analyze all three shots with labeled frame ranges
console.log('=== USING LABELED FRAME RANGES ===');
console.log(analyzeOrientationUpdated(31, 55, 'Shot 1 (expected: side-left)'));
console.log(analyzeOrientationUpdated(270, 312, 'Shot 2 (expected: side-left)'));
console.log(analyzeOrientationUpdated(554, 578, 'Shot 3 (expected: front)'));

// Also check the detected frame ranges
console.log('\n=== USING DETECTED FRAME RANGES ===');
console.log(analyzeOrientationUpdated(35, 56, 'Shot 1 detected range (expected: side-left)'));
console.log(analyzeOrientationUpdated(287, 307, 'Shot 2 detected range (expected: side-left)'));
console.log(analyzeOrientationUpdated(555, 573, 'Shot 3 detected range (expected: front)'));
