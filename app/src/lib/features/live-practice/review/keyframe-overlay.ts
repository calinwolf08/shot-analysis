/**
 * Shot review overlay for the keyframe checks (docs/keyframe-review-plan.md):
 * where each check's dot sits (on a joint), where that joint SHOULD be for
 * the check to score 0 (a box, band or wedge), dots sharing a joint drawn as
 * a stack, and free space for the callout.
 *
 * Geometry is worked out in the space the checks were measured in (x times
 * `xScale`, y in frame heights; body lengths from the stored checks) and
 * returned as landmark coordinates (0..1 of the frame), so the caller projects
 * it with the same transform as the video / skeleton.
 *
 * Targets per check:
 *  - hand height: a box at the wrist spanning the height band;
 *  - ball close: a box at the wrist spanning the distance-in-front band;
 *  - wrist hinge: a box where the fingertip should point (forearm held);
 *  - elbow / knee bend: a box where the joint would be at the target angle
 *    with both limb ends held (knee: ankle planted, hip on the ankle→hip line;
 *    elbow: shoulder fixed, wrist on the shoulder→wrist line);
 *  - back: a wedge from the hip centre (the allowed lean);
 *  - hips over knees: a vertical band from just above the hip to the ground.
 *
 * Pure.
 */
import type {
  CheckId,
  Keyframe,
  ShotKeyframes,
} from "basketball-shot-analysis";

export interface Pt {
  readonly x: number;
  readonly y: number;
}
export interface OverlayLandmark extends Pt {
  readonly visibility: number;
}

export type Zone =
  | {
      readonly kind: "box";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }
  | {
      readonly kind: "band";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }
  | { readonly kind: "wedge"; readonly pts: readonly [Pt, Pt, Pt] };

export type JointName = "wrist" | "elbow" | "knee" | "shoulders" | "hip";

export interface CheckGeometry {
  readonly id: string;
  readonly joint: JointName | null;
  /** The dot (null: nothing to place it on, e.g. the hold). */
  readonly dot: Pt | null;
  /** Where the joint should be (null: not drawable). */
  readonly zone: Zone | null;
  /** What the check measures, drawn in white when selected. */
  readonly limbs: readonly Pt[];
}

/** What the overlay needs from a check result. */
export interface OverlayCheck {
  readonly id: string;
  readonly keyframe: Keyframe;
  readonly check: CheckId;
  readonly passMin: number;
  readonly passMax: number;
  readonly score: number | null;
}

