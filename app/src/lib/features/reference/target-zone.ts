/**
 * Where a body part should be for a v3 metric to score 0, as drawable screen
 * geometry: the target zone shown when a metric is picked in shot review.
 *
 * Two styles for angle-like metrics (joint angles, torso lean, head pitch):
 *  - "wedge": the sector of target angles at the pivot joint,
 *  - "rect":  a box around where the MOVING joint lands across the target
 *             range (hips for knee bend, wrist for elbow, shoulder for lean…).
 * Offsets and heights are a box in either style (the band along x / y).
 * Change metrics (elbow change, spine change…) are relative: the target is the
 * angle at the change's first frame plus the band, drawn on its last frame.
 * Paths, segments and timing have no zone here (timing is a scrubber band).
 *
 * Pure: returns geometry; `drawTargetZone` paints it.
 */
import {
  geometryFor,
  resolveJoint,
  type GeometrySides,
  type Joint,
  type Landmark,
} from "./metric-geometry";

type Pt = { x: number; y: number };

export type ZoneStyle = "wedge" | "rect";

export type Zone =
  | {
      readonly kind: "wedge";
      readonly center: Pt;
      readonly radius: number;
      /** Screen angles (radians, canvas convention) of the band's edges. */
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    };

export interface ZoneMetric {
  readonly id: string;
  readonly passMin: number;
  readonly passMax: number;
  readonly frames: readonly number[];
}

export interface ZoneInput extends GeometrySides {
  readonly project: (l: Pt) => Pt;
  /** Landmarks on the frame being shown (the metric's last frame). */
  readonly lm: readonly Landmark[] | null | undefined;
  /** Landmarks on the metric's first frame (change metrics' baseline). */
  readonly firstLm?: readonly Landmark[] | null;
  readonly style: ZoneStyle;
  /** The shot's facing (+1 = screen-right), as the metrics computed it. */
  readonly facing?: 1 | -1;
}

/** Which joint of an angle triple moves into the zone (0 = first, 2 = last). */
const MOVING: Readonly<Record<string, 0 | 2>> = {
  "hip,knee,ankle": 0, // knee bend: hips drop, the shin stays planted
  "shoulderNear,hip,knee": 0, // hip angle: the torso moves
  "shoulder,elbow,wrist": 2, // elbow: the forearm / ball moves
  "elbow,wrist,index": 2, // wrist hinge: the hand moves
};

/** Body-length units, as screen segments (matches metrics.ts `norm`). */
const UNIT_SEGMENT: Readonly<Record<string, [Joint, Joint]>> = {
  thigh: ["hip", "knee"],
  shin: ["knee", "ankle"],
  torso: ["shoulderNear", "hip"],
  forearm: ["elbow", "wrist"],
};

/** Which body-length unit each offset / height metric is divided by. */
const UNIT_BY_ID: Readonly<Record<string, string>> = {
  "load.hip_over_knee": "thigh",
  "setPoint.hip_over_knee": "thigh",
  "load.knee_over_ankle": "shin",
  "setPoint.knee_over_ankle": "shin",
  "load.ball_drop": "torso",
  "setPoint.wrist_vs_head": "torso",
  "release.wrist_vs_head_end": "torso",
  "release.guide_hand_dx": "forearm",
  "release.guide_hand_dy": "forearm",
};

const PAD = 10;
const MIN_BOX = 22;
const RAD = Math.PI / 180;

function isChange(id: string): boolean {
  return /_change(_\d)?$/.test(id);
}

/** +1 when the player faces screen-right (nose ahead of the ear). */
export function facingOf(
  lm: readonly Landmark[] | null | undefined,
  s: GeometrySides,
): 1 | -1 {
  const n = resolveJoint(lm, "nose", s);
  const e = resolveJoint(lm, "ear", s);
  return n && e && n.x < e.x ? -1 : 1;
}

