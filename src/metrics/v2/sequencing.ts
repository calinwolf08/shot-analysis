/**
 * Sequencing (Efficiency) metrics: the order the eight shot events occur in and
 * the normalized time between them.
 *
 * Each consecutive pair in the canonical order produces one SIGNED gap (as a
 * fraction of shot duration): positive means the later event really came later
 * (correct order), negative means the order was violated, and the magnitude is
 * the elapsed time. One thresholdable number captures both "must happen before"
 * and "within a time range".
 *
 * @see docs/implementation-plan-metrics-overhaul.md (Step 2)
 */

import type { KeyframeId } from "../../testing/types";
import { normTime } from "./normalize";
import {
  SEQUENCE_EVENT_KEYFRAMES,
  measure,
  unavailable,
  type SequenceEvent,
  type SequenceGap,
  type SequencingMetrics,
} from "./types";

/**
 * Builds the sequencing metrics for one shot from its detected keyframes.
 *
 * @param keyframes - keyframe → frame index (or null when undetected)
 * @param startFrame - shot start (inclusive)
 * @param endFrame - shot end (inclusive)
 */
export function computeSequencing(
  keyframes: ReadonlyMap<KeyframeId, number | null>,
  startFrame: number,
  endFrame: number,
): SequencingMetrics {
  const events: SequenceEvent[] = SEQUENCE_EVENT_KEYFRAMES.map((e) => {
    const frame = keyframes.get(e.keyframe) ?? null;
    return {
      id: e.id,
      label: e.label,
      frame,
      t: frame === null ? null : normTime(frame, startFrame, endFrame),
    };
  });

  const gaps: SequenceGap[] = [];
  for (let i = 0; i + 1 < events.length; i++) {
    const from = events[i]!;
    const to = events[i + 1]!;
    if (from.t === null || to.t === null) {
      const missing = from.t === null ? from.label : to.label;
      gaps.push({
        from: from.id,
        to: to.id,
        gap: unavailable(
          `${missing} not detected`,
          [from.frame, to.frame].filter((f): f is number => f !== null),
        ),
      });
      continue;
    }
    gaps.push({
      from: from.id,
      to: to.id,
      gap: measure(to.t - from.t, [from.frame!, to.frame!]),
    });
  }

  const detected = events.filter((e) => e.frame !== null).length;
  const coverage = events.length > 0 ? detected / events.length : 0;

  return { events, gaps, coverage };
}