/** Smallest half-size of a box, frame heights (so it's always visible). */
export const MIN_HALF = 0.012;
const VIS = 0.3;

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
const FOOT = [27, 28, 29, 30, 31, 32];

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Pt) => Math.hypot(v.x, v.y);
const unit = (v: Pt): Pt => {
  const n = len(v) || 1;
  return { x: v.x / n, y: v.y / n };
};
const rot = (v: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const clampDeg = (d: number) => Math.max(1, Math.min(179.5, d));

/** Bounding box of points as a zone (padded to `MIN_HALF`). */
/**
 * Widens [lo, hi] to at least 2 × MIN_HALF. The extra goes on the side away
 * from `v` (the joint), so padding never swallows a joint that is outside
 * the band; a joint inside it is padded around evenly.
 */
function pad(lo: number, hi: number, v: number | null): [number, number] {
  const need = 2 * MIN_HALF - (hi - lo);
  if (need <= 0) return [lo, hi];
  if (v !== null && v < lo) return [lo, hi + need];
  if (v !== null && v > hi) return [lo - need, hi];
  return [lo - need / 2, hi + need / 2];
}

/** Bounding box of points as a zone, padded (away from `avoid`) to be visible. */
function boxOf(
  pts: readonly Pt[],
  kind: "box" | "band" = "box",
  avoid: Pt | null = null,
): Zone {
  const [x0, x1] = pad(
    Math.min(...pts.map((p) => p.x)),
    Math.max(...pts.map((p) => p.x)),
    avoid?.x ?? null,
  );
  const [y0, y1] = pad(
    Math.min(...pts.map((p) => p.y)),
    Math.max(...pts.map((p) => p.y)),
    avoid?.y ?? null,
  );
  return { kind, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Samples a band [lo, hi] (9 steps). */
const steps = (lo: number, hi: number) =>
  Array.from({ length: 9 }, (_, k) => lo + ((hi - lo) * k) / 8);

/**
 * Where joint J goes when its angle is `deg`, A fixed, B kept on the A→B
 * line (limb lengths la = |AJ|, lb = |JB|), on J's current side.
 */
export function jointAt(A: Pt, B: Pt, J: Pt, deg: number): Pt {
  const la = len(sub(J, A));
  const lb = len(sub(B, J));
  const u = unit(sub(B, A));
  const side = cross(u, sub(J, A)) >= 0 ? 1 : -1;
  const t = (clampDeg(deg) * Math.PI) / 180;
  const D = Math.sqrt(
    Math.max(0, la * la + lb * lb - 2 * la * lb * Math.cos(t)),
  );
  const a = D > 0 ? (la * la - lb * lb + D * D) / (2 * D) : 0;
  const h = Math.sqrt(Math.max(0, la * la - a * a));
  const n = { x: -u.y * side, y: u.x * side };
  return { x: A.x + u.x * a + n.x * h, y: A.y + u.y * a + n.y * h };
}

/** Where the end of a limb from J points when the angle at J is `deg` (ref direction J→R held). */
export function endAt(J: Pt, R: Pt, E: Pt, deg: number): Pt {
  const u = unit(sub(R, J));
  const s = cross(u, sub(E, J)) >= 0 ? 1 : -1;
  const L = len(sub(E, J));
  const d = rot(u, s * clampDeg(deg));
  return { x: J.x + d.x * L, y: J.y + d.y * L };
}

/**
 * Every check's dot, zone and limbs at one keyframe. `lm` = the landmarks
 * on the keyframe's frame; `shot` = the stored keyframe checks (sides,
 * facing, body lengths); `checks` = the enabled results at that keyframe.
 */
export function checkGeometry(
  lm: readonly OverlayLandmark[],
  shot: Pick<
    ShotKeyframes,
    "facing" | "nearSide" | "shootingSide" | "xScale" | "lengths" | "centreLine"
  > &
    Partial<Pick<ShotKeyframes, "points">>,
  checks: readonly OverlayCheck[],
): Record<string, CheckGeometry> {
  const xs = shot.xScale;
  const toBody = (l: Pt): Pt => ({ x: l.x * xs, y: l.y });
  const toLm = (p: Pt): Pt => ({ x: p.x / xs, y: p.y });
  const raw = (i: number) => lm[i];
  const at = (i: number, minVis = 0.05): Pt | null => {
    const l = raw(i);
    return l && l.visibility >= minVis ? toBody(l) : null;
  };
  const shoot = shot.shootingSide;
  const near = shot.nearSide;
  const far = near === "left" ? "right" : "left";
  const rWr = at(LM.wrist[shoot]);
  const rEl = at(LM.elbow[shoot]);
  const rSh = at(LM.shoulder[shoot]);
  const rIx = at(LM.index[shoot]);
  const rHip = at(LM.hip[near]);
  const rKn = at(LM.knee[near]);
  const rAn = at(LM.ankle[near]);
  const hipFar = at(LM.hip[far]);
  const shNear = at(LM.shoulder[near]);
  const shFar = at(LM.shoulder[far]);
  const rHc = shot.centreLine && rHip && hipFar ? mid(rHip, hipFar) : rHip;
  const rSc = shot.centreLine && shNear && shFar ? mid(shNear, shFar) : shNear;
  const rHead = at(LM.ear[near], VIS) ?? at(LM.nose, VIS);
  // The joints the checks were measured from (smoothed, at the exact
  // keyframe), when stored: dots and zones then match the scores exactly.
  const kp = checks[0] ? shot.points?.[checks[0].keyframe] : null;
  const J = {
    wr: kp ? kp.wrist : rWr,
    el: kp ? kp.elbow : rEl,
    sh: kp ? kp.shoulder : rSh,
    ix: kp ? kp.index : rIx,
    hip: kp ? kp.hip : rHip,
    kn: kp ? kp.knee : rKn,
    an: kp ? kp.ankle : rAn,
    hc: kp ? kp.hipCentre : rHc,
    sc: kp ? kp.shoulderCentre : rSc,
    head: kp ? kp.head : rHead,
  };
  const torso = shot.lengths.torso;
  const thigh = shot.lengths.thigh;
  const f = shot.facing;
  const feet = FOOT.map((i) => at(i)).filter((p): p is Pt => p !== null);
  const ground = feet.length
    ? Math.max(...feet.map((p) => p.y))
    : (rAn?.y ?? null);

  const out: Record<string, CheckGeometry> = {};
  const put = (
    c: OverlayCheck,
    joint: JointName | null,
    dot: Pt | null,
    zone: Zone | null,
    limbs: (Pt | null)[],
  ) => {
    const conv = (z: Zone | null): Zone | null => {
      if (!z) return null;
      if (z.kind === "wedge")
        return {
          kind: "wedge",
          pts: z.pts.map(toLm) as unknown as [Pt, Pt, Pt],
        };
      return { ...z, x: z.x / xs, w: z.w / xs };
    };
    out[c.id] = {
      id: c.id,
      joint,
      dot: dot ? toLm(dot) : null,
      zone: conv(zone),
      limbs: limbs.every((p) => p !== null) ? (limbs as Pt[]).map(toLm) : [],
    };
  };

  const early = (k: Keyframe) => k === "setup" || k === "load";
  const { wr, el, sh, ix, kn, an, hc, sc } = J;
  for (const c of checks) {
    switch (c.check) {
      case "hand_height": {
        // Where the hands should be vertically (vs hips early, head later).
        const ref = early(c.keyframe) ? hc : J.head;
        const zone =
          wr && ref && torso
            ? boxOf(
                [
                  { x: wr.x, y: ref.y - c.passMax * torso },
                  { x: wr.x, y: ref.y - c.passMin * torso },
                ],
                "box",
                wr,
              )
            : null;
        put(c, "wrist", wr, zone, [ref, wr]);
        break;
      }
      case "ball_close": {
        // How far in front of the hips the hands should be.
        const zone =
          wr && hc && torso
            ? boxOf(
                [
                  { x: hc.x + f * c.passMin * torso, y: wr.y },
                  { x: hc.x + f * c.passMax * torso, y: wr.y },
                ],
                "box",
                wr,
              )
            : null;
        put(c, "wrist", wr, zone, [hc, wr]);
        break;
      }
      case "wrist_hinge": {
        const zone =
          wr && el && ix
            ? boxOf(
                steps(c.passMin, c.passMax).map((d) => endAt(wr, el, ix, d)),
                "box",
                ix,
              )
            : null;
        put(c, "wrist", wr, zone, [el, wr, ix]);
        break;
      }
      case "elbow_bend": {
        const zone =
          sh && wr && el
            ? boxOf(
                steps(c.passMin, c.passMax).map((d) => jointAt(sh, wr, el, d)),
                "box",
                el,
              )
            : null;
        put(c, "elbow", el, zone, [sh, el, wr]);
        break;
      }
      case "knee_bend": {
        const zone =
          an && J.hip && kn
            ? boxOf(
                steps(c.passMin, c.passMax).map((d) =>
                  jointAt(an, J.hip!, kn, d),
                ),
                "box",
                kn,
              )
            : null;
        put(c, "knee", kn, zone, [J.hip, kn, an]);
        break;
      }
      case "back": {
        let zone: Zone | null = null;
        if (hc && torso) {
          const R = torso * 1.15;
          const ray = (deg: number): Pt => ({
            x: hc.x + f * R * Math.sin((deg * Math.PI) / 180),
            y: hc.y - R * Math.cos((deg * Math.PI) / 180),
          });
          zone = { kind: "wedge", pts: [hc, ray(c.passMin), ray(c.passMax)] };
        }
        put(c, "shoulders", sc, zone, [hc, sc]);
        break;
      }
      case "hips_over_knees": {
        let zone: Zone | null = null;
        const hp = J.hip;
        if (kn && hp && thigh && ground !== null) {
          const a = kn.x + f * c.passMin * thigh;
          const b = kn.x + f * c.passMax * thigh;
          const [x0, x1] = pad(Math.min(a, b), Math.max(a, b), hp.x);
          const top = hp.y - 0.25 * thigh;
          zone = { kind: "band", x: x0, y: top, w: x1 - x0, h: ground - top };
        }
        put(c, "hip", hp, zone, [hp, kn]);
        break;
      }
      case "hold":
        put(c, null, null, null, []);
        break;
    }
  }
  return out;
}

// ---- dots ---------------------------------------------------------------------

export interface DotStack {
  /** The joint's position on the stage. */
  readonly at: Pt;
  /** Check ids on this joint, worst first. */
  readonly ids: readonly string[];
  /** Each circle's position (side by side, overlapping). */
  readonly pos: readonly Pt[];
}

/** Stage distance under which two dots share a stack. */
export const STACK_RADIUS = 14;
/** Horizontal step between circles in a stack. */
export const STACK_STEP = 9;

/** Groups the dots (stage coordinates) that sit on the same joint. */
export function dotStacks(
  dots: readonly { id: string; at: Pt; score: number | null }[],
): DotStack[] {
  const groups: { at: Pt; items: { id: string; score: number | null }[] }[] =
    [];
  for (const d of dots) {
    const g = groups.find(
      (x) => Math.hypot(x.at.x - d.at.x, x.at.y - d.at.y) < STACK_RADIUS,
    );
    if (g) g.items.push(d);
    else groups.push({ at: d.at, items: [d] });
  }
  return groups.map((g) => {
    const ids = [...g.items]
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((i) => i.id);
    const n = ids.length;
    return {
      at: g.at,
      ids,
      pos: ids.map((_, i) => ({
        x: g.at.x + (i - (n - 1) / 2) * STACK_STEP,
        y: g.at.y,
      })),
    };
  });
}

// ---- arrows & callout ---------------------------------------------------------------

/** Zone corners / rectangle on the stage. */
export type StageZone =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "poly"; pts: readonly Pt[] };

function insidePoly(pts: readonly Pt[], p: Pt): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      c = !c;
  }
  return c;
}

