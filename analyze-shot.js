const fs = require('fs');
const poses = JSON.parse(fs.readFileSync('test-data/20190804_140654/poses.json'));
const labels = JSON.parse(fs.readFileSync('test-data/20190804_140654/labels.json'));

const WRIST_IDX = 16; // RIGHT_WRIST
const shotNum = parseInt(process.argv[2] || '1') - 1;
const shot = labels.shots[shotNum];

console.log('Shot:', shotNum + 1);
console.log('Labels:', JSON.stringify(shot, null, 2));
console.log('');

// Get right wrist Y for frames around the shot
const startFrame = shot.startFrame - 15;
const endFrame = shot.endFrame + 5;

console.log('Frame | RightWristY | Velocity | Note');
console.log('------|-------------|----------|------');
let prevY = null;
for (const frame of poses.frames) {
  if (frame.frameIndex >= startFrame && frame.frameIndex <= endFrame) {
    const wrist = frame.landmarks?.[WRIST_IDX];
    const wristY = wrist?.y?.toFixed(4) || 'N/A';
    const vel = prevY !== null ? ((wrist?.y - prevY) * 1000).toFixed(1) : '-';

    let note = '';
    if (frame.frameIndex === shot.startFrame) note = '← SHOT START';
    if (frame.frameIndex === shot.endFrame) note = '← SHOT END';
    if (frame.frameIndex === shot.legs_start_bending) note = '← legs_start_bending';
    if (frame.frameIndex === shot.ball_low_point) note = '← ball_low_point';
    if (frame.frameIndex === shot.set_point) note = '← set_point';
    if (frame.frameIndex === shot.release) note = '← release';

    console.log(`  ${String(frame.frameIndex).padStart(3)} | ${String(wristY).padStart(11)} | ${String(vel).padStart(8)} | ${note}`);
    prevY = wrist?.y;
  }
}
