/**
 * The v3 phase timeline of a stored shot, for review: where each phase begins
 * (scrubber markers) and which phase a frame belongs to (highlighting the
 * scorecard and choosing the on-stage issues).
 *
 * Frames are the stored pose track's frame indexes (v3 events are fractional
 * frames on the same index). Before the load counts as Load (the player is
 * preparing it); after arm extension counts as Release (follow-through).
 *
 * Pure.
 */
import type { MetricPhase, ShotMetricsV3 } from "basketball-shot-analysis";
import { phaseName } from "../loop/readback";

export interface PhaseMark {
  readonly phase: MetricPhase;
  readonly name: string;
  /** Frame where the phase begins (rounded). */
  readonly frame: number;
}

/** Set point is a moment; frames within this distance of it count as it. */
export const SET_POINT_HALF_WIDTH = 1;

export function phaseMarks(v3: ShotMetricsV3): PhaseMark[] {
  const { load, rise, release } = v3.phases;
  const sp = v3.events.setPoint;
  const marks: [MetricPhase, number | null | undefined][] = [
    ["load", load?.start],
    ["rise", rise?.start ?? load?.end],
    ["setPoint", sp],
    ["release", release?.start ?? sp],
  ];
  const out: PhaseMark[] = [];
  for (const [phase, f] of marks) {
    if (f === null || f === undefined) continue;
    // Release starts at set point; nudge its marker past the set-point frame.
    const frame =
      phase === "release"
        ? Math.round(f) + SET_POINT_HALF_WIDTH + 1
        : Math.round(f);
    out.push({ phase, name: phaseName(phase), frame });
  }
  return out;
}

/** The phase a frame belongs to, or null when no phases were detected. */
export function phaseAtFrame(
  v3: ShotMetricsV3,
  frame: number,
): MetricPhase | null {
  const { load, rise } = v3.phases;
  const sp = v3.events.setPoint;
  if (sp !== null && Math.abs(frame - sp) <= SET_POINT_HALF_WIDTH)
    return "setPoint";
  if (sp !== null && frame > sp) return "release";
  if (load && frame < load.end) return "load";
  if (rise || (load && sp !== null)) return "rise";
  return load ? "load" : null;
}
