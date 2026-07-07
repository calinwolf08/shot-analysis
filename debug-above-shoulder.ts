import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// LANDMARK indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

const ABOVE_SHOULDER_THRESHOLD = -0.05;

function analyzeAboveShoulder(start: number, end: number, label: string) {
  let aboveShoulderFrames = 0;
  let totalFrames = 0;
  let consecutiveAbove = 0;
  let maxConsecutiveAbove = 0;

  for (let frameIdx = start; frameIdx <= end; frameIdx++) {
    const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
    if (!frame || !frame.landmarks) continue;

    const lm = frame.landmarks;
    const avgWristY = (lm[LEFT_WRIST].y + lm[RIGHT_WRIST].y) / 2;
    const avgShoulderY = (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2;
    const delta = avgWristY - avgShoulderY;

    totalFrames++;

    if (delta < ABOVE_SHOULDER_THRESHOLD) {
      aboveShoulderFrames++;
      consecutiveAbove++;
      maxConsecutiveAbove = Math.max(maxConsecutiveAbove, consecutiveAbove);
    } else {
      consecutiveAbove = 0;
    }
  }

  console.log(`${label} (frames ${start}-${end}):`);
  console.log(`  Total frames: ${totalFrames}`);
  console.log(`  Frames with wrist above shoulder: ${aboveShoulderFrames}`);
  console.log(`  Max consecutive frames above shoulder: ${maxConsecutiveAbove}`);
  console.log(`  Percentage above shoulder: ${(aboveShoulderFrames / totalFrames * 100).toFixed(1)}%`);
  console.log("");
}

console.log("Wrist Above Shoulder Analysis:");
console.log("==============================\n");

analyzeAboveShoulder(68, 106, "TRUE Shot 1 (labeled)");
analyzeAboveShoulder(85, 103, "TRUE Shot 1 (detected)");
analyzeAboveShoulder(196, 223, "TRUE Shot 2 (labeled)");
analyzeAboveShoulder(188, 218, "TRUE Shot 2 (detected)");
analyzeAboveShoulder(838, 862, "TRUE Shot 3 (labeled)");
analyzeAboveShoulder(828, 857, "TRUE Shot 3 (detected)");
analyzeAboveShoulder(294, 322, "FALSE POS 1");
analyzeAboveShoulder(432, 446, "FALSE POS 2");
analyzeAboveShoulder(550, 563, "FALSE POS 3");
analyzeAboveShoulder(663, 695, "FALSE POS 4 (original)");
analyzeAboveShoulder(665, 695, "FALSE POS 4 (after fix)");
