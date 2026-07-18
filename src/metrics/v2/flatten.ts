/**
 * Flattens a nested ShotMetricsV2 record into a flat list of `{ id, value,
 * reliable }` rows keyed by a stable metric id. This is the shape thresholds
 * are derived from (Step 6) and shots are scored against (Step 7): one number
 * per metric id, with reliability so unreliable readings can be excluded.
 *
 * Metric id conventions:
 *   seq.<from>__<to>        signed normalized sequencing gap
 *   <phase>.<key>           structure metric (e.g. load.depth_drop)
 */

import type { ShotMetricsV2 } from "./types";

export interface FlatMetric {
  readonly id: string;
  readonly value: number;
  readonly reliable: boolean;
  readonly frames: readonly number[];
  readonly note?: string;
}

export function flattenMetrics(m: ShotMetricsV2): FlatMetric[] {
  const out: FlatMetric[] = [];

  const push = (
    id: string,
    meas: { value: number; reliable: boolean; frames: readonly number[]; note?: string },
  ): void => {
    out.push({
      id,
      value: meas.value,
      reliable: meas.reliable,
      frames: meas.frames,
      ...(meas.note !== undefined ? { note: meas.note } : {}),
    });
  };

  for (const g of m.sequencing.gaps) {
    push(`seq.${g.from}__${g.to}`, g.gap);
  }

  const structure = m.structure ?? {};
  for (const [phase, metrics] of Object.entries(structure)) {
    if (!metrics) continue;
    for (const [key, meas] of Object.entries(metrics)) {
      push(`${phase}.${key}`, meas);
    }
  }

  return out;
}
