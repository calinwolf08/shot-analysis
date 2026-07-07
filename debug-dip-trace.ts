import * as fs from 'fs';

// Load pose data
const poseData = JSON.parse(fs.readFileSync('./test-data/20190804_140617/poses.json', 'utf-8'));

const RIGHT_WRIST = 16;

// Simulate findDipStart logic
function simulateFindDipStart(frames: any[], upwardStartIndex: number): number {
  const getRawWristY = (idx: number) => frames[idx]?.landmarks?.[RIGHT_WRIST]?.y ?? 0;

  console.log(`\nSimulating findDipStart from index ${upwardStartIndex} (frame ${frames[upwardStartIndex]?.frameIndex})`);

  // First, find the dip point (highest Y = lowest wrist position) before upward start
  const maxDipLookback = 15;
  let dipIndex = upwardStartIndex;
  let dipY = getRawWristY(upwardStartIndex);

  console.log(`\nFinding dip point (highest Y):`);
  for (let i = upwardStartIndex - 1; i >= Math.max(0, upwardStartIndex - maxDipLookback); i--) {
    const rawY = getRawWristY(i);
    console.log(`  Index ${i} (frame ${frames[i]?.frameIndex}): Y=${rawY.toFixed(3)}, ${rawY >= dipY ? 'NEW DIP' : 'not dip'}`);
    if (rawY >= dipY) {
      dipY = rawY;
      dipIndex = i;
    } else if (rawY < dipY - 0.02) {
      console.log(`  Stopping - Y significantly lower (diff=${(dipY - rawY).toFixed(3)})`);
      break;
    }
  }

  console.log(`\nDip point: index ${dipIndex} (frame ${frames[dipIndex]?.frameIndex}), Y=${dipY.toFixed(3)}`);

  if (dipIndex >= upwardStartIndex) {
    console.log('No dip found, returning upwardStartIndex');
    return upwardStartIndex;
  }

  // Look backward from the dip point to find where the downward motion started
  const dipStartLookback = 12;
  let dipStartIndex = dipIndex;
  let consecutivePlateau = 0;
  const maxPlateauFrames = 4;

  console.log(`\nFinding dip start (where downward motion began):`);
  for (let i = dipIndex - 1; i >= Math.max(0, dipIndex - dipStartLookback); i--) {
    const rawY = getRawWristY(i);
    const progressFromDip = dipY - rawY;

    let action = '';
    if (progressFromDip >= 0.005) {
      dipStartIndex = i;
      consecutivePlateau = 0;
      action = `progress=${progressFromDip.toFixed(3)} >= 0.005 → dipStartIndex=${i}`;
    } else if (progressFromDip >= 0) {
      consecutivePlateau++;
      action = `progress=${progressFromDip.toFixed(3)} plateau ${consecutivePlateau}/${maxPlateauFrames}`;
      if (consecutivePlateau > maxPlateauFrames) {
        console.log(`  Index ${i} (frame ${frames[i]?.frameIndex}): ${action} → STOP (max plateau)`);
        break;
      }
    } else {
      action = `progress=${progressFromDip.toFixed(3)} < 0 → STOP (wrist higher than dip)`;
    }

    console.log(`  Index ${i} (frame ${frames[i]?.frameIndex}): Y=${rawY.toFixed(3)}, ${action}`);

    if (progressFromDip < 0) break;
  }

  console.log(`\nDip start: index ${dipStartIndex} (frame ${frames[dipStartIndex]?.frameIndex})`);

  // Check dip magnitude
  const dipStartY = getRawWristY(dipStartIndex);
  const dipMagnitude = dipY - dipStartY;
  console.log(`\nDip magnitude: ${dipY.toFixed(3)} - ${dipStartY.toFixed(3)} = ${dipMagnitude.toFixed(3)} (${(dipMagnitude * 100).toFixed(1)}%)`);

  if (dipMagnitude < 0.01) {
    console.log('Dip too small (< 1%), returning upwardStartIndex');
    return upwardStartIndex;
  }

  // Count continuous downward frames
  let maxContinuousDownFrames = 0;
  let continuousDownFrames = 0;
  let prevY: number | null = null;

  for (let i = dipStartIndex; i <= dipIndex; i++) {
    const rawY = getRawWristY(i);
    if (prevY !== null) {
      const velocity = rawY - prevY;
      if (velocity > 0.001) {
        continuousDownFrames++;
        maxContinuousDownFrames = Math.max(maxContinuousDownFrames, continuousDownFrames);
      } else {
        continuousDownFrames = 0;
      }
    }
    prevY = rawY;
  }

  console.log(`\nMax continuous down frames: ${maxContinuousDownFrames}`);

  const largeDipThreshold = 0.05;
  const minContinuousDownFrames = 5;
  const isLargeContinuousDip = dipMagnitude >= largeDipThreshold && maxContinuousDownFrames >= minContinuousDownFrames;

  console.log(`isLargeContinuousDip: ${isLargeContinuousDip} (magnitude >= ${largeDipThreshold}: ${dipMagnitude >= largeDipThreshold}, downFrames >= ${minContinuousDownFrames}: ${maxContinuousDownFrames >= minContinuousDownFrames})`);

  if (!isLargeContinuousDip) {
    console.log('Not a large continuous dip, returning upwardStartIndex');
    return upwardStartIndex;
  }

  // Cap the maximum adjustment
  const maxAdjustment = 12;
  const actualAdjustment = upwardStartIndex - dipStartIndex;
  console.log(`\nAdjustment: ${upwardStartIndex} - ${dipStartIndex} = ${actualAdjustment}`);

  if (actualAdjustment > maxAdjustment) {
    const cappedResult = upwardStartIndex - maxAdjustment;
    console.log(`Adjustment ${actualAdjustment} > max ${maxAdjustment}, capping to index ${cappedResult} (frame ${frames[cappedResult]?.frameIndex})`);
    return cappedResult;
  }

  console.log(`Returning dipStartIndex: ${dipStartIndex} (frame ${frames[dipStartIndex]?.frameIndex})`);
  return dipStartIndex;
}

// Get relevant frames around shot 3
const startIdx = poseData.frames.findIndex((f: any) => f.frameIndex >= 820);
const endIdx = poseData.frames.findIndex((f: any) => f.frameIndex >= 870);
const relevantFrames = poseData.frames.slice(startIdx, endIdx);

console.log("Frames mapping:");
for (let i = 0; i < 30; i++) {
  if (relevantFrames[i]) {
    console.log(`  Index ${i}: frame ${relevantFrames[i].frameIndex}`);
  }
}

// The upward motion starts around frame 843, which is index ~23 in our slice
const upwardStartIndex = 23; // Approximately where frame 843 would be
const result = simulateFindDipStart(relevantFrames, upwardStartIndex);

console.log(`\n\nFINAL RESULT: Index ${result} (frame ${relevantFrames[result]?.frameIndex})`);
console.log(`Expected: frame 838 (index ~18)`);
