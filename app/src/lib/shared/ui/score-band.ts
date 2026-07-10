/** Score color bands (design doc §Visual design). */
export type ScoreBand = "fail" | "warn" | "good" | "elite" | "none";

export function scoreBand(value: number | null | undefined): ScoreBand {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "none";
  }
  if (value < 50) return "fail";
  if (value < 70) return "warn";
  if (value < 85) return "good";
  return "elite";
}

export const BAND_COLORS: Record<ScoreBand, string> = {
  fail: "var(--sc-fail)",
  warn: "var(--sc-warn)",
  good: "var(--sc-success)",
  elite: "url(#sc-elite-gradient)",
  none: "var(--sc-border)",
};
