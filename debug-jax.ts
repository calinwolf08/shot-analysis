import * as fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));

console.log('=== Analyzing keyframe detection for shot 3 (behind orientation) ===\n');
console.log('Shot 3 boundaries: frames 561-588 (detected)\n');

// First, let's see what frames actually exist in the pose data around this range
console.log('--- Frames available in pose data near shot 3 ---');
const framesInRange = poseData.frames.filter(f => f.frameIndex >= 555 && f.frameIndex <= 595);
console.log(`Total frames in range 555-595: ${framesInRange.length}`);
if (framesInRange.length > 0) {
  console.log(`Frame numbers: ${framesInRange.map(f => f.frameIndex).join(', ')}`);
}

// Check wrist data for these frames
console.log('\n--- Wrist data for shot 3 frames ---');
for (const frame of framesInRange) {
  if (frame.landmarks) {
    const leftWrist = frame.landmarks[15];  // LEFT_WRIST
    const rightWrist = frame.landmarks[16]; // RIGHT_WRIST

    if (leftWrist && rightWrist) {
      const avgVisibility = (leftWrist.visibility + rightWrist.visibility) / 2;
      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      console.log(`  Frame ${frame.frameIndex}: wristY=${avgWristY.toFixed(3)}, vis=${avgVisibility.toFixed(2)}`);
    } else {
      console.log(`  Frame ${frame.frameIndex}: Missing wrist landmarks!`);
    }
  } else {
    console.log(`  Frame ${frame.frameIndex}: No landmarks!`);
  }
}
