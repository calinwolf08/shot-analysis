#!/usr/bin/env npx tsx
/**
 * Regenerates the metrics golden file (metrics overhaul Step 11).
 *
 *   npm run metrics:golden
 *
 * Extracts v2 metrics for every labeled test-data clip and writes the reliable
 * values (rounded) to src/testing/__fixtures__/metrics-golden.json. The golden
 * test (metrics-golden.test.ts) recomputes and diffs against this file, so any
 * change to the metric math shows up as a reviewable drift instead of silently
 * shifting scores.
 *
 * @see docs/implementation-plan-metrics-overhaul.md (Step 11)
 */

import * as fs from "fs";
import * as path from "path";
import { buildMetricsGolden, GOLDEN_PATH } from "./metrics-golden-shared";

const golden = buildMetricsGolden();
fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
fs.writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + "\n", "utf8");
const shots = Object.values(golden).reduce((n, clip) => n + Object.keys(clip).length, 0);
console.log(
  `Wrote ${path.relative(process.cwd(), GOLDEN_PATH)}: ${Object.keys(golden).length} clip(s), ${shots} shot(s).`,
);
