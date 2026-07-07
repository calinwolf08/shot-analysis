import * as fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('./test-data/20201212_134104/poses.json', 'utf-8'));
const RIGHT_WRIST = 16;

console.log('Frame | rightWristY');
for (let i = 80; i <= 90; i++) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === i);
  if (frame && frame.landmarks) {
    console.log(`${i}     | ${frame.landmarks[RIGHT_WRIST].y.toFixed(3)}`);
  }
}
