import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('test-data/20190818_142631/poses.json', 'utf8'));
const poses = data.frames;

console.log('Total frames:', data.totalFrames);
console.log('Frames array length:', poses.length);

// Map frames by frameIndex for easy lookup
const frameMap = new Map<number, any>();
poses.forEach((frame: any) => frameMap.set(frame.frameIndex, frame));

// Analyze all three shots in video 5
console.log('Analyzing all three shots in video 5:');
console.log('Expected: Shot 1: 31-55, Shot 2: 270-312, Shot 3: 554-578');
console.log('Detected: Shot 1: 35-56, Shot 2: 287-307, Shot 3: 555-573');
console.log('');

// Function to analyze a shot region
function analyzeRegion(name: string, startFrame: number, endFrame: number, expectedStart: number, detectedStart: number) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${name}: Expected start=${expectedStart}, Detected start=${detectedStart}`);
  console.log(`Looking at frames ${startFrame} to ${endFrame}`);
  console.log('='.repeat(70));

  // Find the local minimum (lowest wrist position = highest Y) in the region
  let minY = Infinity;
  let minFrame = 0;
  let maxY = -Infinity;
  let maxFrame = 0;

  for (let i = startFrame; i <= endFrame; i++) {
    const pose = frameMap.get(i);
    if (!pose || !pose.landmarks) continue;
    const wristY = pose.landmarks[16].y;
    if (wristY > maxY) {  // Higher Y = lower position = dip point
      maxY = wristY;
      maxFrame = i;
    }
    if (wristY < minY) {  // Lower Y = higher position = peak
      minY = wristY;
      minFrame = i;
    }
  }

  console.log(`Dip point (lowest wrist): frame ${maxFrame}, wristY=${maxY.toFixed(3)}`);
  console.log(`Peak point (highest wrist): frame ${minFrame}, wristY=${minY.toFixed(3)}`);

  // Look backward from dip to find where downward motion started
  let dipStart = maxFrame;
  for (let i = maxFrame - 1; i >= startFrame; i--) {
    const pose = frameMap.get(i);
    const prevPose = frameMap.get(i - 1);
    if (!pose || !prevPose || !pose.landmarks || !prevPose.landmarks) break;

    const currY = pose.landmarks[16].y;
    const prevY = prevPose.landmarks[16].y;

    // If wrist was moving DOWN (Y increasing), continue looking back
    if (currY > prevY) {
      dipStart = i;
    } else {
      // Found where downward motion started
      break;
    }
  }
  console.log(`Dip start (where downward motion began): frame ${dipStart}`);

  console.log('\nFrame-by-frame detail:');
  for (let i = startFrame; i <= endFrame; i++) {
    const pose = frameMap.get(i);
    if (!pose || !pose.landmarks) continue;

    const wristY = pose.landmarks[16].y;
    const shoulder = pose.landmarks[12];
    const wristShoulderDelta = wristY - shoulder.y;

    let velocity = 0;
    const prevPose = frameMap.get(i - 1);
    if (prevPose && prevPose.landmarks) {
      velocity = prevPose.landmarks[16].y - wristY; // positive = moving up
    }

    let marker = '';
    if (i === expectedStart) marker = ' <-- EXPECTED START';
    else if (i === detectedStart) marker = ' <-- DETECTED START';
    else if (i === dipStart) marker = ' <-- DIP START';
    else if (i === maxFrame) marker = ' <-- DIP (lowest)';

    console.log(`  Frame ${i}: wristY=${wristY.toFixed(3)}, vel=${velocity.toFixed(4)}, wrist-shoulder=${wristShoulderDelta.toFixed(3)}${marker}`);
  }
}

// Shot 1
analyzeRegion('Shot 1', 20, 60, 31, 35);

// Shot 2
analyzeRegion('Shot 2', 260, 320, 270, 287);

// Shot 3
analyzeRegion('Shot 3', 545, 585, 554, 555);

// Check wrist-shoulder at expected starts
console.log('\n\nWrist-shoulder delta at expected shot starts:');
const checkPoints = [
  { frame: 31, name: 'Shot 1' },
  { frame: 270, name: 'Shot 2' },
  { frame: 554, name: 'Shot 3' },
];
for (const { frame, name } of checkPoints) {
  const pose = frameMap.get(frame);
  if (pose && pose.landmarks) {
    const wristY = pose.landmarks[16].y;
    const shoulderY = pose.landmarks[12].y;
    console.log(`${name} (frame ${frame}): wrist-shoulder=${(wristY - shoulderY).toFixed(3)}, wristY=${wristY.toFixed(3)}`);
  }
}

// Debug the dip detection for shot 2
console.log('\n\nDebugging dip detection for Shot 2:');
console.log('Upward start would be detected around frame 287');
console.log('Looking at both wrists (avg) in frames 267-295:');

for (let i = 267; i <= 295; i++) {
  const pose = frameMap.get(i);
  if (!pose || !pose.landmarks) continue;
  const leftWristY = pose.landmarks[15].y;
  const rightWristY = pose.landmarks[16].y;
  const avgWristY = (leftWristY + rightWristY) / 2;
  const marker = i === 270 ? ' <-- EXPECTED START' : (i === 287 ? ' <-- DETECTED START' : '');
  console.log(`  Frame ${i}: leftY=${leftWristY.toFixed(3)}, rightY=${rightWristY.toFixed(3)}, avgY=${avgWristY.toFixed(3)}${marker}`);
}
