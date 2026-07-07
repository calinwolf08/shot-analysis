import { createShotBoundaryDetector } from './src/detection/shot-detector';
import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

// Find frames around shot 3 (labeled 838-862)
const startIdx = poseData.frames.findIndex((f: any) => f.frameIndex >= 820);
const endIdx = poseData.frames.findIndex((f: any) => f.frameIndex >= 870);

const relevantFrames = poseData.frames.slice(startIdx, endIdx);

// Convert to detector format
const landmarks: any[] = [];
const indexToFrame: number[] = [];

for (const frame of relevantFrames) {
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

console.log("Frame index mapping:");
console.log(`  First frame in sequence: ${indexToFrame[0]}`);
console.log(`  Last frame in sequence: ${indexToFrame[indexToFrame.length - 1]}`);
console.log(`  Total frames: ${indexToFrame.length}`);

// Detect shots
const detector = createShotBoundaryDetector();
const shots = detector.detectShots(landmarks, indexToFrame);

console.log('\nDetected shots in this range:');
for (const shot of shots) {
  const startFrame = indexToFrame[shot.start.frameIndex] ?? shot.start.frameIndex;
  const endFrame = indexToFrame[shot.end.frameIndex] ?? shot.end.frameIndex;
  console.log(`  Frame ${startFrame} - ${endFrame} (raw indices: ${shot.start.frameIndex} - ${shot.end.frameIndex})`);
}
