import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// LANDMARK indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

// Helper to get frame data
function getFrameData(frameIndex: number) {
  const frame = poseData.frames.find((f: any) => f.frameIndex === frameIndex);
  if (!frame || !frame.landmarks) return null;
  const lm = frame.landmarks;
  const leftWrist = lm[LEFT_WRIST];
  const rightWrist = lm[RIGHT_WRIST];
  const leftShoulder = lm[LEFT_SHOULDER];
  const rightShoulder = lm[RIGHT_SHOULDER];

  const avgWristY = (leftWrist.y + rightWrist.y) / 2;
  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const wristShoulderDelta = avgWristY - avgShoulderY; // negative = wrist above shoulder

  return { avgWristY, avgShoulderY, wristShoulderDelta };
}

// Check start frames
const shots = [
  { label: "TRUE Shot 1", detectedStart: 85, labeledStart: 68 },
  { label: "TRUE Shot 2", detectedStart: 188, labeledStart: 196 },
  { label: "FALSE POS 1", detectedStart: 294, labeledStart: null },
  { label: "FALSE POS 2", detectedStart: 432, labeledStart: null },
  { label: "FALSE POS 3", detectedStart: 550, labeledStart: null },
  { label: "FALSE POS 4", detectedStart: 663, labeledStart: null },
  { label: "TRUE Shot 3", detectedStart: 828, labeledStart: 838 },
];

console.log("Start Frame Analysis:");
console.log("====================\n");

for (const shot of shots) {
  const data = getFrameData(shot.detectedStart);
  if (data) {
    console.log(`${shot.label} (detected frame ${shot.detectedStart}):`);
    console.log(`  avgWristY: ${data.avgWristY.toFixed(3)}`);
    console.log(`  avgShoulderY: ${data.avgShoulderY.toFixed(3)}`);
    console.log(`  wristShoulderDelta: ${data.wristShoulderDelta.toFixed(3)}`);
    console.log(`  (negative delta = wrist ABOVE shoulder)`);
    if (data.wristShoulderDelta < -0.05) {
      console.log(`  ** WRIST ABOVE SHOULDER AT START - should be filtered! **`);
    }
    console.log("");
  }
}

// Now check the range for each detected shot to understand the motion
console.log("\nMotion Analysis (Y range from start to peak):");
console.log("=============================================\n");

const detectedShotsWithRanges = [
  { label: "TRUE Shot 1", start: 85, end: 103 },
  { label: "TRUE Shot 2", start: 188, end: 218 },
  { label: "FALSE POS 1", start: 294, end: 322 },
  { label: "FALSE POS 2", start: 432, end: 446 },
  { label: "FALSE POS 3", start: 550, end: 563 },
  { label: "FALSE POS 4", start: 663, end: 695 },
  { label: "TRUE Shot 3", start: 828, end: 857 },
];

for (const shot of detectedShotsWithRanges) {
  let minWristY = Infinity;
  let maxWristY = -Infinity;
  let peakFrame = -1;
  let startData = getFrameData(shot.start);

  for (let i = shot.start; i <= shot.end; i++) {
    const data = getFrameData(i);
    if (data) {
      if (data.avgWristY < minWristY) {
        minWristY = data.avgWristY;
        peakFrame = i;
      }
      if (data.avgWristY > maxWristY) {
        maxWristY = data.avgWristY;
      }
    }
  }

  const yRange = maxWristY - minWristY;
  console.log(`${shot.label} (frames ${shot.start}-${shot.end}):`);
  console.log(`  Start wristY: ${startData?.avgWristY.toFixed(3)}`);
  console.log(`  Start wrist-shoulder delta: ${startData?.wristShoulderDelta.toFixed(3)}`);
  console.log(`  Peak wristY: ${minWristY.toFixed(3)} at frame ${peakFrame}`);
  console.log(`  Y range: ${yRange.toFixed(3)}`);
  console.log("");
}
