import { describe, it, expect } from "vitest";
import * as fs from "fs";
import {
  buildMetricsGolden,
  GOLDEN_PATH,
  type MetricsGolden,
} from "./metrics-golden-shared";

/**
 * Regression guard: the v2 metrics extracted from the labeled corpus must match
 * the committed golden file within a small tolerance. If this fails after an
 * intentional metric change, review the diff and run `npm run metrics:golden`.
 */
describe("v2 metrics golden", () => {
  const TOL = 1e-3;

  it("matches the committed golden file", () => {
    expect(fs.existsSync(GOLDEN_PATH)).toBe(true);
    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8")) as MetricsGolden;
    const current = buildMetricsGolden();

    const drift: string[] = [];
    for (const clip of Object.keys(golden)) {
      const gShots = golden[clip]!;
      const cShots = current[clip];
      if (!cShots) {
        drift.push(`${clip}: missing from current extraction`);
        continue;
      }
      for (const shotKey of Object.keys(gShots)) {
        const gRow = gShots[shotKey]!;
        const cRow = cShots[shotKey];
        if (!cRow) {
          drift.push(`${clip}/${shotKey}: shot missing`);
          continue;
        }
        for (const [id, gv] of Object.entries(gRow)) {
          const cv = cRow[id];
          if (cv === undefined) {
            drift.push(`${clip}/${shotKey}/${id}: no longer produced`);
          } else if (Math.abs(cv - gv) > TOL) {
            drift.push(`${clip}/${shotKey}/${id}: ${gv} -> ${cv}`);
          }
        }
      }
    }

    if (drift.length) {
      throw new Error(
        `Metrics drifted from golden (${drift.length}):\n` +
          drift.slice(0, 30).join("\n") +
          (drift.length > 30 ? `\n…and ${drift.length - 30} more` : "") +
          `\nIf intentional, run: npm run metrics:golden`,
      );
    }
    expect(drift).toHaveLength(0);
  });
});
