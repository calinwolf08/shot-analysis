import fs from 'fs';

const poses = JSON.parse(fs.readFileSync('test-data/20190103_181419/poses.json', 'utf8'));

// Find frames for shot 1 (16-34) and shot 2 (117-148)
const shot1Start = 16;
const shot1End = 34;
const shot2Start = 117;
const shot2End = 148;

console.log('=== Shot 2 Analysis (frames 117-148) ===\n');

// LANDMARK_INDICES: LEFT_ANKLE=27, RIGHT_ANKLE=28
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

console.log('Frame | Left Ankle Y | Right Ankle Y | Avg Ankle Y | L Vis | R Vis');
console.log('------|--------------|---------------|-------------|-------|------');

for (let i = shot2Start - 5; i <= shot2End + 5; i++) {
  const frame = poses.frames.find((f: any) => f.frameIndex === i);
  if (!frame) {
    console.log(`${i.toString().padStart(5)} | --- No frame data ---`);
    continue;
  }

  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  const leftY = leftAnkle?.y?.toFixed(4) || 'N/A';
  const rightY = rightAnkle?.y?.toFixed(4) || 'N/A';
  const leftVis = leftAnkle?.visibility?.toFixed(2) || 'N/A';
  const rightVis = rightAnkle?.visibility?.toFixed(2) || 'N/A';

  let avgY = 'N/A';
  if (leftAnkle && rightAnkle && leftAnkle.visibility >= 0.5 && rightAnkle.visibility >= 0.5) {
    avgY = ((leftAnkle.y + rightAnkle.y) / 2).toFixed(4);
  } else if (leftAnkle && leftAnkle.visibility >= 0.5) {
    avgY = leftAnkle.y.toFixed(4);
  } else if (rightAnkle && rightAnkle.visibility >= 0.5) {
    avgY = rightAnkle.y.toFixed(4);
  }

  console.log(`${i.toString().padStart(5)} | ${leftY.padStart(12)} | ${rightY.padStart(13)} | ${avgY.padStart(11)} | ${leftVis.padStart(5)} | ${rightVis.padStart(4)}`);
}

// Calculate ground baseline from frames 117-119
console.log('\n=== Ground Baseline Analysis ===');
const baselineFrames = poses.frames.filter((f: any) => f.frameIndex >= 117 && f.frameIndex <= 119);
let baselineSum = 0;
let baselineCount = 0;

for (const frame of baselineFrames) {
  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  if (leftAnkle?.visibility >= 0.5 && rightAnkle?.visibility >= 0.5) {
    const avg = (leftAnkle.y + rightAnkle.y) / 2;
    baselineSum += avg;
    baselineCount++;
    console.log(`Frame ${frame.frameIndex}: avgAnkleY = ${avg.toFixed(4)}`);
  }
}

if (baselineCount > 0) {
  console.log(`\nBaseline average: ${(baselineSum / baselineCount).toFixed(4)}`);
  console.log(`Threshold: 0.025`);
  console.log(`Required Y for jump detection: < ${((baselineSum / baselineCount) - 0.025).toFixed(4)}`);
}

// Now analyze shot 1 for comparison
console.log('\n\n=== Shot 1 Analysis (frames 16-34) ===\n');

console.log('Frame | Left Ankle Y | Right Ankle Y | Avg Ankle Y | L Vis | R Vis');
console.log('------|--------------|---------------|-------------|-------|------');

