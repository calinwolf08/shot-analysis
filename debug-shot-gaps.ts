import * as fs from 'fs';

// Load labels for all videos to see typical shot gaps
const testDirs = [
  'chris-5',
  '20201212_134104',
  '20190103_181419',
  '20190103_180930',
  '20190818_142631',
  '20190804_140617',
];

console.log("Shot Gap Analysis Across Videos:");
console.log("=================================\n");

for (const dir of testDirs) {
  const labelsPath = `./test-data/${dir}/labels.json`;
  if (!fs.existsSync(labelsPath)) continue;

  const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
  console.log(`${labels.video}:`);

  for (let i = 0; i < labels.shots.length; i++) {
    const shot = labels.shots[i];
    console.log(`  Shot ${shot.shotNumber}: frames ${shot.startFrame}-${shot.endFrame} (duration: ${shot.endFrame - shot.startFrame})`);

    if (i > 0) {
      const prevShot = labels.shots[i - 1];
      const gap = shot.startFrame - prevShot.endFrame;
      console.log(`    Gap from shot ${prevShot.shotNumber}: ${gap} frames`);
    }
  }
  console.log("");
}
