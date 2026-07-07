import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// LANDMARK indices
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

// Helper to get frame data
function analyzeFrameRange(startFrame: number, endFrame: number) {
  let totalShoulderDiffX = 0;
  let totalHipDiffX = 0;
  let totalShoulderZ = 0;
  let totalHipZ = 0;
  let validSamples = 0;

  for (const frame of poseData.frames) {
    if (frame.frameIndex < startFrame || frame.frameIndex > endFrame) continue;
    if (!frame.landmarks) continue;

    const lm = frame.landmarks;
    const leftShoulder = lm[LEFT_SHOULDER];
    const rightShoulder = lm[RIGHT_SHOULDER];
    const leftHip = lm[LEFT_HIP];
    const rightHip = lm[RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) continue;
    if (leftShoulder.visibility < 0.3 || rightShoulder.visibility < 0.3) continue;

    totalShoulderDiffX += rightShoulder.x - leftShoulder.x;
    totalHipDiffX += rightHip.x - leftHip.x;
    totalShoulderZ += rightShoulder.z - leftShoulder.z;
    totalHipZ += rightHip.z - leftHip.z;
    validSamples++;
  }

  if (validSamples === 0) return null;

  return {
    shoulderDiffX: totalShoulderDiffX / validSamples,
    hipDiffX: totalHipDiffX / validSamples,
    shoulderZ: totalShoulderZ / validSamples,
    hipZ: totalHipZ / validSamples,
    shoulderSep: Math.abs(totalShoulderDiffX / validSamples),
    hipSep: Math.abs(totalHipDiffX / validSamples),
    zDiff: totalShoulderZ / validSamples,
    samples: validSamples,
  };
}

const shots = [
  { label: "TRUE Shot 1", start: 68, end: 106 },
  { label: "TRUE Shot 2", start: 196, end: 223 },
  { label: "FALSE POS 1", start: 294, end: 322 },
  { label: "FALSE POS 2", start: 432, end: 446 },
  { label: "FALSE POS 3", start: 550, end: 563 },
  { label: "FALSE POS 4", start: 663, end: 695 },
  { label: "TRUE Shot 3", start: 838, end: 862 },
];

console.log("Orientation Analysis:");
console.log("=====================\n");

for (const shot of shots) {
  const data = analyzeFrameRange(shot.start, shot.end);
  if (data) {
    const isFrontView = data.shoulderDiffX < 0;
    console.log(`${shot.label} (frames ${shot.start}-${shot.end}):`);
    console.log(`  shoulderDiffX: ${data.shoulderDiffX.toFixed(4)} (${isFrontView ? 'FRONT' : 'BACK'} view)`);
    console.log(`  hipDiffX: ${data.hipDiffX.toFixed(4)}`);
    console.log(`  shoulderZ: ${data.shoulderZ.toFixed(4)}`);
    console.log(`  hipZ: ${data.hipZ.toFixed(4)}`);
    console.log(`  shoulderSep: ${data.shoulderSep.toFixed(4)}`);
    console.log(`  hipSep: ${data.hipSep.toFixed(4)}`);
    console.log("");
  }
}

// Check expected orientations
const labels = JSON.parse(fs.readFileSync('./test-data/20190804_140617/labels.json', 'utf-8'));
console.log("Expected Orientations from Labels:");
for (const shot of labels.shots) {
  console.log(`  Shot ${shot.shotNumber}: ${shot.cameraOrientation}`);
}