function bounds(pts: readonly Pt[], pad = PAD): Zone {
  let x0 = Math.min(...pts.map((p) => p.x)) - pad;
  let x1 = Math.max(...pts.map((p) => p.x)) + pad;
  let y0 = Math.min(...pts.map((p) => p.y)) - pad;
  let y1 = Math.max(...pts.map((p) => p.y)) + pad;
  if (x1 - x0 < MIN_BOX)
    [x0, x1] = [(x0 + x1 - MIN_BOX) / 2, (x0 + x1 + MIN_BOX) / 2];
  if (y1 - y0 < MIN_BOX)
    [y0, y1] = [(y0 + y1 - MIN_BOX) / 2, (y0 + y1 + MIN_BOX) / 2];
  return { kind: "rect", x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The arc of positions at `radius` from `c` between screen angles a0..a1. */
function arcPoints(c: Pt, radius: number, a0: number, a1: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((a1 - a0) * i) / 12;
    pts.push({ x: c.x + Math.cos(a) * radius, y: c.y + Math.sin(a) * radius });
  }
  return pts;
}

/** Wedge or box for a band of screen angles around a pivot. */
function angular(
  style: ZoneStyle,
  center: Pt,
  radius: number,
  a0: number,
  a1: number,
): Zone {
  return style === "wedge"
    ? { kind: "wedge", center, radius, from: a0, to: a1 }
    : bounds(arcPoints(center, radius, a0, a1));
}

/**
 * The target zone for a metric on the shown frame, or null (no zone for this
 * kind of metric, or a joint isn't visible).
 */
export function targetZone(m: ZoneMetric, o: ZoneInput): Zone | null {
  const g = geometryFor(m.id)[0];
  if (!g) return null;
  const P = (j: Joint, at = o.lm) => {
    const l = resolveJoint(at, j, o);
    return l ? o.project(l) : null;
  };
  const change = isChange(m.id);
  if (change && m.frames.length < 2) return null;
  const facing = o.facing ?? facingOf(o.lm, o);

  switch (g.kind) {
    case "angle": {
      const key = g.joints.join(",");
      const mv = MOVING[key];
      if (mv === undefined) return null;
      const fixedJ = g.joints[mv === 0 ? 2 : 0];
      const movingJ = g.joints[mv];
      const pivot = P(g.joints[1]);
      const fixed = P(fixedJ);
      const moving = P(movingJ);
      if (!pivot || !fixed || !moving) return null;
      let base = 0;
      if (change) {
        const a = P(g.joints[0], o.firstLm);
        const b = P(g.joints[1], o.firstLm);
        const c = P(g.joints[2], o.firstLm);
        if (!a || !b || !c) return null;
        base = interior(a, b, c);
      }
      const tFixed = Math.atan2(fixed.y - pivot.y, fixed.x - pivot.x);
      const tMoving = Math.atan2(moving.y - pivot.y, moving.x - pivot.x);
      let d = tMoving - tFixed;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const sign = d < 0 ? -1 : 1;
      const lo = clampDeg(base + m.passMin);
      const hi = clampDeg(base + m.passMax);
      const radius = Math.hypot(moving.x - pivot.x, moving.y - pivot.y);
      return angular(
        o.style,
        pivot,
        radius,
        tFixed + sign * lo * RAD,
        tFixed + sign * hi * RAD,
      );
    }
    case "lean": {
      // Lean from vertical, + = toward facing (signals.ts spineLean).
      const hip = P(g.from);
      const top = P(g.to);
      if (!hip || !top) return null;
      let base = 0;
      if (change) {
        const h0 = P(g.from, o.firstLm);
        const t0 = P(g.to, o.firstLm);
        if (!h0 || !t0) return null;
        base =
          (Math.atan2(facing * (t0.x - h0.x), h0.y - t0.y) * 180) / Math.PI;
      }
      const toScreen = (lean: number) =>
        Math.atan2(-Math.cos(lean * RAD), facing * Math.sin(lean * RAD));
      const radius = Math.hypot(top.x - hip.x, top.y - hip.y);
      return angular(
        o.style,
        hip,
        radius,
        toScreen(base + m.passMin),
        toScreen(base + m.passMax),
      );
    }
    case "pitch": {
      // vs horizontal toward facing, + = nose below the ear.
      const ear = P(g.from);
      const nose = P(g.to);
      if (!ear || !nose) return null;
      let base = 0;
      if (change) {
        const e0 = P(g.from, o.firstLm);
        const n0 = P(g.to, o.firstLm);
        if (!e0 || !n0) return null;
        base =
          (Math.atan2(n0.y - e0.y, facing * (n0.x - e0.x)) * 180) / Math.PI;
      }
      const toScreen = (p: number) =>
        Math.atan2(Math.sin(p * RAD), facing * Math.cos(p * RAD));
      const radius = Math.max(
        24,
        Math.hypot(nose.x - ear.x, nose.y - ear.y) * 1.6,
      );
      return angular(
        o.style,
        ear,
        radius,
        toScreen(base + m.passMin),
        toScreen(base + m.passMax),
      );
    }
    case "offset":
    case "height": {
      const a = P(g.a);
      const b = P(g.b);
      const seg = UNIT_SEGMENT[UNIT_BY_ID[m.id] ?? ""];
      const s0 = seg ? P(seg[0]) : null;
      const s1 = seg ? P(seg[1]) : null;
      if (!a || !b || !s0 || !s1) return null;
      const len = Math.hypot(s1.x - s0.x, s1.y - s0.y);
      if (g.kind === "offset") {
        // value = facing · (a.x − b.x) / len
        const x0 = b.x + facing * m.passMin * len;
        const x1 = b.x + facing * m.passMax * len;
        return padBox(x0, x1, a.y - PAD * 1.5, a.y + PAD * 1.5);
      }
      // value = (b.y − a.y) / len  (+ = a higher)
      const y0 = b.y - m.passMin * len;
      const y1 = b.y - m.passMax * len;
      return padBox(a.x - PAD * 1.5, a.x + PAD * 1.5, y0, y1);
    }
    default:
      return null;
  }
}

function padBox(x0: number, x1: number, y0: number, y1: number): Zone {
  const lx = Math.min(x0, x1);
  const hx = Math.max(x0, x1);
  const ly = Math.min(y0, y1);
  const hy = Math.max(y0, y1);
  const w = Math.max(hx - lx, 6);
  const h = Math.max(hy - ly, 6);
  return {
    kind: "rect",
    x: (lx + hx - w) / 2,
    y: (ly + hy - h) / 2,
    w,
    h,
  };
}

function clampDeg(d: number): number {
  return Math.max(0, Math.min(180, d));
}

function interior(a: Pt, b: Pt, c: Pt): number {
  const v1 = Math.atan2(a.y - b.y, a.x - b.x);
  const v2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(v1 - v2);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

/** Paints a zone: translucent fill + dashed outline. */
export function drawTargetZone(
  ctx: CanvasRenderingContext2D,
  z: Zone,
  color = "#34d399",
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  if (z.kind === "wedge") {
    let d = z.to - z.from;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    ctx.moveTo(z.center.x, z.center.y);
    ctx.arc(z.center.x, z.center.y, z.radius, z.from, z.from + d, d < 0);
    ctx.closePath();
  } else {
    const r = Math.min(8, z.w / 3, z.h / 3);
    ctx.roundRect(z.x, z.y, z.w, z.h, r);
  }
  ctx.globalAlpha = 0.22;
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.stroke();
  ctx.restore();
}
