import * as fs from 'fs';

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

const testDirs = [
  'chris-5',
  '20201212_134104',
  '20190103_181419',
  '20190103_180930',
  '20190818_142631',
  '20190804_140617',
];

console.log("Check if proposed filters would affect true shots:");
console.log("===================================================\n");

console.log("Filter 1: shoulderSep > 0.12 AND shoulderDiffX > 0 (rejects large back views)");
console.log("Filter 2: shoulderZ > 0.55 (rejects extreme positive Z)\n");

for (const dir of testDirs) {
  const posesPath = `./test-data/${dir}/poses.json`;
  if (!fs.existsSync(posesPath)) continue;

  const poseData = JSON.parse(fs.readFileSync(posesPath, 'utf-8'));
  const labels = JSON.parse(fs.readFileSync(`./test-data/${dir}/labels.json`, 'utf-8'));

  console.log(`${labels.video}:`);

  for (const shot of labels.shots) {
    let totalShoulderDiffX = 0;
    let totalShoulderZ = 0;
    let validSamples = 0;

    for (const frame of poseData.frames) {
      if (frame.frameIndex < shot.startFrame || frame.frameIndex > shot.endFrame) continue;
      if (!frame.landmarks) continue;

      const lm = frame.landmarks;
      const leftShoulder = lm[LEFT_SHOULDER];
      const rightShoulder = lm[RIGHT_SHOULDER];

      if (!leftShoulder || !rightShoulder) continue;
      if (leftShoulder.visibility < 0.3 || rightShoulder.visibility < 0.3) continue;

      totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
      totalShoulderZ += rightShoulder.z - leftShoulder.z;
      validSamples++;
    }

    if (validSamples > 0) {
      const avgShoulderDiffX = totalShoulderDiffX / validSamples;
      const avgShoulderZ = totalShoulderZ / validSamples;
      const shoulderSep = Math.abs(avgShoulderDiffX);

      const wouldReject1 = shoulderSep > 0.12 && avgShoulderDiffX > 0;
      const wouldReject2 = avgShoulderZ > 0.55;

      let status = "";
      if (wouldReject1) status += " [FILTER 1 REJECTS]";
      if (wouldReject2) status += " [FILTER 2 REJECTS]";
      if (!status) status = " [OK]";

      console.log(`  Shot ${shot.shotNumber} (${shot.cameraOrientation}): sep=${shoulderSep.toFixed(3)}, diffX=${avgShoulderDiffX.toFixed(3)}, Z=${avgShoulderZ.toFixed(3)}${status}`);
    }
  }
  console.log("");
}

// Also check the false positives
console.log("\nFalse positives in 20190804_140617:");
const dir = '20190804_140617';
const poseData = JSON.parse(fs.readFileSync(`./test-data/${dir}/poses.json`, 'utf-8'));

const falsePositives = [
  { label: "FALSE POS 1", start: 294, end: 322 },
  { label: "FALSE POS 2", start: 432, end: 446 },
  { label: "FALSE POS 3", start: 550, end: 563 },
  { label: "FALSE POS 4", start: 665, end: 695 },
];

for (const fp of falsePositives) {
  let totalShoulderDiffX = 0;
  let totalShoulderZ = 0;
  let validSamples = 0;

  for (const frame of poseData.frames) {
    if (frame.frameIndex < fp.start || frame.frameIndex > fp.end) continue;
    if (!frame.landmarks) continue;

    const lm = frame.landmarks;
    const leftShoulder = lm[LEFT_SHOULDER];
    const rightShoulder = lm[RIGHT_SHOULDER];

    if (!leftShoulder || !rightShoulder) continue;
    if (leftShoulder.visibility < 0.3 || rightShoulder.visibility < 0.3) continue;

    totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
    totalShoulderZ += rightShoulder.z - leftShoulder.z;
    validSamples++;
  }

  if (validSamples > 0) {
    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgShoulderZ = totalShoulderZ / validSamples;
    const shoulderSep = Math.abs(avgShoulderDiffX);

    const wouldReject1 = shoulderSep > 0.12 && avgShoulderDiffX > 0;
    const wouldReject2 = avgShoulderZ > 0.55;

    let status = "";
    if (wouldReject1) status += " [FILTER 1 REJECTS]";
    if (wouldReject2) status += " [FILTER 2 REJECTS]";
    if (!status) status = " [NOT REJECTED - PROBLEM]";

    console.log(`  ${fp.label}: sep=${shoulderSep.toFixed(3)}, diffX=${avgShoulderDiffX.toFixed(3)}, Z=${avgShoulderZ.toFixed(3)}${status}`);
  }
}
