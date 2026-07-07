import * as fs from 'fs';

// Check for gaps in upward motion during labeled shots
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

const VELOCITY_THRESHOLD = -0.012;
const MAX_VALID_VELOCITY = 0.1;

function analyzeUpwardGaps(dir: string) {
  const posesPath = `./test-data/${dir}/poses.json`;
  if (!fs.existsSync(posesPath)) return;

  const poseData = JSON.parse(fs.readFileSync(posesPath, 'utf-8'));
  const labels = JSON.parse(fs.readFileSync(`./test-data/${dir}/labels.json`, 'utf-8'));

  console.log(`\n${labels.video}:`);

  for (const shot of labels.shots) {
    let prevWristY: number | null = null;
    let prevFrameIdx: number | null = null;
    let gapFrames = 0;
    let maxGap = 0;

    for (const frame of poseData.frames) {
      if (frame.frameIndex < shot.startFrame || frame.frameIndex > shot.endFrame) continue;
      if (!frame.landmarks) {
        prevWristY = null;
        prevFrameIdx = null;
        gapFrames = 0;
        continue;
      }

      const lm = frame.landmarks;
      const avgWristY = (lm[LEFT_WRIST].y + lm[RIGHT_WRIST].y) / 2;

      if (prevWristY !== null && prevFrameIdx !== null) {
        let velocity = avgWristY - prevWristY;

        // Clamp invalid velocities
        if (Math.abs(velocity) > MAX_VALID_VELOCITY) {
          velocity = 0;
        }

        const isUpward = velocity < VELOCITY_THRESHOLD;

        if (!isUpward) {
          gapFrames++;
        } else {
          if (gapFrames > maxGap) {
            maxGap = gapFrames;
          }
          gapFrames = 0;
        }
      }

      prevWristY = avgWristY;
      prevFrameIdx = frame.frameIndex;
    }

    console.log(`  Shot ${shot.shotNumber}: max gap in upward motion = ${maxGap} frames`);
  }
}

console.log("Max gaps in upward motion during labeled shots:");
console.log("================================================");

for (const dir of testDirs) {
  analyzeUpwardGaps(dir);
}
