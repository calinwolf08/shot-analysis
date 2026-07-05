/**
 * Validate all labels.json files against the Zod schema.
 *
 * Run: npx tsx scripts/validate-labels.ts
 */

import { loadLabelData } from "../src/testing/loader.js";
import * as fs from "fs";
import * as path from "path";

const testDataDir = path.join(process.cwd(), "test-data");
const dirs = fs
  .readdirSync(testDataDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

console.log("=== Validating Converted Labels ===\n");

let validCount = 0;
let errorCount = 0;

for (const dir of dirs) {
  const labelsPath = path.join(testDataDir, dir, "labels.json");
  if (!fs.existsSync(labelsPath)) continue;

  const result = loadLabelData(labelsPath);
  if (result.success) {
    // Check for keyframe data
    const hasKeyframes = result.data.shots.some(
      (shot) =>
        shot.legs_start_bending !== undefined ||
        shot.set_point !== undefined ||
        shot.release !== undefined
    );
    const keyframeInfo = hasKeyframes ? "with keyframes" : "no keyframes";
    console.log(`✓ ${dir}: ${result.data.shots.length} shots (${keyframeInfo})`);
    validCount++;
  } else {
    console.log(`✗ ${dir}: ${result.error}`);
    errorCount++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Valid: ${validCount}, Errors: ${errorCount}`);

process.exit(errorCount > 0 ? 1 : 0);