/** The nearest point of a zone to `p` — null when `p` is inside (no arrow). */
export function nearestOnZone(z: StageZone, p: Pt): Pt | null {
  if (z.kind === "rect") {
    if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h)
      return null;
    return {
      x: Math.max(z.x, Math.min(z.x + z.w, p.x)),
      y: Math.max(z.y, Math.min(z.y + z.h, p.y)),
    };
  }
  if (insidePoly(z.pts, p)) return null;
  let best: Pt | null = null;
  let bd = Infinity;
  for (let i = 0; i < z.pts.length; i++) {
    const a = z.pts[i]!;
    const b = z.pts[(i + 1) % z.pts.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/** A point the callout should not cover: weight and clearance (px). */
export interface Obstacle {
  readonly x: number;
  readonly y: number;
  readonly weight: number;
  readonly radius: number;
}

/**
 * Where to put a `w`×`h` callout inside `bounds`: the spot that covers the
 * least (weighted obstacles), preferring spots close to its `anchor` dot.
 */
export function placeCallout(
  size: { w: number; h: number },
  anchor: Pt,
  obstacles: readonly Obstacle[],
  bounds: { x0: number; y0: number; x1: number; y1: number },
  step = 8,
): Pt {
  const maxX = Math.max(bounds.x0, bounds.x1 - size.w);
  const maxY = Math.max(bounds.y0, bounds.y1 - size.h);
  let best: Pt = { x: bounds.x0, y: bounds.y0 };
  let bs = Infinity;
  for (let y = bounds.y0; y <= maxY; y += step) {
    for (let x = bounds.x0; x <= maxX; x += step) {
      let s = 0;
      for (const o of obstacles) {
        const dx = Math.max(x - o.x, 0, o.x - (x + size.w));
        const dy = Math.max(y - o.y, 0, o.y - (y + size.h));
        if (dx < o.radius && dy < o.radius) s += o.weight;
      }
      const nx = Math.max(x, Math.min(x + size.w, anchor.x));
      const ny = Math.max(y, Math.min(y + size.h, anchor.y));
      const dist = Math.hypot(nx - anchor.x, ny - anchor.y);
      s += dist * 0.12 + (dist < 24 ? 50 : 0);
      if (s < bs) {
        bs = s;
        best = { x, y };
      }
    }
  }
  return best;
}

// ---- phase icons ----------------------------------------------------------------

/**
 * Small stick figures of the player's own pose at each keyframe (one shared
 * scale so they line up), as SVG line / circle lists in a 40×44 box.
 */
export function poseIcons(
  frames: readonly (readonly OverlayLandmark[] | null)[],
  xScale: number,
  side: "left" | "right",
): ({ lines: [Pt, Pt][]; head: Pt } | null)[] {
  const s = side;
  const ids = [
    0,
    LM.shoulder[s],
    LM.elbow[s],
    LM.wrist[s],
    LM.hip[s],
    LM.knee[s],
    LM.ankle[s],
  ];
  const pts = frames.flatMap((lm) =>
    lm ? ids.map((i) => lm[i]).filter((p): p is OverlayLandmark => !!p) : [],
  );
  if (pts.length === 0) return frames.map(() => null);
  const xs = pts.map((p) => p.x * xScale);
  const ys = pts.map((p) => p.y);
  const mx = Math.min(...xs);
  const Mx = Math.max(...xs);
  const my = Math.min(...ys);
  const My = Math.max(...ys);
  const k = 40 / Math.max(Mx - mx, My - my, 1e-6);
  const T = (p: Pt): Pt => ({
    x: (p.x * xScale - (mx + Mx) / 2) * k + 20,
    y: (p.y - my) * k + 2,
  });
  const o: "left" | "right" = s === "left" ? "right" : "left";
  return frames.map((lm) => {
    if (!lm) return null;
    const p = (i: number) => lm[i];
    const midOf = (a: number, b: number): Pt | null => {
      const A = p(a);
      const B = p(b);
      return A && B ? mid(A, B) : (A ?? B ?? null);
    };
    const sc = midOf(LM.shoulder.left, LM.shoulder.right);
    const hc = midOf(LM.hip.left, LM.hip.right);
    const pairs: [Pt | null | undefined, Pt | null | undefined][] = [
      [sc, hc],
      [p(LM.shoulder[s]), p(LM.elbow[s])],
      [p(LM.elbow[s]), p(LM.wrist[s])],
      [p(LM.hip[s]), p(LM.knee[s])],
      [p(LM.knee[s]), p(LM.ankle[s])],
      [p(LM.hip[o]), p(LM.knee[o])],
      [p(LM.knee[o]), p(LM.ankle[o])],
    ];
    const lines = pairs
      .filter((q): q is [Pt, Pt] => !!q[0] && !!q[1])
      .map(([a, b]) => [T(a), T(b)] as [Pt, Pt]);
    const nose = p(0);
    return { lines, head: nose ? T(nose) : T(sc ?? { x: 0, y: 0 }) };
  });
}
