import { loadPoseData } from './src/testing/loader.js';
import { ShotBoundaryDetector } from './src/detection/shot-detector.js';
import type { PoseLandmarks } from './src/pose/types.js';
import { LANDMARK_INDEX } from './src/pose/types.js';

async function analyze() {
  const poseResult = loadPoseData('test-data/20201212_134104/poses.json');
  if (!poseResult.success) {
    console.error('Failed to load pose data:', poseResult.error);
    return;
  }

  const poseData = poseResult.data;
  const validPoses: PoseLandmarks[] = [];
  const originalFrameIndices: number[] = [];

  for (let i = 0; i < poseData.frames.length; i++) {
    const frame = poseData.frames[i];
    if (frame && frame.landmarks && frame.landmarks.length > 0) {
      validPoses.push({ landmarks: frame.landmarks });
      originalFrameIndices.push(i);
    }
  }

  const detector = new ShotBoundaryDetector();
  const shots = detector.detectShots(validPoses, originalFrameIndices);

  console.log('Detected shots:');
  shots.forEach((shot, i) => {
    const startOriginal = originalFrameIndices[shot.start.frameIndex];
    const endOriginal = originalFrameIndices[shot.end.frameIndex];
    console.log('Shot ' + (i+1) + ': frames ' + startOriginal + ' to ' + endOriginal);
  });

  // Expected from labels:
  console.log('\nExpected (from labels):');
  console.log('Shot 1: frames 81-111');
  console.log('Shot 2: frames 243-270');
  console.log('Shot 3: frames 397-418');

  // Analyze wrist positions around frames 420-450 to understand the false positive
  console.log('\n\nAnalyzing wrist positions in false positive region (frames 420-455):');

  for (let i = 0; i < validPoses.length; i++) {
    const origFrame = originalFrameIndices[i];
    if (origFrame >= 420 && origFrame <= 455) {
      const pose = validPoses[i];
      const leftWrist = pose.landmarks[LANDMARK_INDEX.LEFT_WRIST];
      const rightWrist = pose.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
      const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];

      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const wristAboveShoulder = avgWristY - avgShoulderY;

      console.log('Frame ' + origFrame + ': avgWristY=' + avgWristY.toFixed(3) +
                  ' avgShoulderY=' + avgShoulderY.toFixed(3) +
                  ' delta=' + wristAboveShoulder.toFixed(3));
    }
  }

  // Also check the 3rd shot region for comparison (frames 390-420)
  console.log('\n\nComparing with legitimate shot 3 (frames 390-420):');

  for (let i = 0; i < validPoses.length; i++) {
    const origFrame = originalFrameIndices[i];
    if (origFrame >= 390 && origFrame <= 420) {
      const pose = validPoses[i];
      const leftWrist = pose.landmarks[LANDMARK_INDEX.LEFT_WRIST];
      const rightWrist = pose.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
      const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
      const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];

      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const wristAboveShoulder = avgWristY - avgShoulderY;

      console.log('Frame ' + origFrame + ': avgWristY=' + avgWristY.toFixed(3) +
                  ' avgShoulderY=' + avgShoulderY.toFixed(3) +
                  ' delta=' + wristAboveShoulder.toFixed(3));
    }
  }

  // Check if there's a gap of pose data between shots 3 and false positive
  console.log('\n\nChecking continuity of pose data (frames 400-460):');
  let lastOrigFrame = -1;
  for (let i = 0; i < validPoses.length; i++) {
    const origFrame = originalFrameIndices[i];
    if (origFrame >= 400 && origFrame <= 460) {
      if (lastOrigFrame >= 0 && origFrame - lastOrigFrame > 1) {
        console.log('GAP DETECTED: frames ' + lastOrigFrame + ' to ' + origFrame + ' (missing ' + (origFrame - lastOrigFrame - 1) + ' frames)');
      }
      lastOrigFrame = origFrame;
    }
  }
  console.log('Pose data is continuous in this range');

  // Check the total number of frames in the video
  console.log('\nTotal frames in pose data: ' + poseData.frames.length);
  console.log('Valid poses: ' + validPoses.length);
  console.log('Last frame with valid pose: ' + originalFrameIndices[originalFrameIndices.length - 1]);

  // Analyze ankle positions for shot 3 (frames 397-418)
  console.log('\n\n=== Analyzing ankle positions for shot 3 (frames 394-420) ===');
  const LEFT_ANKLE = 27;
  const RIGHT_ANKLE = 28;

  for (let i = 0; i < validPoses.length; i++) {
    const origFrame = originalFrameIndices[i];
    if (origFrame >= 394 && origFrame <= 420) {
      const pose = validPoses[i];
      const leftAnkle = pose.landmarks[LEFT_ANKLE];
      const rightAnkle = pose.landmarks[RIGHT_ANKLE];

      const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

      console.log('Frame ' + origFrame + ': avgAnkleY=' + avgAnkleY.toFixed(4));
    }
  }

  // Analyze: In a real shot, where does the ball/wrist start from?
  console.log('\n\n=== Comparing shot START positions ===');

  // For each shot, show the wrist position at the start
  const shotStarts = [
    { name: 'Shot 1 (real)', frame: 81 },
    { name: 'Shot 2 (real)', frame: 243 },
    { name: 'Shot 3 (real)', frame: 397 },
    { name: 'False positive', frame: 430 },
  ];

  for (const shot of shotStarts) {
    // Find the pose index for this frame
    const poseIndex = originalFrameIndices.findIndex(f => f === shot.frame);
    if (poseIndex < 0) {
      console.log(shot.name + ' (frame ' + shot.frame + '): No pose data');
      continue;
    }

    const pose = validPoses[poseIndex];
    const leftWrist = pose.landmarks[LANDMARK_INDEX.LEFT_WRIST];
    const rightWrist = pose.landmarks[LANDMARK_INDEX.RIGHT_WRIST];
    const leftShoulder = pose.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const rightShoulder = pose.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const leftHip = pose.landmarks[LANDMARK_INDEX.LEFT_HIP];
    const rightHip = pose.landmarks[LANDMARK_INDEX.RIGHT_HIP];

    const avgWristY = (leftWrist.y + rightWrist.y) / 2;
    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const wristRelShoulder = avgWristY - avgShoulderY;
    const wristRelHip = avgWristY - avgHipY;

    console.log(shot.name + ' (frame ' + shot.frame + '):');
    console.log('  wristY=' + avgWristY.toFixed(3) +
                ' shoulderY=' + avgShoulderY.toFixed(3) +
                ' hipY=' + avgHipY.toFixed(3));
    console.log('  wrist-shoulder=' + wristRelShoulder.toFixed(3) +
                ' wrist-hip=' + wristRelHip.toFixed(3));
  }
}

analyze();
