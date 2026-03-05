/**
 * Integration test script for profile comparison.
 * Verifies that all 3 built-in profiles work correctly with sample shot data.
 *
 * Run: npx ts-node --esm scripts/test-profile-comparison.ts
 */

import {
  ProfileComparisonEngine,
  youthFundamentalsProfile,
  highSchoolProfile,
  proFormProfile,
  safeValidateProfile,
} from "../src/profiles/index.js";
import type { ShotAnalysis } from "../src/metrics/types.js";

// Create a sample shot analysis with typical metrics
const sampleShot: ShotAnalysis = {
  shotIndex: 0,
  frameRange: { start: 0, end: 60 },
  phases: {},
  metrics: {
    shootingElbowAngle: {
      value: 92,
      unit: "degrees",
      frame: 30,
      confidence: 0.95,
    },
    shootingElbowFlare: {
      value: 12,
      unit: "degrees",
      frame: 30,
      confidence: 0.92,
    },
    followThroughHold: {
      value: 75,
      unit: "percent",
      frame: 50,
      confidence: 0.88,
    },
    setPointHeight: { value: 0.14, unit: "ratio", frame: 25, confidence: 0.9 },
    releaseAngle: { value: 50, unit: "degrees", frame: 35, confidence: 0.94 },
    kneeFlexion: { value: 48, unit: "degrees", frame: 10, confidence: 0.85 },
    guideHandPosition: {
      value: "side",
      unit: "category",
      frame: 30,
      confidence: 0.91,
    },
    handCupVsHinge: {
      value: "cup",
      unit: "category",
      frame: 30,
      confidence: 0.87,
    },
    ballLegSync: { value: 5, unit: "ms", frame: 20, confidence: 0.82 },
    backPosture: { value: 6, unit: "degrees", frame: 15, confidence: 0.89 },
  },
  overallConfidence: 0.89,
};

// Create a "bad" shot for testing failures
const badShot: ShotAnalysis = {
  shotIndex: 1,
  frameRange: { start: 0, end: 60 },
  phases: {},
  metrics: {
    shootingElbowAngle: {
      value: 60,
      unit: "degrees",
      frame: 30,
      confidence: 0.95,
    }, // Too low
    shootingElbowFlare: {
      value: 45,
      unit: "degrees",
      frame: 30,
      confidence: 0.92,
    }, // Too high
    followThroughHold: {
      value: 30,
      unit: "percent",
      frame: 50,
      confidence: 0.88,
    }, // Too low
    releaseAngle: { value: 25, unit: "degrees", frame: 35, confidence: 0.94 }, // Too low (flat)
    guideHandPosition: {
      value: "under",
      unit: "category",
      frame: 30,
      confidence: 0.91,
    }, // May fail pro
  },
  overallConfidence: 0.89,
};

console.log("=== Profile Validation ===");
const profiles = [youthFundamentalsProfile, highSchoolProfile, proFormProfile];
profiles.forEach((p) => {
  const valid = safeValidateProfile(p);
  console.log(`${p.name}: ${valid.success ? "VALID" : "INVALID"}`);
  if (!valid.success) {
    console.log("  Errors:", valid.error);
  }
});

console.log("\n=== Sample Good Shot Comparison ===");
const engine = new ProfileComparisonEngine();

profiles.forEach((profile) => {
  console.log(`\n--- ${profile.name} ---`);
  const result = engine.compareToProfile(sampleShot, profile);
  console.log(
    `Pass: ${result.summary.passCount}, Fail: ${result.summary.failCount}, Warn: ${result.summary.warningCount}`,
  );
  if (result.summary.priorityIssues.length > 0) {
    console.log("Issues:");
    result.summary.priorityIssues.slice(0, 3).forEach((issue) => {
      console.log(`  - ${issue}`);
    });
  } else {
    console.log("No issues - all metrics pass!");
  }
});

console.log("\n=== Sample Bad Shot Comparison ===");
profiles.forEach((profile) => {
  console.log(`\n--- ${profile.name} ---`);
  const result = engine.compareToProfile(badShot, profile);
  console.log(
    `Pass: ${result.summary.passCount}, Fail: ${result.summary.failCount}, Warn: ${result.summary.warningCount}`,
  );
  if (result.summary.priorityIssues.length > 0) {
    console.log("Top issues:");
    result.summary.priorityIssues.slice(0, 3).forEach((issue) => {
      console.log(`  - ${issue}`);
    });
  }
});

console.log("\n=== Test Complete ===");
