/**
 * What each v3 metric measures, as drawable geometry — so the Curry viewer
 * (and later the shot review) can show *where* a number comes from: the
 * angle arc at the knee, the hip→knee offset, the wrist-vs-head bar…
 *
 * Joints resolve exactly as `src/metrics/v3/signals.ts` reads them: arm
 * joints on the SHOOTING side, legs / hips / near shoulder / ear on the side
 * NEAREST the camera. Drawing happens in screen space through the review
 * framing projection (true aspect), so arcs and leans look like the numbers.
 *
 * Pure except `drawGeometry` (canvas).
 */

export type Side = "left" | "right";
export type Joint =
  | "wrist"
  | "elbow"
  | "shoulder"
  | "index"
  | "guideWrist"
  | "hip"
  | "knee"
  | "ankle"
  | "shoulderNear"
  | "head"
  | "ear"
  | "nose";

export type Geometry =
  /** Joint angle at the middle joint. */
  | { readonly kind: "angle"; readonly joints: readonly [Joint, Joint, Joint] }
  /** Line from → to, with a HORIZONTAL reference through `from` (pitch). */
  | { readonly kind: "pitch"; readonly from: Joint; readonly to: Joint }
  /** Line from → to, with a vertical reference through `from`. */
  | { readonly kind: "lean"; readonly from: Joint; readonly to: Joint }
  /** Horizontal offset of `a` from `b` (bar at a's height). */
  | { readonly kind: "offset"; readonly a: Joint; readonly b: Joint }
  /** Vertical gap between `a` and `b` (bar at a's x). */
  | { readonly kind: "height"; readonly a: Joint; readonly b: Joint }
  /** Straight distance a ↔ b. */
  | { readonly kind: "segment"; readonly a: Joint; readonly b: Joint }
  /** The joint's path over the metric's frames. */
  | { readonly kind: "path"; readonly joint: Joint }
  /** Timing between two events (shown as scrubber markers). */
  | { readonly kind: "timing" };

export type GeometryFamily = Geometry["kind"];

const ELBOW: Geometry = {
  kind: "angle",
  joints: ["shoulder", "elbow", "wrist"],
};
const KNEE: Geometry = { kind: "angle", joints: ["hip", "knee", "ankle"] };
const HIP: Geometry = {
  kind: "angle",
  joints: ["shoulderNear", "hip", "knee"],
};
const WRIST: Geometry = { kind: "angle", joints: ["elbow", "wrist", "index"] };
const SPINE: Geometry = { kind: "lean", from: "hip", to: "shoulderNear" };
const HEAD: Geometry = { kind: "pitch", from: "ear", to: "nose" };
const TIMING: Geometry = { kind: "timing" };

const BY_ID: Readonly<Record<string, readonly Geometry[]>> = {
  "load.spine_angle": [SPINE],
  "load.head_pitch": [HEAD],
  "load.knee_depth": [KNEE],
  "load.hip_over_knee": [{ kind: "offset", a: "hip", b: "knee" }],
  "load.knee_over_ankle": [{ kind: "offset", a: "knee", b: "ankle" }],
  "load.ball_drop": [{ kind: "height", a: "wrist", b: "hip" }],
  "load.elbow_angle": [ELBOW],
  "load.elbow_change": [ELBOW],
  "load.ball_close": [{ kind: "segment", a: "wrist", b: "hip" }],
  "load.t_drop_start": [TIMING],
  "load.t_drop_end": [TIMING],
  "load.t_elbow_bend": [TIMING],
  "rise.t_start": [TIMING],
  "rise.t_end": [TIMING],
  "rise.elbow_change_1": [ELBOW],
  "rise.elbow_change_2": [ELBOW],
  "rise.wrist_hinge_change_1": [WRIST],
  "rise.wrist_hinge_change_2": [WRIST],
  "rise.spine_change": [SPINE],
  "rise.t_spine_vs_knees": [TIMING],
  "rise.head_pitch_change": [HEAD],
  "setPoint.wrist_vs_head": [{ kind: "height", a: "wrist", b: "head" }],
  "setPoint.elbow_angle": [ELBOW],
  "setPoint.spine_angle": [SPINE],
  "setPoint.knee_angle": [KNEE],
  "setPoint.hip_angle": [HIP],
  "setPoint.hip_over_knee": [{ kind: "offset", a: "hip", b: "knee" }],
  "setPoint.knee_over_ankle": [{ kind: "offset", a: "knee", b: "ankle" }],
  "setPoint.head_pitch": [HEAD],
  "release.elbow_path": [{ kind: "path", joint: "elbow" }],
  "release.wrist_vs_head_end": [{ kind: "height", a: "wrist", b: "head" }],
  "release.guide_hand_dx": [{ kind: "offset", a: "guideWrist", b: "wrist" }],
  "release.guide_hand_dy": [{ kind: "height", a: "guideWrist", b: "wrist" }],
  "release.knee_change": [KNEE],
  "release.spine_change": [SPINE],
  "release.wrist_snap": [WRIST],
  "release.forward_drift": [
    { kind: "path", joint: "hip" },
    { kind: "path", joint: "head" },
  ],
  "release.t_legs_vs_arm": [TIMING],
  "detail.wrist_path_deviation": [{ kind: "path", joint: "wrist" }],
  "detail.elbow_height_vs_head": [{ kind: "height", a: "elbow", b: "head" }],
  "detail.release_vs_takeoff": [TIMING],
  "detail.follow_through_elbow_max": [ELBOW],
};

