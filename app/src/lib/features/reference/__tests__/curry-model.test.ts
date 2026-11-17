import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PoseData } from "basketball-shot-analysis";
import {
  buildMetricTable,
  computeReferenceShots,
  type ReferenceLabels,
  type TargetEntry,
} from "../curry-model";

const ROOT = join(process.cwd(), "..");
const dir = join(ROOT, "test-data", "stephen-curry-1");
const poses = JSON.parse(
  readFileSync(join(dir, "poses.json"), "utf8"),
) as PoseData;
const labels = JSON.parse(
  readFileSync(join(dir, "labels.json"), "utf8"),
) as ReferenceLabels;
const targets = JSON.parse(
  readFileSync(
    join(process.cwd(), "static", "reference", "live-targets.json"),
    "utf8",
  ),
) as { metrics: Record<string, TargetEntry & { stats: { n: number } }> };

const shots = computeReferenceShots(poses, labels, "right");

describe("computeReferenceShots (Curry)", () => {
  it("measures all 7 labeled side-on shots", () => {
    expect(shots).toHaveLength(7);
    expect(shots.every((s) => s.orientation === "side-left")).toBe(true);
    expect(shots.every((s) => s.metrics.size > 50)).toBe(true);
  });

  // The viewer is only useful if it shows the numbers the targets came from.
  it("reproduces the published targets exactly (parity with targets:build)", () => {
    let checked = 0;
    for (const [id, t] of Object.entries(targets.metrics)) {
      const vals = shots
        .map((s) => s.metrics.get(id)?.value)
        .filter((v): v is number => v !== undefined);
      expect(vals.length, id).toBe(t.stats.n);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      expect(mean, id).toBeCloseTo(t.ideal, 9);
      expect(Math.min(...vals), id).toBeCloseTo(t.passMin, 9);
      expect(Math.max(...vals), id).toBeCloseTo(t.passMax, 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(80);
  });

  it("records where each value was measured (for seeking)", () => {
    const sp = shots[0]!.metrics.get("setPoint.elbow_angle")!;
    expect(sp.frames[0]).toBeGreaterThanOrEqual(shots[0]!.startFrame);
    expect(sp.frames[0]).toBeLessThanOrEqual(shots[0]!.endFrame);
  });
});

describe("buildMetricTable", () => {
  const table = buildMetricTable(shots, targets.metrics);

  it("groups rows by phase in shot order, sequencing last", () => {
    const groups = table.map((g) => g.group);
    expect(groups.indexOf("load")).toBeLessThan(groups.indexOf("setPoint"));
    expect(groups.at(-1)).toBe("sequencing");
    const rows = table.flatMap((g) => g.rows);
    expect(rows).toHaveLength(Object.keys(targets.metrics).length);
    expect(rows.every((r) => r.cells.length === 7)).toBe(true);
  });

  it("flags cells more than 2 SD from the target mean", () => {
    const row = table
      .flatMap((g) => g.rows)
      .find((r) => r.id === "setPoint.elbow_angle")!;
    for (let i = 0; i < row.cells.length; i++) {
      const c = row.cells[i] ?? null;
      expect(row.outlier[i]).toBe(
        c !== null && Math.abs(c.value - row.ideal) > 2 * row.sd,
      );
    }
  });
});
