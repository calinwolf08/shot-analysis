import fs from 'fs';

// Simulate the exact findDipStart algorithm from shot-detector.ts
function simulateFindDipStart(videoPath, upwardStartFrame, labeledStart) {
  const poses = JSON.parse(fs.readFileSync(videoPath, 'utf8'));
  const RIGHT_WRIST = 16;

  console.log(`\n=== Simulating findDipStart: ${videoPath} ===`);
  console.log(`upwardStartFrame: ${upwardStartFrame}, labeled: ${labeledStart}`);

  const getRawWristY = (frameIdx) => {
    const frame = poses.frames.find(f => f.frameIndex === frameIdx);
    return frame?.landmarks[RIGHT_WRIST]?.y || null;
  };

  // Step 1: Find dip point
  const maxDipLookback = 15;
  let dipFrame = upwardStartFrame;
  let dipY = getRawWristY(upwardStartFrame) ?? 0;

  console.log(`\nStep 1: Finding dip point (max lookback ${maxDipLookback})...`);
  console.log(`  Starting at frame ${upwardStartFrame}, wristY=${dipY.toFixed(4)}`);

  for (let i = upwardStartFrame - 1; i >= Math.max(0, upwardStartFrame - maxDipLookback); i--) {
    const rawY = getRawWristY(i);
    if (rawY === null) {
      console.log(`  Frame ${i}: NO DATA, breaking`);
      break;
    }

    if (rawY >= dipY) {
      dipY = rawY;
      dipFrame = i;
      console.log(`  Frame ${i}: wristY=${rawY.toFixed(4)} >= dipY -> NEW DIP POINT`);
    } else if (rawY < dipY - 0.02) {
      console.log(`  Frame ${i}: wristY=${rawY.toFixed(4)} < dipY-0.02 -> STOP (sig lower)`);
      break;
    } else {
      console.log(`  Frame ${i}: wristY=${rawY.toFixed(4)}, dipY=${dipY.toFixed(4)} -> continue`);
    }
  }

  const distanceToDip = upwardStartFrame - dipFrame;
  console.log(`\n  => Dip point at frame ${dipFrame}, distanceToDip=${distanceToDip}`);

  // Step 2: Check if dip >= upwardStartFrame (no dip found)
  if (dipFrame >= upwardStartFrame) {
    console.log(`\nStep 2: dipFrame >= upwardStartFrame, RETURNING ${upwardStartFrame}`);
    return upwardStartFrame;
  }

  // Step 3: Find dip start frame
  console.log(`\nStep 3: Finding dip start frame...`);
  const dipStartLookback = 12; // Fixed lookback to properly detect gather phases
  console.log(`  dipStartLookback = ${dipStartLookback}`);

  let dipStartFrame = dipFrame;
  let consecutivePlateau = 0;
  const maxPlateauFrames = 4;

  for (let i = dipFrame - 1; i >= Math.max(0, dipFrame - dipStartLookback); i--) {
    const rawY = getRawWristY(i);
    if (rawY === null) {
      console.log(`  Frame ${i}: NO DATA, breaking`);
      break;
    }

    const progressFromDip = dipY - rawY;

    if (progressFromDip >= 0.005) {
      dipStartFrame = i;
      consecutivePlateau = 0;
      console.log(`  Frame ${i}: wristY=${rawY.toFixed(4)}, progress=${progressFromDip.toFixed(4)} -> NEW DIP START`);
    } else if (progressFromDip >= 0) {
      consecutivePlateau++;
      console.log(`  Frame ${i}: wristY=${rawY.toFixed(4)}, progress=${progressFromDip.toFixed(4)} -> plateau (${consecutivePlateau}/${maxPlateauFrames})`);
      if (consecutivePlateau > maxPlateauFrames) {
        console.log(`    Too many plateaus, breaking`);
        break;
      }
    } else {
      console.log(`  Frame ${i}: wristY=${rawY.toFixed(4)}, progress=${progressFromDip.toFixed(4)} -> STOP (going wrong direction)`);
      break;
    }
  }

  console.log(`\n  => dipStartFrame = ${dipStartFrame}`);

  // Step 4: Check dip magnitude
  const dipStartY = getRawWristY(dipStartFrame) ?? dipY;
  const dipMagnitude = dipY - dipStartY;
  console.log(`\nStep 4: Check dip magnitude`);
  console.log(`  dipStartY = ${dipStartY.toFixed(4)}, dipY = ${dipY.toFixed(4)}`);
  console.log(`  dipMagnitude = ${dipMagnitude.toFixed(4)}`);

  if (dipMagnitude < 0.01) {
    console.log(`  dipMagnitude < 0.01, RETURNING ${upwardStartFrame}`);
    return upwardStartFrame;
  }

  // Step 5: Check criteria (distanceToDip === 9 OR isLargeDip)
  const largeDipThreshold = 0.05;
  const isLargeDip = dipMagnitude >= largeDipThreshold;
  console.log(`\nStep 5: Check criteria`);
  console.log(`  distanceToDip === 9? ${distanceToDip === 9}`);
  console.log(`  isLargeDip (>= ${largeDipThreshold})? ${isLargeDip} (dipMagnitude=${dipMagnitude.toFixed(4)})`);

  if (distanceToDip !== 9 && !isLargeDip) {
    console.log(`  Neither condition met, RETURNING ${upwardStartFrame}`);
    return upwardStartFrame;
  }

  // Step 6: Apply adjustment with max cap
  const maxAdjustment = 9;
  const proposedAdjustment = upwardStartFrame - dipStartFrame;
  console.log(`\nStep 6: Apply adjustment`);
  console.log(`  proposedAdjustment = ${proposedAdjustment}`);
  console.log(`  maxAdjustment = ${maxAdjustment}`);

  if (proposedAdjustment > maxAdjustment) {
    const result = upwardStartFrame - maxAdjustment;
    console.log(`  Capping adjustment, RETURNING ${result}`);
    return result;
  }

  console.log(`  RETURNING dipStartFrame = ${dipStartFrame}`);
  return dipStartFrame;
}

