import { loadPoseData, loadLabelData, discoverTestCases } from './src/testing/loader';
import { LANDMARK_INDEX } from './src/pose/types';
import type { Frame } from './src/testing/types';

// Discover all test cases
const discovery = discoverTestCases({ testDataDir: 'test-data' });

for (const testCase of discovery.testCases) {
  console.log(`\n=== ${testCase.name} ===`);

  const poseData = testCase.poseData;
  const labelData = testCase.labelData;

  for (const labeledShot of labelData.shots) {
    const shotFrames = poseData.frames.filter(
      (f: Frame) => f.frameIndex >= labeledShot.startFrame && f.frameIndex <= labeledShot.endFrame && f.landmarks !== null
    );

    if (shotFrames.length === 0) {
      console.log(`  Shot ${labeledShot.shotNumber}: NO FRAMES`);
      continue;
    }

    let totalShoulderDiffX = 0;
    let totalHipDiffX = 0;
    let totalShoulderZ = 0;
    let totalHipZ = 0;
    let validSamples = 0;

    for (const frame of shotFrames) {
      if (!frame.landmarks) continue;
      const ls = frame.landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
      const rs = frame.landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
      const lh = frame.landmarks[LANDMARK_INDEX.LEFT_HIP];
      const rh = frame.landmarks[LANDMARK_INDEX.RIGHT_HIP];
      if (!ls || !rs || !lh || !rh) continue;
      totalShoulderDiffX += rs.x - ls.x;
      totalHipDiffX += rh.x - lh.x;
      totalShoulderZ += rs.z - ls.z;
      totalHipZ += rh.z - lh.z;
      validSamples++;
    }

    const avgShoulderDiffX = totalShoulderDiffX / validSamples;
    const avgHipDiffX = totalHipDiffX / validSamples;
    const avgShoulderZDiff = totalShoulderZ / validSamples;
    const avgHipZDiff = totalHipZ / validSamples;
    const avgSeparation = (Math.abs(avgShoulderDiffX) + Math.abs(avgHipDiffX)) / 2;
    const isFrontView = avgShoulderDiffX < 0;

    console.log(`  Shot ${labeledShot.shotNumber} (${labeledShot.cameraOrientation}):`);
    console.log(`    shoulderDiffX=${avgShoulderDiffX.toFixed(4)}, hipDiffX=${avgHipDiffX.toFixed(4)}, sep=${avgSeparation.toFixed(4)}`);
    console.log(`    shoulderZ=${avgShoulderZDiff.toFixed(4)}, hipZ=${avgHipZDiff.toFixed(4)}, isFront=${isFrontView}`);
  }
}
