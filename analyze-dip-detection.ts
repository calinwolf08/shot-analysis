import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Look for the "stationary -> moving down -> moving up" pattern
// This would help detect the start of a "dip" shot
console.log('=== Analyzing velocity patterns before shot 2 (frames 230-290) ===\n');

let prevY: number | null = null;
const velocities: number[] = [];
const wristYs: number[] = [];

for (let i = 230; i <= 290; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;

  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  velocities.push(velocity);
  wristYs.push(avgWristY);
  prevY = avgWristY;
}

// Look for transition from "low velocity" to "consistent downward velocity"
// This would indicate the start of the dip
console.log('Looking for dip initiation point:');
console.log('Criteria: transition from |velocity| < 0.003 to consistent velocity > 0.003 (downward)\n');

let inLowVelocity = false;
let lowVelocityEnd = -1;
for (let i = 0; i < velocities.length; i++) {
  const frameNum = 230 + i;
  const v = velocities[i];
  const absV = Math.abs(v);

  if (absV < 0.003) {
    if (!inLowVelocity) {
      console.log(`Frame ${frameNum}: Entering low velocity zone`);
      inLowVelocity = true;
    }
    lowVelocityEnd = frameNum;
  } else if (inLowVelocity && v > 0.003) {
    console.log(`Frame ${frameNum}: Exiting low velocity -> downward motion starts (potential dip)`);
    console.log(`  Previous low velocity ended at frame ${lowVelocityEnd}`);
    inLowVelocity = false;
  } else if (v < -0.012) {
    console.log(`Frame ${frameNum}: Upward motion detected (threshold exceeded)`);
    break;
  }
}

// Now check shot 1 for similar pattern
console.log('\n=== Analyzing velocity patterns before shot 1 (frames 15-45) ===\n');
prevY = null;
const velocities1: number[] = [];

for (let i = 15; i <= 45; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;

  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  velocities1.push(velocity);
  console.log(`Frame ${i}: velocity=${velocity.toFixed(4)} ${Math.abs(velocity) < 0.003 ? '(low)' : velocity > 0.003 ? '(DOWN)' : velocity < -0.003 ? '(UP)' : ''}`);
  prevY = avgWristY;
}
