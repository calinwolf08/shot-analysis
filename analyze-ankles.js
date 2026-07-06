import fs from 'fs';
const poses = JSON.parse(fs.readFileSync('test-data/chris-5/poses.json', 'utf8'));

// MediaPipe landmark indices for ankles
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

console.log('=== Ankle Y positions around feet_leave_ground (74) and feet_land (80) ===\n');
console.log('Frame | Left Ankle Y | Right Ankle Y | Avg Ankle Y | Visibility');
console.log('------|--------------|---------------|-------------|------------');

// Find frames 55-85
const relevantFrames = poses.frames.filter(f => f.frameIndex >= 55 && f.frameIndex <= 85);

for (const frame of relevantFrames) {
  if (!frame.landmarks) {
    console.log(String(frame.frameIndex).padStart(5) + ' | No landmarks');
    continue;
  }

  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  const leftY = leftAnkle ? leftAnkle.y.toFixed(4) : 'N/A';
  const rightY = rightAnkle ? rightAnkle.y.toFixed(4) : 'N/A';
  const leftVis = leftAnkle ? leftAnkle.visibility.toFixed(2) : 'N/A';
  const rightVis = rightAnkle ? rightAnkle.visibility.toFixed(2) : 'N/A';

  let avgY = 'N/A';
  if (leftAnkle && rightAnkle) {
    avgY = ((leftAnkle.y + rightAnkle.y) / 2).toFixed(4);
  } else if (leftAnkle) {
    avgY = leftAnkle.y.toFixed(4);
  } else if (rightAnkle) {
    avgY = rightAnkle.y.toFixed(4);
  }

  console.log(String(frame.frameIndex).padStart(5) + ' | ' + leftY.padStart(12) + ' | ' + rightY.padStart(13) + ' | ' + avgY.padStart(11) + ' | L:' + leftVis + ' R:' + rightVis);
}

function analyzeWithBaseline(frames, startFrame, endFrame, label) {
  console.log('\n=== Ground Baseline Analysis (' + label + ') ===');
  const baselineFrames = frames.filter(f => f.frameIndex >= startFrame && f.frameIndex <= endFrame);
  let baselineSum = 0;
  let baselineCount = 0;

  for (const frame of baselineFrames) {
    if (frame.landmarks) {
      const leftAnkle = frame.landmarks[LEFT_ANKLE];
      const rightAnkle = frame.landmarks[RIGHT_ANKLE];
      if (leftAnkle && rightAnkle) {
        baselineSum += (leftAnkle.y + rightAnkle.y) / 2;
        baselineCount++;
      }
    }
  }

  if (baselineCount > 0) {
    const groundBaseline = baselineSum / baselineCount;
    console.log('Ground baseline (avg ankle Y from frames ' + startFrame + '-' + endFrame + '): ' + groundBaseline.toFixed(4));
    console.log('\nDeviation from baseline (positive = feet off ground):');
    console.log('Frame | Deviation | Threshold Check (>0.03?)');
    console.log('------|-----------|------------------------');

    for (const frame of relevantFrames) {
      if (frame.landmarks) {
        const leftAnkle = frame.landmarks[LEFT_ANKLE];
        const rightAnkle = frame.landmarks[RIGHT_ANKLE];
        if (leftAnkle && rightAnkle) {
          const avgY = (leftAnkle.y + rightAnkle.y) / 2;
          const deviation = groundBaseline - avgY;
          const passesThreshold = deviation > 0.03;
          console.log(String(frame.frameIndex).padStart(5) + ' | ' + deviation.toFixed(4).padStart(9) + ' | ' + (passesThreshold ? 'YES - feet off ground' : 'NO'));
        }
      }
    }
  }
}

// Analyze with labeled shot start (55)
analyzeWithBaseline(relevantFrames, 55, 57, 'labeled start: 55-57');

// Analyze with detected shot start (63)
analyzeWithBaseline(relevantFrames, 63, 65, 'detected start: 63-65');
