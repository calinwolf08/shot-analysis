import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

console.log('=== SHOT 2 Velocity Analysis (labeled: 270-312, detected: 287-307) ===');
console.log('Examining frames 260-320 with velocity:');
let prevY: number | null = null;
for (let i = 260; i <= 320; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  const marker = velocity < -0.012 ? ' <-- UPWARD' : (i === 270 ? ' <-- LABELED START' : '');
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, velocity=${velocity.toFixed(4)}${marker}`);
  prevY = avgWristY;
}

// Also analyze frames leading up to 270 to see what motion precedes
console.log('\n=== Earlier Motion Analysis (250-275) ===');
prevY = null;
for (let i = 250; i <= 275; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const ls = frame.landmarks[11];
  const rs = frame.landmarks[12];
  const avgWristY = (lw.y + rw.y) / 2;
  const avgShoulderY = (ls.y + rs.y) / 2;
  let velocity = 0;
  if (prevY !== null) {
    velocity = avgWristY - prevY;
  }
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, shoulderY=${avgShoulderY.toFixed(3)}, velocity=${velocity.toFixed(4)}`);
  prevY = avgWristY;
}