// Analyze the dip continuity - is the descent smooth or oscillating?
function analyzeDipContinuity(videoPath, frameStart, frameEnd) {
  const poses = JSON.parse(fs.readFileSync(videoPath, 'utf8'));
  const RIGHT_WRIST = 16;

  const getRawWristY = (frameIdx) => {
    const frame = poses.frames.find(f => f.frameIndex === frameIdx);
    return frame?.landmarks[RIGHT_WRIST]?.y || null;
  };

  console.log(`\n=== Dip Continuity Analysis: ${videoPath} (frames ${frameStart}-${frameEnd}) ===`);

  let prevY = null;
  let continuousDownFrames = 0;
  let maxContinuousDownFrames = 0;
  let directionChanges = 0;
  let prevDirection = null;

  for (let i = frameStart; i <= frameEnd; i++) {
    const y = getRawWristY(i);
    if (y === null) continue;

    if (prevY !== null) {
      const velocity = y - prevY;
      const direction = velocity > 0.001 ? 'down' : (velocity < -0.001 ? 'up' : 'flat');

      if (direction === 'down') {
        continuousDownFrames++;
        maxContinuousDownFrames = Math.max(maxContinuousDownFrames, continuousDownFrames);
      } else {
        continuousDownFrames = 0;
      }

      if (prevDirection !== null && direction !== 'flat' && prevDirection !== 'flat' && direction !== prevDirection) {
        directionChanges++;
      }

      if (direction !== 'flat') {
        prevDirection = direction;
      }

      console.log(`  Frame ${i}: y=${y.toFixed(4)}, vel=${velocity.toFixed(4)}, dir=${direction}, contDown=${continuousDownFrames}`);
    }
    prevY = y;
  }

  console.log(`\n  Summary:`);
  console.log(`    - Max continuous downward frames: ${maxContinuousDownFrames}`);
  console.log(`    - Direction changes: ${directionChanges}`);
  console.log(`    - Is continuous dip (>=5 frames down, <3 changes)? ${maxContinuousDownFrames >= 5 && directionChanges < 3}`);

  return { maxContinuousDownFrames, directionChanges };
}

// 20201212: frames 75-84 (labeled start to upward start)
analyzeDipContinuity('test-data/20201212_134104/poses.json', 75, 84);

// chris-5: frames 55-63 (labeled start to upward start)
analyzeDipContinuity('test-data/chris-5/poses.json', 55, 63);

// zak-1 shot 6: frames ~528-540 (dip area)
analyzeDipContinuity('test-data/zak-1/poses.json', 520, 540);
