import { loadPoseData } from './src/testing/loader.js';
import { LANDMARK_INDEX } from './src/pose/types.js';
import type { PoseData, Frame } from './src/testing/types.js';

function debugOrientation(poseData: PoseData, shotName: string, start: number, end: number, expected: string) {
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

  // Constants from the algorithm
  const frontBackThreshold = 0.15;
  const pureSideShoulderThreshold = 0.02;
  const sideThreshold = 0.05;
  const frontAngleThreshold = 0.25;
  const behindAngleThreshold = 0.40;
  const sideViewZThreshold = 0.45;

  const isFrontView = avgShoulderDiffX < 0;
  const isBackView = avgShoulderDiffX > 0;

  console.log('Metrics:');
  console.log('  shoulderSeparation: ' + shoulderSeparation.toFixed(4) + ', hipSeparation: ' + hipSeparation.toFixed(4));
  console.log('  avgSeparation: ' + avgSeparation.toFixed(4) + ' (frontBackThreshold: ' + frontBackThreshold + ')');
  console.log('  avgZDiff: ' + avgZDiff.toFixed(4) + ', absZDiff: ' + absZDiff.toFixed(4));
  console.log('  avgHipZDiff: ' + avgHipZDiff.toFixed(4) + ', absHipZDiff: ' + absHipZDiff.toFixed(4));
  console.log('  isFrontView: ' + isFrontView + ', isBackView: ' + isBackView);

  // Trace through algorithm
  console.log('\nAlgorithm trace:');

  // CASE 1: Good shoulder separation
  if (avgSeparation > frontBackThreshold) {
    console.log('  CASE 1: avgSeparation > frontBackThreshold');
    if (isFrontView) {
      if (avgZDiff > frontAngleThreshold) {
        console.log('  -> front-left (avgZDiff > ' + frontAngleThreshold + ')');
      } else if (avgZDiff < -frontAngleThreshold) {
        console.log('  -> front-right (avgZDiff < -' + frontAngleThreshold + ')');
      } else {
        console.log('  -> front');
      }
    } else if (isBackView) {
      if (avgZDiff > behindAngleThreshold) {
        console.log('  -> behind-left');
      } else if (avgZDiff < -behindAngleThreshold) {
        console.log('  -> behind-right');
      } else {
        console.log('  -> behind');
      }
    }
    return;
  }

  // CASE 2: Pure side view
  if (shoulderSeparation < pureSideShoulderThreshold && absZDiff > sideViewZThreshold) {
    console.log('  CASE 2: shoulderSeparation < ' + pureSideShoulderThreshold + ' AND absZDiff > ' + sideViewZThreshold);
    if (avgZDiff > 0) {
      console.log('  -> side-left');
    } else {
      console.log('  -> side-right');
    }
    return;
  }

  // CASE 2b: Near-pure side view
  if (shoulderSeparation < 0.03 && absZDiff > 0.40) {
    console.log('  CASE 2b: shoulderSeparation < 0.03 AND absZDiff > 0.40');
    if (avgZDiff > 0) {
      console.log('  -> side-left');
    } else {
      console.log('  -> side-right');
    }
    return;
  }

  // CASE 3: Large Z-depth
  if (absZDiff > sideViewZThreshold) {
    console.log('  CASE 3: absZDiff > sideViewZThreshold (' + sideViewZThreshold + ')');

    const hipZConsistent = absHipZDiff > 0.25 && Math.sign(avgHipZDiff) === Math.sign(avgZDiff);
    console.log('    hipZConsistent: ' + hipZConsistent);

    if (hipSeparation < 0.01) {
      console.log('  -> front (hipSeparation < 0.01)');
      return;
    }

    const shoulderHipZRatio = absHipZDiff > 0.1 ? absZDiff / absHipZDiff : 999;
    const shoulderHipXRatio = hipSeparation > 0.01 ? shoulderSeparation / hipSeparation : 999;
    console.log('    shoulderHipZRatio: ' + shoulderHipZRatio.toFixed(2) + ', shoulderHipXRatio: ' + shoulderHipXRatio.toFixed(2));

    // Check for behind-angled views
    const isSlightlyFrontView = isFrontView && avgShoulderDiffX > -0.05;
    const shoulderMoreOrEquallyAligned = shoulderHipXRatio >= 1.0;
    const isBehindCandidate = isBackView || (isSlightlyFrontView && absZDiff > 0.50 && absHipZDiff > 0.30 && shoulderMoreOrEquallyAligned);
    console.log('    isBehindCandidate: ' + isBehindCandidate);

    if (hipZConsistent && isBehindCandidate &&
        shoulderSeparation > pureSideShoulderThreshold && shoulderSeparation < sideThreshold &&
        hipSeparation > 0.02 && hipSeparation < 0.04) {
      if (absHipZDiff > 0.30) {
        if (avgZDiff > 0) {
          console.log('  -> behind-left (hipZConsistent + isBehindCandidate path)');
          return;
        } else if (shoulderSeparation > 0.04) {
          console.log('  -> behind-right (hipZConsistent + isBehindCandidate path)');
          return;
        }
      }
    }

    // CASE 3a: Front view with small shoulder separation
    const frontThreshold = 0.05;
    if (isFrontView && shoulderSeparation < frontThreshold && shoulderHipZRatio < 1.6 && shoulderHipXRatio > 1.2) {
      console.log('  -> front (CASE 3a)');
      return;
    }

    // Front-left/front-right check
    const frontLeftShoulderThreshold = 0.08;
    const maxZRatioForFrontLeft = 1.7;
    if (isFrontView && shoulderSeparation > frontLeftShoulderThreshold && shoulderHipZRatio < maxZRatioForFrontLeft) {
      if (avgZDiff > 0) {
        console.log('  -> front-left (shoulderSep > ' + frontLeftShoulderThreshold + ' && ZRatio < ' + maxZRatioForFrontLeft + ')');
      } else {
        console.log('  -> front-right');
      }
      return;
    }

    // Default for CASE 3
    if (avgZDiff > 0) {
      console.log('  -> side-left (default CASE 3)');
    } else {
      console.log('  -> side-right (default CASE 3)');
    }
    return;
  }

  // CASE 4: Angled view
  console.log('  CASE 4: Angled view (moderate separation, moderate Z)');

  if (isFrontView) {
    // Check for side views with moderate Z-depth (0.30-0.45)
    const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
    const moderateShoulderSep = shoulderSeparation > sideThreshold && shoulderSeparation < 0.12;
    const hipFollowsShoulder = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.15;
    const hipNotHighlyConsistent = absHipZDiff < 0.25;
    const higherShoulderSep = shoulderSeparation > 0.07;
    const isHigherSepSideLeft = avgZDiff > 0 && absHipZDiff < 0.25;

    console.log('    moderateZForSide: ' + moderateZForSide + ' (absZDiff: ' + absZDiff.toFixed(3) + ')');
    console.log('    moderateShoulderSep: ' + moderateShoulderSep + ' (shoulderSep: ' + shoulderSeparation.toFixed(3) + ')');
    console.log('    hipFollowsShoulder: ' + hipFollowsShoulder);
    console.log('    hipNotHighlyConsistent: ' + hipNotHighlyConsistent);

    if (moderateZForSide && moderateShoulderSep && hipFollowsShoulder) {
      if (avgZDiff > 0) {
        if (!higherShoulderSep || isHigherSepSideLeft) {
          console.log('  -> side-left (CASE 4 side detection)');
          return;
        }
      } else if (hipNotHighlyConsistent) {
        console.log('  -> side-right (CASE 4 side detection)');
        return;
      }
    }

    if (avgZDiff > frontAngleThreshold) {
      console.log('  -> front-left (avgZDiff > ' + frontAngleThreshold + ')');
    } else if (avgZDiff < -frontAngleThreshold) {
      console.log('  -> front-right');
    } else {
      console.log('  -> front');
    }
  } else if (isBackView) {
    if (shoulderSeparation < sideThreshold && hipSeparation < 0.02) {
      console.log('  -> front (small sep check in CASE 4 back)');
      return;
    }

    const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
    const smallShoulderSep = shoulderSeparation < sideThreshold;
    const hipFollowsShoulderZ = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.15;

    if (moderateZForSide && smallShoulderSep && hipFollowsShoulderZ) {
      if (avgZDiff > 0) {
        console.log('  -> side-left (CASE 4 back side detection)');
      } else {
        console.log('  -> side-right (CASE 4 back side detection)');
      }
      return;
    }

    if (avgZDiff > behindAngleThreshold) {
      console.log('  -> behind-left');
    } else if (avgZDiff < -behindAngleThreshold) {
      console.log('  -> behind-right');
    } else {
      console.log('  -> behind');
    }
  }
}

async function analyze() {
  const resultZak = loadPoseData('test-data/zak-1/poses.json');
  if (!resultZak.success) return;

  // All failing shots
  debugOrientation(resultZak.data, 'Zak-Shot1', 2, 29, 'front-right');
  debugOrientation(resultZak.data, 'Zak-Shot4', 342, 359, 'behind-right');
  debugOrientation(resultZak.data, 'Zak-Shot6', 532, 552, 'front');
  debugOrientation(resultZak.data, 'Zak-Shot7', 678, 695, 'side-left');
  debugOrientation(resultZak.data, 'Zak-Shot8', 785, 801, 'side-left');
  debugOrientation(resultZak.data, 'Zak-Shot9', 896, 916, 'front-left');
}
analyze();
