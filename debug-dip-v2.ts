import fs from 'fs';

// Debug video 5 shot 2
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

console.log('=== Video 5 Shot 2 Dip Debug ===');
console.log('upwardStartFrame = 287, upwardStartY = 0.535');

const upwardStartFrame = 287;
const dipLookback = 18;
const minDipFrames = 5;
const minDipVelocity = 0.002;
const minDipYDrop = 0.02;

let prevY: number | null = null;
let velocities: Record<number, number> = {};

// First compute velocities
for (let i = 265; i <= 290; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  if (prevY !== null) {
    velocities[i] = avgWristY - prevY;
  }
  prevY = avgWristY;
}

// Now simulate the dip detection
console.log('\nLooking for dip (going backwards from 286):');
let dipStartFrame = upwardStartFrame;
let dipFrameCount = 0;
let dipStartY = 0.535;

for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - dipLookback); i--) {
  const velocity = velocities[i + 1] || 0;
  const frame = data.frames[i];
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const frameY = (lw.y + rw.y) / 2;

  const isDownward = velocity > minDipVelocity;
  console.log(`Frame ${i}: velocity[${i+1}]=${velocity.toFixed(4)}, Y=${frameY.toFixed(3)}, isDownward=${isDownward}, dipCount=${dipFrameCount}`);

  if (isDownward) {
    dipFrameCount++;
    dipStartFrame = i;
    dipStartY = frameY;
  } else if (dipFrameCount > 0) {
    const dipYRange = 0.535 - dipStartY;
    console.log(`  -> Motion stopped. dipCount=${dipFrameCount}, dipYRange=${dipYRange.toFixed(3)}`);
    if (dipFrameCount >= minDipFrames && dipYRange >= minDipYDrop) {
      console.log(`  -> Valid dip! Would return ${dipStartFrame}`);
    } else {
      console.log(`  -> Not enough dip (need ${minDipFrames} frames and ${minDipYDrop} Y drop)`);
    }
    break;
  }
}

console.log(`\nFinal: dipStartFrame=${dipStartFrame}, dipFrameCount=${dipFrameCount}`);
