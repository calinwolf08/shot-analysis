/**
 * Pure canvas drawing for a MediaPipe pose skeleton, shared by the
 * progress key-frame viewer and the live-practice tracking overlay.
 */

export interface SkeletonLandmark {
  x: number;
  y: number;
  visibility: number;
}

/** MediaPipe pose connection pairs (subset covering the full body). */
export const POSE_CONNECTIONS: readonly [number, number][] = [
  [11, 12], // shoulders
  [11, 13],
  [13, 15], // left arm
  [12, 14],
  [14, 16], // right arm
  [11, 23],
  [12, 24], // torso
  [23, 24], // hips
  [23, 25],
  [25, 27], // left leg
  [24, 26],
  [26, 28], // right leg
  [27, 31],
  [28, 32], // feet
  [0, 11],
  [0, 12], // head to shoulders (approx neck)
];

export interface DrawSkeletonOptions {
  strokeStyle?: string;
  jointStyle?: string;
  lineWidth?: number;
  jointRadius?: number;
  minVisibility?: number;
  /**
   * Maps a normalized landmark to canvas pixels. Defaults to scaling
   * straight onto the full canvas; overlays that crop (object-fit: cover)
   * supply their own mapping.
   */
  project?: (l: SkeletonLandmark) => { x: number; y: number };
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly SkeletonLandmark[],
  width: number,
  height: number,
  opts: DrawSkeletonOptions = {},
): void {
  const minVisibility = opts.minVisibility ?? 0.3;
  const project =
    opts.project ??
    ((l: SkeletonLandmark) => ({ x: l.x * width, y: l.y * height }));

  const pt = (i: number) => {
    const l = landmarks[i];
    if (!l || l.visibility < minVisibility) return null;
    return project(l);
  };

  ctx.strokeStyle = opts.strokeStyle ?? "#ff7a29";
  ctx.lineWidth = opts.lineWidth ?? 3;
  ctx.lineCap = "round";
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = pt(a);
    const pb = pt(b);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.fillStyle = opts.jointStyle ?? "#f2f4f8";
  const radius = opts.jointRadius ?? 3;
  for (let i = 0; i < landmarks.length; i++) {
    const point = pt(i);
    if (!point) continue;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
