/**
 * Hand-built library-typed fixtures for tests. Import from tests only.
 */
import type { ShotAnalysis } from "basketball-shot-analysis";

export interface ShotFixtureOptions {
  shotIndex?: number;
  start?: number;
  end?: number;
  overallConfidence?: number;
  orientation?: ShotAnalysis["orientation"];
  /** Overrides/additions merged into the default metric set. */
  metrics?: Record<
    string,
    {
      value: number | string;
      unit?: string;
      frame?: number;
      confidence?: number;
    }
  >;
}

/** A realistic ShotAnalysis with a representative metric mix. */
export function makeShotAnalysis(
  options: ShotFixtureOptions = {},
): ShotAnalysis {
  const start = options.start ?? 100;
  const end = options.end ?? 160;
  const mid = Math.floor((start + end) / 2);

  const defaultMetrics: Record<
    string,
    { value: number | string; unit: string; frame: number; confidence: number }
  > = {
    shootingElbowAngle: {
      value: 88,
      unit: "degrees",
      frame: mid,
      confidence: 0.92,
    },
    shootingElbowFlare: {
      value: 12,
      unit: "degrees",
      frame: mid,
      confidence: 0.9,
    },
    wristSnapAngle: {
      value: 62,
      unit: "degrees",
      frame: end - 5,
      confidence: 0.85,
    },
    kneeFlexion: {
      value: 128,
      unit: "degrees",
      frame: start + 12,
      confidence: 0.95,
    },
    ballDip: { value: 0.18, unit: "ratio", frame: start + 8, confidence: 0.7 },
    guideHandPosition: {
      value: "side",
      unit: "category",
      frame: mid,
      confidence: 0.8,
    },
    ballLegSync: {
      value: -4,
      unit: "percent",
      frame: start + 15,
      confidence: 0.75,
    },
    totalShotDuration: {
      value: 850,
      unit: "ms",
      frame: end,
      confidence: 0.98,
    },
  };

  const merged = { ...defaultMetrics };
  for (const [name, m] of Object.entries(options.metrics ?? {})) {
    merged[name] = {
      value: m.value,
      unit: m.unit ?? defaultMetrics[name]?.unit ?? "unit",
      frame: m.frame ?? mid,
      confidence: m.confidence ?? 0.9,
    };
  }

  return {
    shotIndex: options.shotIndex ?? 0,
    frameRange: { start, end },
    phases: {
      gather: { startFrame: start, endFrame: start + 8 },
      load: { startFrame: start + 8, endFrame: start + 18 },
      rise: { startFrame: start + 18, endFrame: mid },
      setPoint: { startFrame: mid, endFrame: mid + 6 },
      release: { startFrame: mid + 6, endFrame: mid + 12 },
      followThrough: { startFrame: mid + 12, endFrame: end },
    },
    metrics: merged,
    overallConfidence: options.overallConfidence ?? 0.87,
    ...(options.orientation ? { orientation: options.orientation } : {}),
  };
}
