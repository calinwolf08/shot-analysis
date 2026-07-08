import fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20190804_140654/poses.json', 'utf-8'));
const labels = JSON.parse(fs.readFileSync('test-data/20190804_140654/labels.json', 'utf-8'));

// Analyze wrist Y and velocity for shots where set_point is off
const shotsToAnalyze = [2, 6, 7]; // Shot 2 has diff +9, Shot 6 has diff +10, Shot 7 passes

for (const shotNum of shotsToAnalyze) {
  const shot = labels.shots.find((s: any) => s.shotNumber === shotNum);
  if (!shot) continue;

  console.log(`\n=== Shot ${shotNum} (${shot.cameraOrientation}) ===`);
  console.log(`Labeled set_point: ${shot.set_point}`);
  console.log(`ball_starts_upward: ${shot.ball_starts_upward}`);
  console.log(`Shot range: ${shot.startFrame} - ${shot.endFrame}`);

  // Get frames from ball_starts_upward to end
  const frames = poseData.frames.filter((f: any) =>
    f.frameIndex >= shot.ball_starts_upward && f.frameIndex <= shot.endFrame
  );

  // Calculate wrist Y positions and elbow angles
  const wristData: Array<{frame: number, y: number, elbowAngle: number | null}> = [];

  for (const frame of frames) {
    if (!frame.landmarks) continue;
    const leftWrist = frame.landmarks[15];
    const rightWrist = frame.landmarks[16];

    // Calculate elbow angle (shoulder-elbow-wrist)
    let elbowAngle: number | null = null;
    const leftShoulder = frame.landmarks[11];
    const leftElbow = frame.landmarks[13];
    const rightShoulder = frame.landmarks[12];
    const rightElbow = frame.landmarks[14];

    // Try right arm first (assuming right-handed shooter)
    if (rightShoulder && rightElbow && rightWrist &&
        rightShoulder.visibility > 0.3 && rightElbow.visibility > 0.3 && rightWrist.visibility > 0.3) {
      elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    } else if (leftShoulder && leftElbow && leftWrist &&
               leftShoulder.visibility > 0.3 && leftElbow.visibility > 0.3 && leftWrist.visibility > 0.3) {
      elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    }

    if (leftWrist && rightWrist) {
      const avgY = (leftWrist.y + rightWrist.y) / 2;
      wristData.push({
        frame: frame.frameIndex,
        y: avgY,
        elbowAngle
      });
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

  // Calculate velocities
  console.log('\nFrame | WristY  | ElbowAng | Velocity | isLocalMax | Note');
  console.log('------|---------|----------|----------|------------|-----');

  let minY = Infinity;
  let minYFrame = -1;
  let firstLocalMax = -1;

  for (let i = 0; i < wristData.length; i++) {
    const d = wristData[i];
    let velocity = 0;
    if (i > 0) {
      velocity = d.y - wristData[i-1].y;
    }

    if (d.y < minY) {
      minY = d.y;
      minYFrame = d.frame;
    }

    // A local maximum in wristY means:
    // - previous frame had higher wristY (velocity was positive or less negative)
    // - next frame has lower wristY (will continue decreasing)
    // This is the "pause" or "hesitation" point
    let isLocalMax = false;
    if (i > 0 && i < wristData.length - 1) {
      const prevY = wristData[i-1].y;
      const nextY = wristData[i+1].y;
      // Local max if current is higher than both neighbors (lower wristY = higher position)
      // But we want local min in position = local max in wristY
      if (d.y > prevY && d.y > nextY) {
        isLocalMax = true;
        if (firstLocalMax === -1 && i > 3) {
          firstLocalMax = d.frame;
        }
      }
    }

    let note = '';
    if (d.frame === shot.set_point) note = '<-- LABELED set_point';

    const elbowStr = d.elbowAngle !== null ? d.elbowAngle.toFixed(1).padStart(7) : '   N/A ';
    console.log(`${d.frame.toString().padStart(5)} | ${d.y.toFixed(4)} | ${elbowStr} | ${velocity >= 0 ? '+' : ''}${velocity.toFixed(4)} | ${isLocalMax ? 'YES' : '   '} | ${note}`);
  }

  console.log(`\nGlobal min wristY at frame ${minYFrame} (Y=${minY.toFixed(4)})`);
  console.log(`First local max wristY at frame ${firstLocalMax}`);
}
