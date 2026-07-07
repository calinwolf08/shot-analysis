import { createShotBoundaryDetector } from './src/detection/shot-detector';
import * as fs from 'fs';

// Load full pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// Convert ALL frames to detector format
const landmarks: any[] = [];
const indexToFrame: number[] = [];

for (const frame of poseData.frames) {
  if (frame.landmarks !== null) {
    landmarks.push({
      landmarks: frame.landmarks.map((l: any) => ({
        ...l,
        confidence: l.visibility
      })),
      poseConfidence: frame.poseConfidence
    });
    indexToFrame.push(frame.frameIndex);
  }
}

console.log(`Total frames with landmarks: ${landmarks.length}`);
console.log(`Frame index range: ${indexToFrame[0]} to ${indexToFrame[indexToFrame.length - 1]}`);

// Find where frame 828 and 843 are in the array
const idx828 = indexToFrame.indexOf(828);
const idx843 = indexToFrame.indexOf(843);
const idx838 = indexToFrame.indexOf(838);

console.log(`\nFrame 828 is at array index: ${idx828}`);
console.log(`Frame 838 is at array index: ${idx838}`);
console.log(`Frame 843 is at array index: ${idx843}`);

// Show nearby frame index mappings
console.log(`\nFrame mappings around shot 3:`);
for (let i = idx828 - 5; i < idx828 + 25; i++) {
  if (indexToFrame[i] !== undefined) {
    console.log(`  Array index ${i}: frame ${indexToFrame[i]}`);
  }
}

// Detect shots
const detector = createShotBoundaryDetector();
const shots = detector.detectShots(landmarks, indexToFrame);

console.log('\nDetected shots:');
for (const shot of shots) {
  const startFrame = indexToFrame[shot.start.frameIndex] ?? shot.start.frameIndex;
  const endFrame = indexToFrame[shot.end.frameIndex] ?? shot.end.frameIndex;
  console.log(`  Array indices ${shot.start.frameIndex} - ${shot.end.frameIndex} → Frames ${startFrame} - ${endFrame}`);
}