/** Geometry for a v3 metric id ([] when unknown — nothing drawn). */
export function geometryFor(id: string): readonly Geometry[] {
  return BY_ID[id] ?? [];
}

/** Ids with geometry (lint: must cover every metric with wording). */
export const GEOMETRY_IDS: readonly string[] = Object.keys(BY_ID);

/** The primary family drawn for an id (the canvas probe reports it). */
export function geometryFamily(id: string): GeometryFamily | null {
  return geometryFor(id)[0]?.kind ?? null;
}

const LM = {
  nose: 0,
  ear: { left: 7, right: 8 },
  shoulder: { left: 11, right: 12 },
  elbow: { left: 13, right: 14 },
  wrist: { left: 15, right: 16 },
  index: { left: 19, right: 20 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
} as const;

export interface GeometrySides {
  readonly shootingHand: Side;
  readonly nearSide: Side;
}

export interface Landmark {
  readonly x: number;
  readonly y: number;
  readonly visibility?: number;
}

/** Landmark index for a joint (head = near ear). */
export function jointIndex(j: Joint, s: GeometrySides): number {
  const guide: Side = s.shootingHand === "left" ? "right" : "left";
  switch (j) {
    case "wrist":
    case "elbow":
    case "shoulder":
    case "index":
      return LM[j][s.shootingHand];
    case "guideWrist":
      return LM.wrist[guide];
    case "hip":
    case "knee":
    case "ankle":
      return LM[j][s.nearSide];
    case "shoulderNear":
      return LM.shoulder[s.nearSide];
    case "head":
    case "ear":
      return LM.ear[s.nearSide];
    case "nose":
      return LM.nose;
  }
}

const MIN_VIS = 0.3;

export function resolveJoint(
  lm: readonly Landmark[] | null | undefined,
  j: Joint,
  s: GeometrySides,
): Landmark | null {
  const l = lm?.[jointIndex(j, s)];
  if (j === "head" && (!l || (l.visibility ?? 1) < MIN_VIS)) {
    const n = lm?.[LM.nose];
    return n && (n.visibility ?? 1) >= MIN_VIS ? n : null;
  }
  if (!l || (j !== "guideWrist" && (l.visibility ?? 1) < MIN_VIS)) return null;
  return l;
}

type Pt = { x: number; y: number };

/** Interior angle at b (degrees), on screen coordinates. */
export function screenAngle(a: Pt, b: Pt, c: Pt): number {
  const v1 = Math.atan2(a.y - b.y, a.x - b.x);
  const v2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(v1 - v2);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

export interface DrawOptions extends GeometrySides {
  readonly project: (l: Pt) => Pt;
  /** Landmarks over the metric's frames (for `path`). */
  readonly pathFrames?: readonly (readonly Landmark[] | null | undefined)[];
  readonly color?: string;
}

/**
 * Draws the geometry on `ctx`; returns the families actually drawn (a joint
 * may be missing on this frame, in which case nothing is drawn for it).
 */
export function drawGeometry(
  ctx: CanvasRenderingContext2D,
  items: readonly Geometry[],
  lm: readonly Landmark[] | null | undefined,
  o: DrawOptions,
): GeometryFamily[] {
  const color = o.color ?? "#fbbf24";
  const drawn: GeometryFamily[] = [];
  const P = (j: Joint, at = lm) => {
    const l = resolveJoint(at, j, o);
    return l ? o.project(l) : null;
  };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.font = "bold 13px system-ui, sans-serif";
  const label = (text: string, p: Pt) => {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgb(0 0 0 / 70%)";
    ctx.strokeText(text, p.x, p.y);
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  };
  const line = (a: Pt, b: Pt, dash: number[] = []) => {
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  for (const g of items) {
    switch (g.kind) {
      case "angle": {
        const [a, b, c] = g.joints.map((j) => P(j));
        if (!a || !b || !c) break;
        line(a, b);
        line(b, c);
        const r = Math.max(
          14,
          Math.min(
            40,
            0.35 *
              Math.min(
                Math.hypot(a.x - b.x, a.y - b.y),
                Math.hypot(c.x - b.x, c.y - b.y),
              ),
          ),
        );
        const t1 = Math.atan2(a.y - b.y, a.x - b.x);
        const t2 = Math.atan2(c.y - b.y, c.x - b.x);
        let d = t2 - t1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.arc(b.x, b.y, r, t1, t1 + d, d < 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        const mid = t1 + d / 2;
        label(`${screenAngle(a, b, c).toFixed(0)}°`, {
          x: b.x + Math.cos(mid) * (r + 8) - 10,
          y: b.y + Math.sin(mid) * (r + 8) + 4,
        });
        drawn.push("angle");
        break;
      }
      case "lean": {
        const a = P(g.from);
        const b = P(g.to);
        if (!a || !b) break;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        line(a, { x: a.x, y: a.y - len }, [5, 5]);
        line(a, b);
        const deg = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
        label(`${Math.abs(deg).toFixed(0)}°`, { x: b.x + 6, y: b.y - 6 });
        drawn.push("lean");
        break;
      }
      case "pitch": {
        const a = P(g.from);
        const b = P(g.to);
        if (!a || !b) break;
        // Horizontal reference toward where the face points, as long as the
        // ear → nose line, then the line itself.
        const len = Math.max(18, Math.hypot(b.x - a.x, b.y - a.y) * 1.6);
        const dir = b.x >= a.x ? 1 : -1;
        line(a, { x: a.x + dir * len, y: a.y }, [4, 4]);
        const k = len / Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y));
        line(a, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
        const deg =
          (Math.atan2(b.y - a.y, Math.abs(b.x - a.x)) * 180) / Math.PI;
        label(`${Math.abs(deg).toFixed(0)}° ${deg >= 0 ? "down" : "up"}`, {
          x: a.x + dir * (len + 4) - (dir < 0 ? 52 : 0),
          y: a.y - 6,
        });
        drawn.push("pitch");
        break;
      }
      case "offset": {
        const a = P(g.a);
        const b = P(g.b);
        if (!a || !b) break;
        line(b, { x: b.x, y: a.y }, [4, 4]);
        line({ x: b.x, y: a.y }, a);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        drawn.push("offset");
        break;
      }
      case "height": {
        const a = P(g.a);
        const b = P(g.b);
        if (!a || !b) break;
        line({ x: b.x, y: b.y }, { x: a.x, y: b.y }, [4, 4]);
        line({ x: a.x, y: b.y }, a);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        drawn.push("height");
        break;
      }
      case "segment": {
        const a = P(g.a);
        const b = P(g.b);
        if (!a || !b) break;
        line(a, b);
        drawn.push("segment");
        break;
      }
      case "path": {
        const pts = (o.pathFrames ?? [])
          .map((f) => P(g.joint, f))
          .filter((p): p is Pt => p !== null);
        if (pts.length < 2) break;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        for (const p of [pts[0]!, pts.at(-1)!]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
        const now = P(g.joint);
        if (now) {
          ctx.beginPath();
          ctx.arc(now.x, now.y, 6, 0, 2 * Math.PI);
          ctx.stroke();
        }
        drawn.push("path");
        break;
      }
      case "timing":
        drawn.push("timing");
        break;
    }
  }
  ctx.restore();
  return drawn;
}
