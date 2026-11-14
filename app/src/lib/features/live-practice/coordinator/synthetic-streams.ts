/**
 * Synthetic LandmarkFrame stream builders for coordinator tests: still
 * poses, shot-like wrist arcs, dribble noise, and pose dropouts — all
 * deterministic, no camera or MediaPipe involved.
 */
import type { LandmarkFrame } from "$lib/features/analysis";

export interface StreamCursor {
  fps: number;
  frameIndex: number;
  timestamp: number;
}

export function makeCursor(fps = 30): StreamCursor {
  return { fps, frameIndex: 0, timestamp: 0 };
}

/** A plausible standing pose: 33 landmarks, all visible. */
function basePose(): {
  x: number;
  y: number;
  z: number;
  visibility: number;
  confidence: number;
}[] {
  const landmarks = [];
  for (let i = 0; i < 33; i++) {
    // Head at the top, feet at the bottom — indexes roughly follow the
    // MediaPipe layout vertically.
    const y = 0.15 + (i / 32) * 0.75;
    landmarks.push({ x: 0.5, y, z: 0, visibility: 0.95, confidence: 0.95 });
  }
  // Pin the wrists somewhere hand-like.
  landmarks[15] = {
    x: 0.45,
    y: 0.55,
    z: 0,
    visibility: 0.95,
    confidence: 0.95,
  };
  landmarks[16] = {
    x: 0.55,
    y: 0.55,
    z: 0,
    visibility: 0.95,
    confidence: 0.95,
  };
  return landmarks;
}

function frameAt(
  cursor: StreamCursor,
  wristY: number | null,
  wristIndex: number,
): LandmarkFrame {
  const msPerFrame = 1000 / cursor.fps;
  const frame: LandmarkFrame =
    wristY === null
      ? {
          frameIndex: cursor.frameIndex,
          timestamp: cursor.timestamp,
          poseConfidence: 0,
          landmarks: null,
        }
      : (() => {
          const landmarks = basePose();
          landmarks[wristIndex] = { ...landmarks[wristIndex]!, y: wristY };
          return {
            frameIndex: cursor.frameIndex,
            timestamp: cursor.timestamp,
            poseConfidence: 0.9,
            landmarks,
          };
        })();
  cursor.frameIndex += 1;
  cursor.timestamp += msPerFrame;
  return frame;
}

/** Standing still (wrist at rest height) for durationMs. */
export function stillPose(
  cursor: StreamCursor,
  durationMs: number,
  wristIndex = 16,
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  const count = Math.ceil((durationMs / 1000) * cursor.fps);
  for (let i = 0; i < count; i++) {
    frames.push(frameAt(cursor, 0.55, wristIndex));
  }
  return frames;
}

/** No detected pose for durationMs. */
export function noPose(
  cursor: StreamCursor,
  durationMs: number,
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  const count = Math.ceil((durationMs / 1000) * cursor.fps);
  for (let i = 0; i < count; i++) {
    frames.push(frameAt(cursor, null, 16));
  }
  return frames;
}

/**
 * A shot-like wrist arc: fast rise (~400 ms) from rest to overhead, brief
 * hold, then descent back to rest. Rise velocity ≈ 0.9 units/s — well
 * above the default trigger threshold.
 */
export function shotArc(
  cursor: StreamCursor,
  wristIndex = 16,
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  const rest = 0.55;
  const top = 0.18;
  const riseFrames = Math.round(cursor.fps * 0.4);
  const holdFrames = Math.round(cursor.fps * 0.25);
  const fallFrames = Math.round(cursor.fps * 0.5);
  for (let i = 0; i < riseFrames; i++) {
    const t = (i + 1) / riseFrames;
    frames.push(frameAt(cursor, rest + (top - rest) * t, wristIndex));
  }
  for (let i = 0; i < holdFrames; i++) {
    frames.push(frameAt(cursor, top, wristIndex));
  }
  for (let i = 0; i < fallFrames; i++) {
    const t = (i + 1) / fallFrames;
    frames.push(frameAt(cursor, top + (rest - top) * t, wristIndex));
  }
  return frames;
}

/**
 * Dribble-like noise: rapid small wrist pumps below waist. The bursts are
 * fast enough to cross the rise-velocity trigger but contain no shot.
 */
export function dribbleNoise(
  cursor: StreamCursor,
  durationMs: number,
  wristIndex = 16,
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  const count = Math.ceil((durationMs / 1000) * cursor.fps);
  for (let i = 0; i < count; i++) {
    // ~3 Hz pump between 0.55 and 0.70 (downward of rest — a dribble).
    const phase = (cursor.timestamp / 1000) * 3 * Math.PI * 2;
    const y = 0.625 + 0.075 * Math.sin(phase);
    frames.push(frameAt(cursor, y, wristIndex));
  }
  return frames;
}

/**
 * Wrist rising at a constant upward velocity (normalized units/s) for
 * durationMs. A sub-trigger velocity produces a near-miss rather than a
 * rep start.
 */
export function wristRise(
  cursor: StreamCursor,
  velocity: number,
  durationMs: number,
  wristIndex = 16,
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = [];
  const count = Math.ceil((durationMs / 1000) * cursor.fps);
  const perFrame = velocity / cursor.fps;
  let y = 0.55;
  for (let i = 0; i < count; i++) {
    y -= perFrame; // screen y is down; rising = decreasing y
    frames.push(frameAt(cursor, y, wristIndex));
  }
  return frames;
}
