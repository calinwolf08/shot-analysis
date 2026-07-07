import * as fs from 'fs';

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

// Check true shots in 20190804_140617
const dir = '20190804_140617';
const poseData = JSON.parse(fs.readFileSync(`./test-data/${dir}/poses.json`, 'utf-8'));
const labels = JSON.parse(fs.readFileSync(`./test-data/${dir}/labels.json`, 'utf-8'));

console.log("20190804_140617 - True shots:");
console.log("==============================\n");

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
    const isFrontView = avgShoulderDiffX < 0;
    console.log(`  Shot ${shot.shotNumber} (${shot.cameraOrientation}):`);
    console.log(`    shoulderSep: ${shoulderSep.toFixed(4)}`);
    console.log(`    shoulderDiffX: ${avgShoulderDiffX.toFixed(4)} (${isFrontView ? 'FRONT' : 'BACK'} view)`);
    console.log(`    shoulderZ: ${avgShoulderZ.toFixed(4)}`);
    console.log("");
  }
}
