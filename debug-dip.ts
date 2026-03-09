import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Simulate the findMotionStart logic for shot 2
// upwardStartFrame would be around 287 based on the test results

console.log('=== Debug Dip Detection for Shot 2 (video 5) ===');
console.log('upwardStartFrame assumed to be 287');

const upwardStartFrame = 287;
const dipLookback = 20;
const dipVelocityThreshold = 0.003;

let prevY: number | null = null;

// First, show the raw velocity data from frame 265 to 290
console.log('\nRaw velocity data (265-290):');
for (let i = 265; i <= 290; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  const isDip = velocity > dipVelocityThreshold ? ' <-- DIP' : '';
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, velocity=${velocity.toFixed(4)}${isDip}`);
  prevY = avgWristY;
}

// Now simulate the dip detection logic going backwards from 287
console.log('\n--- Dip Detection Logic (going backwards from 287) ---');
let dipStartFrame = upwardStartFrame;
let inDipPhase = false;
let dipFrameCount = 0;

// Precompute velocities
const velocities: number[] = [];
prevY = null;
for (let i = 260; i <= 290; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  velocities[i] = velocity;
  prevY = avgWristY;
}

for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - dipLookback); i--) {
  const velocity = velocities[i + 1] || 0;

  console.log(`Frame ${i}: velocity[${i+1}]=${velocity.toFixed(4)}, inDip=${inDipPhase}, count=${dipFrameCount}`);

  if (velocity > dipVelocityThreshold) {
    if (!inDipPhase) {
      console.log(`  -> Starting dip phase`);
      inDipPhase = true;
    }
    dipFrameCount++;
    dipStartFrame = i;
  } else if (inDipPhase) {
    console.log(`  -> Dip phase ended, count=${dipFrameCount}`);
    if (dipFrameCount >= 3) {
      console.log(`  -> Valid dip! Using dipStartFrame=${dipStartFrame}`);
      break;
    } else {
      console.log(`  -> Too short, resetting`);
      inDipPhase = false;
      dipFrameCount = 0;
      dipStartFrame = upwardStartFrame;
    }
  }
}

console.log(`\nFinal result: dipStartFrame=${dipStartFrame}, dipFrameCount=${dipFrameCount}`);
