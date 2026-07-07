import * as fs from 'fs';

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

const testDirs = [
  'chris-5',
  '20201212_134104',
  '20190103_181419',
  '20190103_180930',
  '20190818_142631',
];

console.log("Z-depth (shoulderZ) for all labeled shots:");
console.log("===========================================\n");

for (const dir of testDirs) {
  const posesPath = `./test-data/${dir}/poses.json`;
  if (!fs.existsSync(posesPath)) continue;

  const poseData = JSON.parse(fs.readFileSync(posesPath, 'utf-8'));
  const labels = JSON.parse(fs.readFileSync(`./test-data/${dir}/labels.json`, 'utf-8'));

  console.log(`${labels.video}:`);

  for (const shot of labels.shots) {
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

      totalShoulderZ += rightShoulder.z - leftShoulder.z;
      validSamples++;
    }

    if (validSamples > 0) {
      const avgShoulderZ = totalShoulderZ / validSamples;
      console.log(`  Shot ${shot.shotNumber} (${shot.cameraOrientation}): Z = ${avgShoulderZ.toFixed(3)}`);
    }
  }
  console.log("");
}
