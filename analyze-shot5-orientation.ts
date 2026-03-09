import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Analyze orientation for shot 1 (frames 31-55)
function analyzeOrientation(startFrame: number, endFrame: number, label: string) {
  console.log(`\n=== ${label} (frames ${startFrame}-${endFrame}) ===`);

  let totalShoulderDiffX = 0;
  let totalHipDiffX = 0;
  let totalShoulderZ = 0;
  let totalHipZ = 0;
  let validSamples = 0;

  for (let i = startFrame; i <= endFrame; i++) {
    const frame = data.frames[i];
    if (!frame || !frame.landmarks) continue;

    const ls = frame.landmarks[11]; // left shoulder
    const rs = frame.landmarks[12]; // right shoulder
    const lh = frame.landmarks[23]; // left hip
    const rh = frame.landmarks[24]; // right hip

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

  const isFrontView = avgShoulderDiffX < 0;
  const isBackView = avgShoulderDiffX > 0;
  const frontBackThreshold = 0.15;
  const pureSideShoulderThreshold = 0.02;
  const sideThreshold = 0.05;
  const frontAngleThreshold = 0.35;
  const behindAngleThreshold = 0.40;
  const shoulderSeparation = Math.abs(avgShoulderDiffX);
  const hipSeparation = Math.abs(avgHipDiffX);
  const avgSeparation = (shoulderSeparation + hipSeparation) / 2;
  const absZDiff = Math.abs(avgZDiff);
  const sideViewZThreshold = 0.45;

  console.log(`avgShoulderDiffX = ${avgShoulderDiffX.toFixed(4)}`);
  console.log(`avgHipDiffX = ${avgHipDiffX.toFixed(4)}`);
  console.log(`avgZDiff = ${avgZDiff.toFixed(4)}`);
  console.log(`avgHipZDiff = ${avgHipZDiff.toFixed(4)}`);
  console.log(`shoulderSeparation = ${shoulderSeparation.toFixed(4)}`);
  console.log(`hipSeparation = ${hipSeparation.toFixed(4)}`);
  console.log(`avgSeparation = ${avgSeparation.toFixed(4)}`);
  console.log(`absZDiff = ${absZDiff.toFixed(4)}`);
  console.log(`isFrontView = ${isFrontView}, isBackView = ${isBackView}`);

  // Determine which case applies
  if (avgSeparation > frontBackThreshold) {
    console.log(`CASE 1: Good shoulder separation (${avgSeparation.toFixed(3)} > ${frontBackThreshold})`);
    if (isFrontView) {
      if (avgZDiff > frontAngleThreshold) {
        console.log(`Result: front-left (avgZDiff ${avgZDiff.toFixed(3)} > ${frontAngleThreshold})`);
      } else if (avgZDiff < -frontAngleThreshold) {
        console.log(`Result: front-right`);
      } else {
        console.log(`Result: front`);
      }
    }
  } else if (shoulderSeparation < pureSideShoulderThreshold && absZDiff > sideViewZThreshold) {
    console.log(`CASE 2: Pure side view (shoulderSep ${shoulderSeparation.toFixed(3)} < ${pureSideShoulderThreshold}, absZDiff ${absZDiff.toFixed(3)} > ${sideViewZThreshold})`);
    if (avgZDiff > 0) {
      console.log(`Result: side-left`);
    } else {
      console.log(`Result: side-right`);
    }
  } else if (absZDiff > sideViewZThreshold) {
    console.log(`CASE 3: Large Z-depth (absZDiff ${absZDiff.toFixed(3)} > ${sideViewZThreshold})`);
    const absHipZDiff = Math.abs(avgHipZDiff);
    const hipZConsistent = absHipZDiff > 0.25 && Math.sign(avgHipZDiff) === Math.sign(avgZDiff);
    console.log(`  hipZConsistent = ${hipZConsistent} (absHipZDiff=${absHipZDiff.toFixed(3)}, signs match: ${Math.sign(avgHipZDiff) === Math.sign(avgZDiff)})`);

    if (hipSeparation < 0.01) {
      console.log(`Result: front (hipSeparation ${hipSeparation.toFixed(3)} < 0.01)`);
    } else {
      // Check for behind-angled view
      const isSlightlyFrontView = isFrontView && avgShoulderDiffX > -0.05;
      const shoulderHipSeparationRatio = hipSeparation > 0.01 ? shoulderSeparation / hipSeparation : 999;
      const shoulderMoreOrEquallyAligned = shoulderHipSeparationRatio >= 1.0;
      const isBehindCandidate = isBackView || (isSlightlyFrontView && absZDiff > 0.50 && absHipZDiff > 0.30 && shoulderMoreOrEquallyAligned);
      console.log(`  isBehindCandidate = ${isBehindCandidate}`);

      const shoulderHipZRatio = absHipZDiff > 0.1 ? absZDiff / absHipZDiff : 999;
      console.log(`  shoulderHipZRatio = ${shoulderHipZRatio.toFixed(3)}`);

      const frontLeftShoulderThreshold = 0.08;
      const maxZRatioForFrontLeft = 1.7;

      if (isFrontView && shoulderSeparation > frontLeftShoulderThreshold && shoulderHipZRatio < maxZRatioForFrontLeft) {
        if (avgZDiff > 0) {
          console.log(`Result: front-left (shoulderSep ${shoulderSeparation.toFixed(3)} > ${frontLeftShoulderThreshold}, ratio ${shoulderHipZRatio.toFixed(3)} < ${maxZRatioForFrontLeft})`);
        } else {
          console.log(`Result: front-right`);
        }
      } else {
        if (avgZDiff > 0) {
          console.log(`Result: side-left`);
        } else {
          console.log(`Result: side-right`);
        }
      }
    }
  } else {
    console.log(`CASE 4: Angled view (moderate separation, moderate Z)`);
    const absHipZDiff = Math.abs(avgHipZDiff);

    if (isFrontView) {
      // Check for side views with moderate Z-depth
      const moderateZForSide = absZDiff > 0.30 && absZDiff < sideViewZThreshold;
      const moderateShoulderSep = shoulderSeparation > sideThreshold && shoulderSeparation < 0.12;
      const hipFollowsShoulder = Math.sign(avgHipZDiff) === Math.sign(avgZDiff) && absHipZDiff > 0.15;
      const hipNotHighlyConsistent = absHipZDiff < 0.25;

      console.log(`  moderateZForSide = ${moderateZForSide} (absZDiff=${absZDiff.toFixed(3)}, range: 0.30-${sideViewZThreshold})`);
      console.log(`  moderateShoulderSep = ${moderateShoulderSep} (shoulderSep=${shoulderSeparation.toFixed(3)}, range: ${sideThreshold}-0.12)`);
      console.log(`  hipFollowsShoulder = ${hipFollowsShoulder} (absHipZDiff=${absHipZDiff.toFixed(3)}, signs match: ${Math.sign(avgHipZDiff) === Math.sign(avgZDiff)})`);
      console.log(`  hipNotHighlyConsistent = ${hipNotHighlyConsistent}`);

      if (moderateZForSide && moderateShoulderSep && hipFollowsShoulder && hipNotHighlyConsistent) {
        if (avgZDiff > 0) {
          console.log(`Result: side-left (matched moderate Z-depth side view criteria)`);
        } else {
          console.log(`Result: side-right`);
        }
      } else {
        if (avgZDiff > frontAngleThreshold) {
          console.log(`Result: front-left (avgZDiff ${avgZDiff.toFixed(3)} > ${frontAngleThreshold})`);
        } else if (avgZDiff < -frontAngleThreshold) {
          console.log(`Result: front-right`);
        } else {
          console.log(`Result: front`);
        }
      }
    }
  }
}

// Analyze all three shots
analyzeOrientation(31, 55, 'Shot 1 (expected: side-left)');
analyzeOrientation(270, 312, 'Shot 2 (expected: side-left)');
analyzeOrientation(554, 578, 'Shot 3 (expected: front)');

// Also check the detected frame ranges
console.log('\n--- Using detected frame ranges instead of labeled ---');
analyzeOrientation(35, 56, 'Shot 1 detected range');
analyzeOrientation(287, 307, 'Shot 2 detected range');
analyzeOrientation(555, 573, 'Shot 3 detected range');
