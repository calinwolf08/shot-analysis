import fs from 'fs';

const poseData = JSON.parse(fs.readFileSync('test-data/20190804_140654/poses.json', 'utf-8'));
const labels = JSON.parse(fs.readFileSync('test-data/20190804_140654/labels.json', 'utf-8'));

// Check elbow visibility for each shot
for (const shot of labels.shots) {
  const shotFrames = poseData.frames.filter((f: any) => f.frameIndex >= shot.startFrame && f.frameIndex <= shot.endFrame);
  let totalLeftVis = 0;
  let totalRightVis = 0;
  let count = 0;

  for (const frame of shotFrames) {
    if (!frame.landmarks) continue;
    const leftElbow = frame.landmarks[13];
    const rightElbow = frame.landmarks[14];
    if (leftElbow && rightElbow) {
      totalLeftVis += leftElbow.visibility;
      totalRightVis += rightElbow.visibility;
      count++;
    }
  }

  const avgLeft = count > 0 ? (totalLeftVis / count).toFixed(3) : 'N/A';
  const avgRight = count > 0 ? (totalRightVis / count).toFixed(3) : 'N/A';
  const avgMax = count > 0 ? Math.max(totalLeftVis / count, totalRightVis / count).toFixed(3) : 'N/A';

  console.log(`Shot ${shot.shotNumber} (${shot.cameraOrientation}): leftElbow=${avgLeft}, rightElbow=${avgRight}, max=${avgMax}`);
}
