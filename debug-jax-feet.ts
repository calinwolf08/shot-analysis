import * as fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));

const LANDMARK_INDICES = {
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

console.log('=== Analyzing feet detection for shots 1 & 2 (front-right, side-left) ===\n');

function getFrameAnkleY(frame: any, visibilityThreshold: number): number | null {
  if (!frame.landmarks) return null;

  const leftAnkle = frame.landmarks[LANDMARK_INDICES.LEFT_ANKLE];
  const rightAnkle = frame.landmarks[LANDMARK_INDICES.RIGHT_ANKLE];

  const leftVisible = leftAnkle && leftAnkle.visibility >= visibilityThreshold;
  const rightVisible = rightAnkle && rightAnkle.visibility >= visibilityThreshold;

  if (leftVisible && rightVisible) {
    return (leftAnkle.y + rightAnkle.y) / 2;
  } else if (leftVisible) {
    return leftAnkle.y;
  } else if (rightVisible) {
    return rightAnkle.y;
  }

  return null;
}

// Shot 1: front-right, frames 32-56 (detected), expected 28-60
console.log('--- Shot 1 (front-right): frames 32-56 detected, expected feet_leave_ground=49, feet_land=55 ---');
console.log('Release frame: 53\n');

const shot1Frames = poseData.frames.filter((f: any) => f.frameIndex >= 30 && f.frameIndex <= 60);
for (const frame of shot1Frames) {
  const ankleY = getFrameAnkleY(frame, 0.3); // Using visibility threshold of 0.3
  const leftAnkle = frame.landmarks?.[LANDMARK_INDICES.LEFT_ANKLE];
  const rightAnkle = frame.landmarks?.[LANDMARK_INDICES.RIGHT_ANKLE];
  const leftVis = leftAnkle?.visibility?.toFixed(2) || 'N/A';
  const rightVis = rightAnkle?.visibility?.toFixed(2) || 'N/A';

  if (ankleY !== null) {
    console.log(`  Frame ${frame.frameIndex}: ankleY=${ankleY.toFixed(3)} (L_vis=${leftVis}, R_vis=${rightVis})`);
  } else {
    console.log(`  Frame ${frame.frameIndex}: BELOW VIS THRESHOLD (L_vis=${leftVis}, R_vis=${rightVis})`);
  }
}

// Shot 2: side-left, frames 320-347 (detected), expected 314-351
console.log('\n--- Shot 2 (side-left): frames 320-347 detected, expected feet_leave_ground=343, feet_land=346 ---');
console.log('Release frame: 342\n');

const shot2Frames = poseData.frames.filter((f: any) => f.frameIndex >= 318 && f.frameIndex <= 350);
for (const frame of shot2Frames) {
  const ankleY = getFrameAnkleY(frame, 0.3);
  const leftAnkle = frame.landmarks?.[LANDMARK_INDICES.LEFT_ANKLE];
  const rightAnkle = frame.landmarks?.[LANDMARK_INDICES.RIGHT_ANKLE];
  const leftVis = leftAnkle?.visibility?.toFixed(2) || 'N/A';
  const rightVis = rightAnkle?.visibility?.toFixed(2) || 'N/A';

  if (ankleY !== null) {
    console.log(`  Frame ${frame.frameIndex}: ankleY=${ankleY.toFixed(3)} (L_vis=${leftVis}, R_vis=${rightVis})`);
  } else {
    console.log(`  Frame ${frame.frameIndex}: BELOW VIS THRESHOLD (L_vis=${leftVis}, R_vis=${rightVis})`);
  }
}

// For shot 3 (behind), let's look at why ball_low_point/ball_starts_upward are off
console.log('\n--- Shot 3 (behind): expected ball_low_point=561, detected=571 (diff +10) ---');
console.log('shot start=561, expected ball_starts_upward=562, detected=572 (diff +10)\n');

// Check visibility at very low threshold
console.log('Checking wrist data at lower visibility threshold (0.1):');
const shot3Frames = poseData.frames.filter((f: any) => f.frameIndex >= 559 && f.frameIndex <= 575);
for (const frame of shot3Frames) {
  const leftWrist = frame.landmarks?.[15]; // LEFT_WRIST
  const rightWrist = frame.landmarks?.[16]; // RIGHT_WRIST

  if (leftWrist && rightWrist) {
    const avgWristY = (leftWrist.y + rightWrist.y) / 2;
    const avgVis = (leftWrist.visibility + rightWrist.visibility) / 2;
    console.log(`  Frame ${frame.frameIndex}: wristY=${avgWristY.toFixed(3)}, avgVis=${avgVis.toFixed(2)}`);
  }
}
