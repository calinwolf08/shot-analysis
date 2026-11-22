/**
 * Where a body part should be for a v3 metric to score 0, as drawable screen
 * geometry: the target zone shown when a metric is picked in shot review.
 *
 * Two styles for angle-like metrics (joint angles, torso lean, head pitch):
 *  - "wedge": joint angles — at the joint, the target angle centred on the
 *             measured angle (one green sliver per side, where each side of
 *             the angle should be); lean / pitch — the band from the vertical
 *             / horizontal reference,
 *  - "rect":  joint angles — a box where the JOINT itself (knee for knee bend,
 *             elbow for elbow angle) belongs across the band, plus a dashed
 *             ghost limb mid-band; lean / pitch — a box where the shoulder /
 *             nose belongs.
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
      /** Filled sectors (screen angles, radians, canvas convention). */
      readonly sectors: readonly { from: number; to: number }[];
    }
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      /** A dashed "ghost" limb in the middle of the target range. */
      readonly ghost?: readonly Pt[];
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

/**
 * Which end of an angle triple moves (0 = first, 2 = last); the other end is
 * the anchor that stays put while the joint bends.
 */
const MOVING: Readonly<Record<string, 0 | 2>> = {
  "hip,knee,ankle": 0, // knee bend: feet planted, hips rise / sink
  "shoulderNear,hip,knee": 0, // hip angle: knee stays, the torso moves
  "shoulder,elbow,wrist": 2, // elbow: shoulder stays, the ball moves
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
    ? { kind: "wedge", center, radius, sectors: [{ from: a0, to: a1 }] }
    : bounds(arcPoints(center, radius, a0, a1));
}

/**
 * Where the middle joint of a limb lands for interior angle `deg`: the
 * anchor end stays put, the other end slides along the anchor→end line
 * (feet planted while the hips rise/sink; shoulder fixed while the forearm
 * folds), both segment lengths kept, the joint bending to the same side.
 */
function limbAt(
  anchor: Pt,
  joint: Pt,
  end: Pt,
  deg: number,
): { joint: Pt; end: Pt } | null {
  const l1 = Math.hypot(joint.x - anchor.x, joint.y - anchor.y);
  const l2 = Math.hypot(end.x - joint.x, end.y - joint.y);
  const dx = end.x - anchor.x;
  const dy = end.y - anchor.y;
  const dl = Math.hypot(dx, dy);
  if (l1 < 1 || l2 < 1 || dl < 1) return null;
  const ux = dx / dl;
  const uy = dy / dl;
  const d = Math.sqrt(
    Math.max(1e-6, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(deg * RAD)),
  );
  const cosA = Math.max(
    -1,
    Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)),
  );
  const alpha = Math.acos(cosA);
  // Bend to the side the joint is on now.
  const side =
    ux * (joint.y - anchor.y) - uy * (joint.x - anchor.x) < 0 ? -1 : 1;
  const ca = Math.cos(side * alpha);
  const sa = Math.sin(side * alpha);
  return {
    joint: {
      x: anchor.x + l1 * (ux * ca - uy * sa),
      y: anchor.y + l1 * (ux * sa + uy * ca),
    },
    end: { x: anchor.x + ux * d, y: anchor.y + uy * d },
  };
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
      const mv = MOVING[g.joints.join(",")];
      if (mv === undefined) return null;
      const a = P(g.joints[0]);
      const b = P(g.joints[1]);
      const c = P(g.joints[2]);
      if (!a || !b || !c) return null;
      let base = 0;
      if (change) {
        const a0 = P(g.joints[0], o.firstLm);
        const b0 = P(g.joints[1], o.firstLm);
        const c0 = P(g.joints[2], o.firstLm);
        if (!a0 || !b0 || !c0) return null;
        base = interior(a0, b0, c0);
      }
      const lo = clampDeg(base + Math.min(m.passMin, m.passMax));
      const hi = clampDeg(base + Math.max(m.passMin, m.passMax));
      if (o.style === "wedge") {
        // At the joint, the size of the measured arc: the target angle
        // centred on the current angle's bisector — each side of the angle
        // should land in its green sliver.
        const t1 = Math.atan2(a.y - b.y, a.x - b.x);
        const t2 = Math.atan2(c.y - b.y, c.x - b.x);
        let d = t2 - t1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const bis = t1 + d / 2;
        const s = d < 0 ? -1 : 1;
        const radius = Math.max(
          26,
          Math.min(
            64,
            0.6 *
              Math.min(
                Math.hypot(a.x - b.x, a.y - b.y),
                Math.hypot(c.x - b.x, c.y - b.y),
              ),
          ),
        );
        const h = (x: number) => (x / 2) * RAD;
        return {
          kind: "wedge",
          center: b,
          radius,
          sectors: [
            { from: bis - s * h(hi), to: bis - s * h(lo) },
            { from: bis + s * h(lo), to: bis + s * h(hi) },
          ],
        };
      }
      // Where the joint itself belongs across the band (anchor end fixed).
      const anchor = mv === 0 ? c : a;
      const end = mv === 0 ? a : c;
      const pts: Pt[] = [];
      for (let i = 0; i <= 12; i++) {
        const r = limbAt(anchor, b, end, lo + ((hi - lo) * i) / 12);
        if (r) pts.push(r.joint);
      }
      const mid = limbAt(anchor, b, end, (lo + hi) / 2);
      if (pts.length === 0 || !mid) return null;
      return { ...bounds(pts), ghost: [anchor, mid.joint, mid.end] } as Zone;
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
    for (const sec of z.sectors) {
      let d = sec.to - sec.from;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      ctx.moveTo(z.center.x, z.center.y);
      ctx.arc(z.center.x, z.center.y, z.radius, sec.from, sec.from + d, d < 0);
      ctx.closePath();
    }
  } else {
    const r = Math.min(8, z.w / 3, z.h / 3);
    ctx.roundRect(z.x, z.y, z.w, z.h, r);
  }
  ctx.globalAlpha = 0.22;
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.stroke();
  if (z.kind === "rect" && z.ghost && z.ghost.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.moveTo(z.ghost[0]!.x, z.ghost[0]!.y);
    for (const p of z.ghost.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.restore();
}
