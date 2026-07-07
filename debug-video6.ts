import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('test-data/20190804_140617/poses.json', 'utf8'));
const frames = poseData.frames;

// Extract frames around shot 1 start (expected 68)
const LANDMARK = { LEFT_WRIST: 15, RIGHT_WRIST: 16, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12 };

// Print frames 60-100 to see the pattern
console.log('Frame | avgWristY | rightWristY | velocity | wristAboveShoulder');
console.log('------|-----------|-------------|----------|-------------------');

let prevAvgY: number | null = null;
for (let i = 60; i <= 100; i++) {
  const frameObj = frames.find((f: any) => f.frameIndex === i);
  if (!frameObj || !frameObj.landmarks) continue;

  const lw = frameObj.landmarks[LANDMARK.LEFT_WRIST];
  const rw = frameObj.landmarks[LANDMARK.RIGHT_WRIST];
  const ls = frameObj.landmarks[LANDMARK.LEFT_SHOULDER];
  const rs = frameObj.landmarks[LANDMARK.RIGHT_SHOULDER];

  if (!lw || !rw || !ls || !rs) continue;

  const avgWristY = (lw.y + rw.y) / 2;
  const avgShoulderY = (ls.y + rs.y) / 2;
  const velocity = prevAvgY ? avgWristY - prevAvgY : 0;
  const wristAboveShoulder = avgWristY - avgShoulderY;

  console.log(`${i.toString().padStart(5)} | ${avgWristY.toFixed(3).padStart(9)} | ${rw.y.toFixed(3).padStart(11)} | ${velocity.toFixed(4).padStart(8)} | ${wristAboveShoulder.toFixed(3)}`);

  prevAvgY = avgWristY;
}
