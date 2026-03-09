import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Check if there's a dip (downward motion) before the upward shot
console.log('=== SHOT 2: Full Motion Analysis (240-290) ===');
console.log('Looking for dip (downward) then upward pattern:\n');

let prevY: number | null = null;
let prevVelocity: number | null = null;
let dipStart: number | null = null;
let dipEnd: number | null = null;

for (let i = 240; i <= 290; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }

  // Detect transition from upward to downward (start of dip)
  if (prevVelocity !== null && prevVelocity <= 0 && velocity > 0.003) {
    console.log(`  -> DIP START CANDIDATE at frame ${i-1}`);
    if (dipStart === null) dipStart = i - 1;
  }

  // Detect transition from downward to upward (end of dip, start of shot)
  if (prevVelocity !== null && prevVelocity > 0 && velocity < -0.003) {
    console.log(`  -> DIP END / SHOT START CANDIDATE at frame ${i}`);
    if (dipEnd === null && dipStart !== null) dipEnd = i;
  }

  const marker = i === 270 ? ' <-- LABELED START' : (i === 287 ? ' <-- DETECTED START' : '');
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, velocity=${velocity.toFixed(4)}${marker}`);
  prevY = avgWristY;
  prevVelocity = velocity;
}

console.log(`\nDip analysis: start=${dipStart}, end=${dipEnd}`);

// Now look at what's happening in shot 1 around frame 31
console.log('\n=== SHOT 1: Motion before labeled start (20-45) ===');
prevY = null;
for (let i = 20; i <= 45; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  const marker = i === 31 ? ' <-- LABELED START' : (i === 35 ? ' <-- DETECTED START' : '');
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, velocity=${velocity.toFixed(4)}${marker}`);
  prevY = avgWristY;
}
