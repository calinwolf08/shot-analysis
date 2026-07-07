import * as fs from 'fs';

// Load labels for all videos
const testDirs = [
  'chris-5',
  '20201212_134104',
  '20190103_181419',
  '20190103_180930',
  '20190818_142631',
  '20190804_140617',
];

console.log("Shot Durations Across All Videos:");
console.log("==================================\n");

let minDuration = Infinity;
let minDurationInfo = "";

for (const dir of testDirs) {
  const labelsPath = `./test-data/${dir}/labels.json`;
  if (!fs.existsSync(labelsPath)) continue;

  const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
  console.log(`${labels.video}:`);

  for (const shot of labels.shots) {
    const duration = shot.endFrame - shot.startFrame;
    console.log(`  Shot ${shot.shotNumber}: ${duration} frames (${shot.startFrame}-${shot.endFrame})`);
    if (duration < minDuration) {
      minDuration = duration;
      minDurationInfo = `${labels.video} shot ${shot.shotNumber}`;
    }
  }
  console.log("");
}

console.log(`\nMinimum duration: ${minDuration} frames (${minDurationInfo})`);