for (let i = shot1Start - 5; i <= shot1End + 5; i++) {
  const frame = poses.frames.find((f: any) => f.frameIndex === i);
  if (!frame) {
    console.log(`${i.toString().padStart(5)} | --- No frame data ---`);
    continue;
  }

  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  const leftY = leftAnkle?.y?.toFixed(4) || 'N/A';
  const rightY = rightAnkle?.y?.toFixed(4) || 'N/A';
  const leftVis = leftAnkle?.visibility?.toFixed(2) || 'N/A';
  const rightVis = rightAnkle?.visibility?.toFixed(2) || 'N/A';

  let avgY = 'N/A';
  if (leftAnkle && rightAnkle && leftAnkle.visibility >= 0.5 && rightAnkle.visibility >= 0.5) {
    avgY = ((leftAnkle.y + rightAnkle.y) / 2).toFixed(4);
  } else if (leftAnkle && leftAnkle.visibility >= 0.5) {
    avgY = leftAnkle.y.toFixed(4);
  } else if (rightAnkle && rightAnkle.visibility >= 0.5) {
    avgY = rightAnkle.y.toFixed(4);
  }

  console.log(`${i.toString().padStart(5)} | ${leftY.padStart(12)} | ${rightY.padStart(13)} | ${avgY.padStart(11)} | ${leftVis.padStart(5)} | ${rightVis.padStart(4)}`);
}

// Calculate ground baseline from frames 16-18 for shot 1
console.log('\n=== Ground Baseline Analysis (Shot 1) ===');
const baselineFramesShot1 = poses.frames.filter((f: any) => f.frameIndex >= 16 && f.frameIndex <= 18);
let baselineSumShot1 = 0;
let baselineCountShot1 = 0;

for (const frame of baselineFramesShot1) {
  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  if (leftAnkle?.visibility >= 0.5 && rightAnkle?.visibility >= 0.5) {
    const avg = (leftAnkle.y + rightAnkle.y) / 2;
    baselineSumShot1 += avg;
    baselineCountShot1++;
    console.log(`Frame ${frame.frameIndex}: avgAnkleY = ${avg.toFixed(4)}`);
  }
}

if (baselineCountShot1 > 0) {
  const baseline = baselineSumShot1 / baselineCountShot1;
  console.log(`\nBaseline average: ${baseline.toFixed(4)}`);
  console.log(`Threshold: 0.025`);
  console.log(`Required Y for jump detection: < ${(baseline - 0.025).toFixed(4)}`);
}

// Alternative baseline strategy: use maximum ankle Y from the shot as baseline
console.log('\n\n=== Alternative Baseline Strategy (Shot 2) ===');
console.log('Analyze the jump pattern around labeled feet_leave_ground (frame 134)\n');

const shot2Frames = poses.frames.filter((f: any) => f.frameIndex >= shot2Start && f.frameIndex <= shot2End);

let maxAnkleY = -Infinity;
let maxFrame = -1;
let minAnkleY = Infinity;
let minFrame = -1;

for (const frame of shot2Frames) {
  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  if (leftAnkle?.visibility >= 0.5 && rightAnkle?.visibility >= 0.5) {
    const avg = (leftAnkle.y + rightAnkle.y) / 2;
    if (avg > maxAnkleY) {
      maxAnkleY = avg;
      maxFrame = frame.frameIndex;
    }
    if (avg < minAnkleY) {
      minAnkleY = avg;
      minFrame = frame.frameIndex;
    }
  }
}

console.log(`Shot 2 max ankle Y (lowest position): ${maxAnkleY.toFixed(4)} at frame ${maxFrame}`);
console.log(`Shot 2 min ankle Y (highest position): ${minAnkleY.toFixed(4)} at frame ${minFrame}`);
console.log(`Full range: ${(maxAnkleY - minAnkleY).toFixed(4)}`);

// Analyze around labeled feet_leave_ground (134) and feet_land (143)
console.log('\n=== Jump Analysis Around Labeled Keyframes ===');
console.log('Looking for local minimum ankle Y (peak jump) between frames 130-145\n');

let localMinY = Infinity;
let localMinFrame = -1;
let localMaxY = -Infinity;
let localMaxFrame = -1;

for (const frame of poses.frames.filter((f: any) => f.frameIndex >= 130 && f.frameIndex <= 145)) {
  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  if (leftAnkle?.visibility >= 0.5 && rightAnkle?.visibility >= 0.5) {
    const avg = (leftAnkle.y + rightAnkle.y) / 2;
    if (avg < localMinY) {
      localMinY = avg;
      localMinFrame = frame.frameIndex;
    }
    if (avg > localMaxY) {
      localMaxY = avg;
      localMaxFrame = frame.frameIndex;
    }
  }
}

