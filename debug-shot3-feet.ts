import * as fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));

console.log('=== Analyzing feet detection for shot 3 (behind) ===\n');

// Shot 3: detected start=561, end=588
// Release frame: 581 (detected), expected 585
// Expected feet_leave_ground: 582, detected: 568

const LANDMARK_INDICES = {
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

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

const frames = poseData.frames.filter((f: any) => f.frameIndex >= 560 && f.frameIndex <= 595);

console.log('Ankle Y data for shot 3 (vis threshold 0.3):');
console.log('Release frame (detected): 581');
console.log('Expected feet_leave_ground: 582\n');

for (const frame of frames) {
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
