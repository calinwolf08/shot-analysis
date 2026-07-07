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

  return {
    avgWristY: (leftWrist.y + rightWrist.y) / 2,
    avgShoulderY: (leftShoulder.y + rightShoulder.y) / 2,
    rightWristY: rightWrist.y,
  };
}

// Analyze each shot
const detectedShots = [
  { label: "TRUE Shot 1", start: 85, end: 103, labelStart: 68, labelEnd: 106 },
  { label: "TRUE Shot 2", start: 188, end: 218, labelStart: 196, labelEnd: 223 },
  { label: "FALSE POS 1", start: 294, end: 322, labelStart: null, labelEnd: null },
  { label: "FALSE POS 2", start: 432, end: 446, labelStart: null, labelEnd: null },
  { label: "FALSE POS 3", start: 550, end: 563, labelStart: null, labelEnd: null },
  { label: "FALSE POS 4", start: 663, end: 695, labelStart: null, labelEnd: null },
  { label: "TRUE Shot 3", start: 828, end: 857, labelStart: 838, labelEnd: 862 },
];

console.log("Detailed Shot Metrics:");
console.log("======================\n");

for (const shot of detectedShots) {
  let minWristY = Infinity;
  let maxWristY = -Infinity;
  let peakFrame = -1;
  let velocities: number[] = [];
  let prevWristY: number | null = null;

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
      if (prevWristY !== null) {
        velocities.push(data.avgWristY - prevWristY);
      }
      prevWristY = data.avgWristY;
    }
  }

  const duration = shot.end - shot.start;
  const yRange = maxWristY - minWristY;
  const avgUpwardVelocity = velocities
    .filter(v => v < 0)
    .reduce((a, b) => a + b, 0) / velocities.filter(v => v < 0).length;
  const maxUpwardVelocity = Math.min(...velocities);

  // Check if the detected range overlaps with labeled range
  let overlap = "N/A";
  if (shot.labelStart !== null && shot.labelEnd !== null) {
    const overlapStart = Math.max(shot.start, shot.labelStart);
    const overlapEnd = Math.min(shot.end, shot.labelEnd);
    if (overlapStart <= overlapEnd) {
      overlap = `${overlapEnd - overlapStart + 1} frames`;
    } else {
      overlap = "NONE";
    }
  }

  console.log(`${shot.label} (detected ${shot.start}-${shot.end}):`);
  console.log(`  Duration: ${duration} frames`);
  console.log(`  Y range: ${yRange.toFixed(4)} (${(yRange * 100).toFixed(1)}% of frame height)`);
  console.log(`  Peak wristY: ${minWristY.toFixed(4)} at frame ${peakFrame}`);
  console.log(`  Avg upward velocity: ${avgUpwardVelocity.toFixed(5)}`);
  console.log(`  Max upward velocity: ${maxUpwardVelocity.toFixed(5)}`);
  if (shot.labelStart !== null) {
    console.log(`  Labeled: ${shot.labelStart}-${shot.labelEnd}`);
    console.log(`  Overlap: ${overlap}`);
  }
  console.log("");
}

// Look at what metrics could distinguish them
console.log("Summary - Distinguishing Metrics:");
console.log("==================================\n");

console.log("TRUE shots: duration=18-30, yRange=0.28-0.34, peak=0.15-0.23");
console.log("FALSE positives: duration=14-32, yRange=0.30-0.38, peak=0.19-0.28");
console.log("");
console.log("Peak wristY (lower = higher position):");
console.log("  TRUE: 0.147, 0.213, 0.227");
console.log("  FALSE: 0.191, 0.269, 0.280, 0.212");
console.log("");
console.log("Observation: TRUE shot 1&3 have peak ~0.21-0.23, FALSE POS 2&3 have higher peak ~0.27-0.28");
console.log("But TRUE shot 2 has LOWEST peak (0.147) and FALSE POS 1&4 are in same range as TRUE shots");
