import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// LANDMARK indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

function analyzeDipPhase(start: number, end: number, label: string) {
  // Find the frame with highest wristY (lowest position = dip point)
  let dipFrame = -1;
  let dipY = -Infinity;

  for (let frameIdx = start; frameIdx <= end; frameIdx++) {
    const frame = poseData.frames.find((f: any) => f.frameIndex === frameIdx);
    if (!frame || !frame.landmarks) continue;

    const lm = frame.landmarks;
    const avgWristY = (lm[LEFT_WRIST].y + lm[RIGHT_WRIST].y) / 2;

    if (avgWristY > dipY) {
      dipY = avgWristY;
      dipFrame = frameIdx;
    }
  }

  // Calculate frames before and after dip
  const framesBefore = dipFrame - start;
  const framesAfter = end - dipFrame;

  console.log(`${label} (frames ${start}-${end}):`);
  console.log(`  Dip frame: ${dipFrame}, wristY: ${dipY.toFixed(3)}`);
  console.log(`  Frames before dip: ${framesBefore}`);
  console.log(`  Frames after dip: ${framesAfter}`);
  console.log(`  Ratio (before/after): ${(framesBefore / framesAfter).toFixed(2)}`);
  console.log("");
}

console.log("Dip Phase Analysis:");
console.log("===================\n");

// Use detected frame ranges
analyzeDipPhase(85, 103, "TRUE Shot 1 (detected)");
analyzeDipPhase(188, 218, "TRUE Shot 2 (detected)");
analyzeDipPhase(828, 857, "TRUE Shot 3 (detected)");
analyzeDipPhase(294, 322, "FALSE POS 1");
analyzeDipPhase(432, 446, "FALSE POS 2");
analyzeDipPhase(550, 563, "FALSE POS 3");
analyzeDipPhase(665, 695, "FALSE POS 4");
