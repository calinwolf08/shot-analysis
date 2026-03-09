import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

console.log('=== Debug Dip Detection for Shot 2 ===');

const upwardStartFrame = 287;
const dipLookback = 20;
const minDipDuration = 5;
const minDipMagnitude = 0.03;

// Calculate wrist Y for all frames
const frameData: { avgWristY: number }[] = [];
for (let i = 260; i <= 290; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  frameData[i] = { avgWristY };
}

const upwardY = frameData[upwardStartFrame]?.avgWristY ?? 0;
console.log(`upwardStartFrame = ${upwardStartFrame}, upwardY = ${upwardY.toFixed(3)}`);

let dipStartFrame = upwardStartFrame;
let dipFrameCount = 0;
let lowestY = upwardY;

for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - dipLookback); i--) {
  const frame = frameData[i];
  if (!frame) {
    console.log(`Frame ${i}: no data`);
    continue;
  }

  const condition = frame.avgWristY > lowestY - 0.01;
  console.log(`Frame ${i}: avgWristY=${frame.avgWristY.toFixed(3)}, lowestY=${lowestY.toFixed(3)}, lowestY-0.01=${(lowestY-0.01).toFixed(3)}, condition=${condition}`);

  if (condition) {
    lowestY = Math.max(lowestY, frame.avgWristY);
    dipFrameCount++;
    dipStartFrame = i;
  } else {
    console.log(`  -> Breaking - wrist started rising`);
    break;
  }
}

const dipMagnitude = lowestY - (frameData[dipStartFrame]?.avgWristY ?? lowestY);
console.log(`\nFinal: dipStartFrame=${dipStartFrame}, dipFrameCount=${dipFrameCount}, lowestY=${lowestY.toFixed(3)}`);
console.log(`dipMagnitude = ${dipMagnitude.toFixed(3)} (need >= ${minDipMagnitude})`);
console.log(`Valid dip: ${dipFrameCount >= minDipDuration && dipMagnitude >= minDipMagnitude}`);
