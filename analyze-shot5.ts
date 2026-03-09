import fs from 'fs';
const data = JSON.parse(fs.readFileSync('test-data/20190818_142631/poses.json', 'utf-8'));

// Shot 1: frames 21-65 (around labeled 31-55)
console.log('=== SHOT 1 Analysis (labeled: 31-55, detected: 35-56) ===');
console.log('Examining frames 21-65:');
for (let i = 21; i <= 65; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15]; // left wrist
  const rw = frame.landmarks[16]; // right wrist
  const ls = frame.landmarks[11]; // left shoulder
  const rs = frame.landmarks[12]; // right shoulder
  const lh = frame.landmarks[23]; // left hip
  const rh = frame.landmarks[24]; // right hip
  const avgWristY = (lw.y + rw.y) / 2;
  const shoulderDiffX = rs.x - ls.x;
  const hipDiffX = rh.x - lh.x;
  const shoulderZDiff = rs.z - ls.z;
  const hipZDiff = rh.z - lh.z;
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}, shX=${shoulderDiffX.toFixed(3)}, hipX=${hipDiffX.toFixed(3)}, shZ=${shoulderZDiff.toFixed(3)}, hipZ=${hipZDiff.toFixed(3)}`);
}

console.log('');
console.log('=== SHOT 2 Analysis (labeled: 270-312, detected: 287-307) ===');
console.log('Examining frames 260-320:');
for (let i = 260; i <= 320; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const lw = frame.landmarks[15];
  const rw = frame.landmarks[16];
  const avgWristY = (lw.y + rw.y) / 2;
  console.log(`Frame ${i}: wristY=${avgWristY.toFixed(3)}`);
}

console.log('');
console.log('=== SHOT 3 Analysis (labeled: 554-578, detected: 555-573) ===');
console.log('Orientation check for frames 554-578:');
for (let i = 554; i <= 578; i++) {
  const frame = data.frames[i];
  if (!frame) continue;
  const ls = frame.landmarks[11];
  const rs = frame.landmarks[12];
  const lh = frame.landmarks[23];
  const rh = frame.landmarks[24];
  const shoulderDiffX = rs.x - ls.x;
  const hipDiffX = rh.x - lh.x;
  const shoulderZDiff = rs.z - ls.z;
  const hipZDiff = rh.z - lh.z;
  console.log(`Frame ${i}: shX=${shoulderDiffX.toFixed(3)}, hipX=${hipDiffX.toFixed(3)}, shZ=${shoulderZDiff.toFixed(3)}, hipZ=${hipZDiff.toFixed(3)}`);
}