console.log(`Local max (squat/ground): ${localMaxY.toFixed(4)} at frame ${localMaxFrame}`);
console.log(`Local min (jump peak): ${localMinY.toFixed(4)} at frame ${localMinFrame}`);
console.log(`Local jump height: ${(localMaxY - localMinY).toFixed(4)}`);
console.log(`Threshold needed to detect: ${(localMaxY - localMinY).toFixed(4)}`);

// Conclusion
console.log('\n=== Conclusion ===');
console.log(`Current threshold: 0.025`);
console.log(`Actual jump magnitude: ${(localMaxY - localMinY).toFixed(4)}`);
if (localMaxY - localMinY < 0.025) {
  console.log(`\n⚠️ Jump is too subtle for current threshold.`);
  console.log(`   Either lower threshold or accept labels may be inaccurate for this shot.`);
}

// Check the global minimum
console.log('\n=== Global Minimum Analysis ===');
console.log(`Global minimum ankle Y: ${minAnkleY.toFixed(4)} at frame ${minFrame}`);
console.log(`Global maximum ankle Y: ${maxAnkleY.toFixed(4)} at frame ${maxFrame}`);
console.log(`\nThe problem: Global minimum is at frame ${minFrame} (shot start region).`);
console.log(`There are no frames "before" the global min to use as baseline.`);
console.log(`\nWe need to find the LOCAL minimum (jump peak) in the later part of the shot,`);
console.log(`and use the LOCAL maximum before that as the baseline.`);

// Find local extrema in the SECOND HALF of the shot
console.log('\n=== Local Extrema in Second Half (frames 130-142) ===');
const secondHalfFrames = poses.frames.filter((f: any) => f.frameIndex >= 130 && f.frameIndex <= 142);

let secondHalfMaxY = -Infinity;
let secondHalfMaxFrame = -1;
let secondHalfMinY = Infinity;
let secondHalfMinFrame = -1;

for (const frame of secondHalfFrames) {
  const leftAnkle = frame.landmarks[LEFT_ANKLE];
  const rightAnkle = frame.landmarks[RIGHT_ANKLE];

  if (leftAnkle?.visibility >= 0.5 && rightAnkle?.visibility >= 0.5) {
    const avg = (leftAnkle.y + rightAnkle.y) / 2;
    if (avg > secondHalfMaxY) {
      secondHalfMaxY = avg;
      secondHalfMaxFrame = frame.frameIndex;
    }
    if (avg < secondHalfMinY) {
      secondHalfMinY = avg;
      secondHalfMinFrame = frame.frameIndex;
    }
  }
}

console.log(`Second half max (ground): ${secondHalfMaxY.toFixed(4)} at frame ${secondHalfMaxFrame}`);
console.log(`Second half min (jump): ${secondHalfMinY.toFixed(4)} at frame ${secondHalfMinFrame}`);
console.log(`Jump magnitude in 2nd half: ${(secondHalfMaxY - secondHalfMinY).toFixed(4)}`);

// The proper approach: look for the pattern SQUAT -> JUMP -> LAND
// Starting from the release/set point area, not from shot start
console.log('\n=== Proper Jump Detection (relative to squat) ===');
console.log('Frame range 130-135 should show squat-to-jump transition:');
for (let i = 130; i <= 140; i++) {
  const frame = poses.frames.find((f: any) => f.frameIndex === i);
  if (frame) {
    const leftAnkle = frame.landmarks[LEFT_ANKLE];
    const rightAnkle = frame.landmarks[RIGHT_ANKLE];
    if (leftAnkle?.visibility >= 0.5 && rightAnkle?.visibility >= 0.5) {
      const avg = (leftAnkle.y + rightAnkle.y) / 2;
      console.log(`  Frame ${i}: avgAnkleY = ${avg.toFixed(4)}`);
    }
  }
}
