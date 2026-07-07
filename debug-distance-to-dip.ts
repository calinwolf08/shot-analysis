import * as fs from 'fs';

const RIGHT_WRIST = 16;

// For each video, check the distance from dip point to upward start
const testCases = [
  { video: 'chris-5', shots: [{start: 55, end: 85}] },
  { video: '20201212_134104', shots: [{start: 75, end: 112}] },
  { video: '20190103_181419', shots: [{start: 11, end: 40}, {start: 121, end: 148}] },
  { video: '20190103_180930', shots: [{start: 81, end: 111}, {start: 243, end: 270}, {start: 397, end: 418}] },
  { video: '20190818_142631', shots: [{start: 32, end: 58}, {start: 287, end: 311}, {start: 556, end: 578}] },
  { video: '20190804_140617', shots: [{start: 68, end: 106}, {start: 196, end: 223}, {start: 838, end: 862}] },
];

const VELOCITY_THRESHOLD = 0.012;

console.log("Distance from dip point to upward motion start:");
console.log("================================================\n");

for (const tc of testCases) {
  const posesPath = `./test-data/${tc.video}/poses.json`;
  if (!fs.existsSync(posesPath)) continue;

  const poseData = JSON.parse(fs.readFileSync(posesPath, 'utf-8'));

  console.log(`${tc.video}:`);

  for (let shotNum = 0; shotNum < tc.shots.length; shotNum++) {
    const shot = tc.shots[shotNum];

    // Find dip point (max wristY) and first sustained upward frame
    let dipFrame = -1;
    let dipY = -Infinity;
    let upwardStartFrame = -1;
    let upwardCount = 0;
    let prevY: number | null = null;

    for (let frameIdx = shot!.start - 10; frameIdx <= shot!.end; frameIdx++) {
      const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
      if (!frame || !frame.landmarks) continue;

      const wristY = frame.landmarks[RIGHT_WRIST].y;

      // Track dip (highest Y up to midpoint of shot)
      if (frameIdx <= (shot!.start + shot!.end) / 2) {
        if (wristY > dipY) {
          dipY = wristY;
          dipFrame = frameIdx;
        }
      }

      // Track upward start
      if (prevY !== null) {
        const velocity = wristY - prevY;
        const isUpward = velocity < -VELOCITY_THRESHOLD;

        if (isUpward) {
          upwardCount++;
          if (upwardCount === 3 && upwardStartFrame === -1) {
            upwardStartFrame = frameIdx - 2;
          }
        } else {
          upwardCount = 0;
        }
      }

      prevY = wristY;
    }

    const distanceToDip = upwardStartFrame > 0 ? upwardStartFrame - dipFrame : -1;
    console.log(`  Shot ${shotNum + 1}: labeled ${shot!.start}-${shot!.end}, dipFrame=${dipFrame}, upwardStart=${upwardStartFrame}, distanceToDip=${distanceToDip}`);
  }
  console.log("");
}
