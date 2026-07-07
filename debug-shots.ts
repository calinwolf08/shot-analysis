import { createShotBoundaryDetector } from './src/detection/shot-detector';
import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// Convert to detector format
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

// Detect shots
const detector = createShotBoundaryDetector();
const shots = detector.detectShots(landmarks, indexToFrame);

console.log('Detected shots:');
for (const shot of shots) {
  const startFrame = indexToFrame[shot.start.frameIndex] ?? shot.start.frameIndex;
  const endFrame = indexToFrame[shot.end.frameIndex] ?? shot.end.frameIndex;
  console.log(`  Frame ${startFrame} - ${endFrame} (confidence: ${shot.start.confidence}/${shot.end.confidence})`);
}

console.log('\nExpected shots:');
console.log('  Frame 68 - 106');
console.log('  Frame 196 - 223');
console.log('  Frame 838 - 862');
