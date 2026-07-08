import fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20181219_173607/poses.json', 'utf-8'));
const labels = JSON.parse(fs.readFileSync('test-data/20181219_173607/labels.json', 'utf-8'));

// Analyze shots 2 and 4 where set_point is now detected too early
const shotsToAnalyze = [4];

for (const shotNum of shotsToAnalyze) {
  const shot = labels.shots.find((s: any) => s.shotNumber === shotNum);
  if (!shot) continue;

  console.log(`\n=== Shot ${shotNum} (${shot.cameraOrientation}) ===`);
  console.log(`Labeled set_point: ${shot.set_point}`);
  console.log(`ball_starts_upward: ${shot.ball_starts_upward}`);
  console.log(`Shot range: ${shot.startFrame} - ${shot.endFrame}`);

  // Use detected ball_starts_upward (836) and endFrame (866) from test output
  const detectedBallStartsUpward = 836;
  const detectedEndFrame = 866;
  const searchEndFrame = detectedBallStartsUpward + Math.floor((detectedEndFrame - detectedBallStartsUpward + 1) * 0.7);

  console.log(`Detected ball_starts_upward: ${detectedBallStartsUpward}`);
  console.log(`Detected endFrame: ${detectedEndFrame}`);
  console.log(`searchEndFrame (70%): ${searchEndFrame}`);

  // Get frames from ball_starts_upward to search end
  const frames = poseData.frames.filter((f: any) =>
    f.frameIndex >= detectedBallStartsUpward && f.frameIndex <= searchEndFrame
  );

  // Calculate wrist Y and elbow angle
  for (const frame of frames) {
    if (!frame.landmarks) continue;

    const leftWrist = frame.landmarks[15];
    const rightWrist = frame.landmarks[16];
    if (!leftWrist || !rightWrist) continue;

    const wristY = (leftWrist.y + rightWrist.y) / 2;

    // Calculate elbow angle
    let elbowAngle: number | null = null;
    const leftShoulder = frame.landmarks[11];
    const leftElbow = frame.landmarks[13];
    const rightShoulder = frame.landmarks[12];
    const rightElbow = frame.landmarks[14];

    if (rightShoulder && rightElbow && rightWrist &&
        rightShoulder.visibility > 0.3 && rightElbow.visibility > 0.3 && rightWrist.visibility > 0.3) {
      elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    } else if (leftShoulder && leftElbow && leftWrist &&
               leftShoulder.visibility > 0.3 && leftElbow.visibility > 0.3 && leftWrist.visibility > 0.3) {
      elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    }

    let note = '';
    if (frame.frameIndex === shot.set_point) note = '<-- LABELED set_point';
    if (elbowAngle !== null && elbowAngle < 100) note += ' [<100°]';
    else if (elbowAngle !== null && elbowAngle < 120) note += ' [<120°]';

    const elbowStr = elbowAngle !== null ? elbowAngle.toFixed(1).padStart(7) : '   N/A ';
    console.log(`Frame ${frame.frameIndex.toString().padStart(4)}: wristY=${wristY.toFixed(4)}, elbow=${elbowStr} ${note}`);
  }
}

function calculateAngle(a: any, b: any, c: any): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  const cosAngle = dot / (magBA * magBC);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}
