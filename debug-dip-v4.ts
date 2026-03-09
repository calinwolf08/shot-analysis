import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

console.log('=== Debug Revised Dip Detection for Shot 2 ===');

const upwardStartFrame = 287;
const dipLookback = 25;
const minDipDuration = 10;
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

// Find peak Y
let peakY = frameData[upwardStartFrame]?.avgWristY ?? 0;
let peakFrame = upwardStartFrame;
console.log(`Starting from upwardStartFrame=${upwardStartFrame}, Y=${peakY.toFixed(3)}`);

for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - dipLookback); i--) {
  const frame = frameData[i];
  if (!frame) {
    console.log(`Frame ${i}: no data`);
    break;
  }
  if (frame.avgWristY > peakY) {
    console.log(`Frame ${i}: Y=${frame.avgWristY.toFixed(3)} > peakY=${peakY.toFixed(3)} -> new peak`);
    peakY = frame.avgWristY;
    peakFrame = i;
  } else {
    console.log(`Frame ${i}: Y=${frame.avgWristY.toFixed(3)} <= peakY=${peakY.toFixed(3)}`);
  }
}

console.log(`\nFound peakY=${peakY.toFixed(3)} at frame ${peakFrame}`);

// Look back from peak
console.log(`\nLooking back from peak (frame ${peakFrame}) to find dip start:`);
let dipStartFrame = peakFrame;
let dipStartY = peakY;

for (let i = peakFrame - 1; i >= Math.max(0, upwardStartFrame - dipLookback); i--) {
  const frame = frameData[i];
  if (!frame) break;

  const threshold = dipStartY - 0.005;
  const isLower = frame.avgWristY < threshold;
  console.log(`Frame ${i}: Y=${frame.avgWristY.toFixed(3)}, dipStartY=${dipStartY.toFixed(3)}, threshold=${threshold.toFixed(3)}, isLower=${isLower}`);

  if (isLower) {
    dipStartY = frame.avgWristY;
    dipStartFrame = i;
  } else {
    console.log(`  -> Break - Y not significantly lower`);
    break;
  }
}

const dipMagnitude = peakY - dipStartY;
const dipDuration = peakFrame - dipStartFrame;

console.log(`\nFinal: dipStartFrame=${dipStartFrame}, dipStartY=${dipStartY.toFixed(3)}`);
console.log(`dipMagnitude = ${dipMagnitude.toFixed(3)} (need >= ${minDipMagnitude})`);
console.log(`dipDuration = ${dipDuration} (need >= ${minDipDuration})`);
console.log(`Valid dip: ${dipDuration >= minDipDuration && dipMagnitude >= minDipMagnitude}`);
