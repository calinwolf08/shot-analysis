import { createShotBoundaryDetector } from './src/detection/shot-detector';
import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20201212_134104/poses.json', 'utf-8'));

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

console.log('\nDetected shots:');
for (const shot of shots) {
  const startFrame = indexToFrame[shot.start.frameIndex] ?? shot.start.frameIndex;
  const endFrame = indexToFrame[shot.end.frameIndex] ?? shot.end.frameIndex;
  console.log(`  Frame ${startFrame} - ${endFrame}`);
}

console.log('\nExpected: Frame 75 - 112');
