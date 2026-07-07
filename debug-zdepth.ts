import * as fs from 'fs';

// Check Z-depth for shots across videos
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

// Check 20190103_180930 shots (which have high shoulderSep but are true shots)
const dir1 = '20190103_180930';
const poseData1 = JSON.parse(fs.readFileSync(`./test-data/${dir1}/poses.json`, 'utf-8'));
const labels1 = JSON.parse(fs.readFileSync(`./test-data/${dir1}/labels.json`, 'utf-8'));

console.log("20190103_180930 - True shots with high shoulderSep:");
console.log("====================================================\n");

for (const shot of labels1.shots) {
  let totalShoulderDiffX = 0;
  let totalShoulderZ = 0;
  let validSamples = 0;

  for (const frame of poseData1.frames) {
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
    const isFrontView = avgShoulderDiffX < 0;
    console.log(`  Shot ${shot.shotNumber} (${shot.cameraOrientation}):`);
    console.log(`    shoulderSep: ${shoulderSep.toFixed(4)}`);
    console.log(`    shoulderDiffX: ${avgShoulderDiffX.toFixed(4)} (${isFrontView ? 'FRONT' : 'BACK'} view)`);
    console.log(`    shoulderZ: ${avgShoulderZ.toFixed(4)}`);
    console.log("");
  }
}

// Check 20190804_140617 false positives
const dir2 = '20190804_140617';
const poseData2 = JSON.parse(fs.readFileSync(`./test-data/${dir2}/poses.json`, 'utf-8'));

console.log("\n20190804_140617 - False positives:");
console.log("===================================\n");

const falsePositives = [
  { label: "FALSE POS 1", start: 294, end: 322 },
  { label: "FALSE POS 2", start: 432, end: 446 },
  { label: "FALSE POS 3", start: 550, end: 563 },
  { label: "FALSE POS 4", start: 663, end: 695 },
];

for (const fp of falsePositives) {
  let totalShoulderDiffX = 0;
  let totalShoulderZ = 0;
  let validSamples = 0;

  for (const frame of poseData2.frames) {
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
    const isFrontView = avgShoulderDiffX < 0;
    console.log(`  ${fp.label}:`);
    console.log(`    shoulderSep: ${shoulderSep.toFixed(4)}`);
    console.log(`    shoulderDiffX: ${avgShoulderDiffX.toFixed(4)} (${isFrontView ? 'FRONT' : 'BACK'} view)`);
    console.log(`    shoulderZ: ${avgShoulderZ.toFixed(4)}`);
    console.log("");
  }
}
