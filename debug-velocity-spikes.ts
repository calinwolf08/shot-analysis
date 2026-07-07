import * as fs from 'fs';

// Check for large velocity spikes across all videos
const testDirs = [
  'chris-5',
  '20201212_134104',
  '20190103_181419',
  '20190103_180930',
  '20190818_142631',
  '20190804_140617',
];

const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

const MAX_VELOCITY = 0.1;

for (const dir of testDirs) {
  const posesPath = `./test-data/${dir}/poses.json`;
  if (!fs.existsSync(posesPath)) continue;

  const poseData = JSON.parse(fs.readFileSync(posesPath, 'utf-8'));
  const labels = JSON.parse(fs.readFileSync(`./test-data/${dir}/labels.json`, 'utf-8'));

  console.log(`\n${labels.video}:`);

  let prevWristY: number | null = null;
  let prevFrameIdx: number | null = null;
  let largeSpikes: {frame: number, velocity: number, inLabeledShot: boolean}[] = [];

  for (const frame of poseData.frames) {
    if (!frame.landmarks) {
      prevWristY = null;
      prevFrameIdx = null;
      continue;
    }

    const lm = frame.landmarks;
    const avgWristY = (lm[LEFT_WRIST].y + lm[RIGHT_WRIST].y) / 2;

    if (prevWristY !== null && prevFrameIdx !== null && frame.frameIndex === prevFrameIdx + 1) {
      const velocity = avgWristY - prevWristY;
      if (Math.abs(velocity) > MAX_VELOCITY) {
        // Check if this frame is in a labeled shot
        const inLabeledShot = labels.shots.some((s: any) =>
          frame.frameIndex >= s.startFrame && frame.frameIndex <= s.endFrame
        );
        largeSpikes.push({
          frame: frame.frameIndex,
          velocity: velocity,
          inLabeledShot
        });
      }
    }

    prevWristY = avgWristY;
    prevFrameIdx = frame.frameIndex;
  }

  if (largeSpikes.length === 0) {
    console.log(`  No velocity spikes > ${MAX_VELOCITY}`);
  } else {
    for (const spike of largeSpikes) {
      console.log(`  Frame ${spike.frame}: velocity=${spike.velocity.toFixed(4)} (${spike.inLabeledShot ? 'IN labeled shot' : 'NOT in labeled shot'})`);
    }
  }
}
