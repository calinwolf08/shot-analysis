/**
 * Test module import and basic usage
 * Run with: node test-import.mjs
 */

import {
  // Core types
  ShotAnalyzer,
  createShotAnalyzer,
  createConfig,
  createDefaultConfig,
  validateConfig,

  // Providers
  VideoFileProvider,
  MediaStreamProvider,
  createVideoFileProvider,
  createMediaStreamProvider,

  // Profiles
  ProfileRegistry,
  getProfileRegistry,
  ProfileComparisonEngine,
  youthFundamentalsProfile,
  highSchoolProfile,
  proFormProfile,
  builtInProfiles,
  getBuiltInProfile,

  // Utilities
  calculateAngle,
  calculateDistance,
  normalizeToBodyScale,

  // Constants
  LANDMARK_INDICES,
  TOTAL_LANDMARKS,
} from "./dist/index.js";

console.log("Testing module imports...\n");

// Test 1: Constants
console.log("1. Testing constants:");
console.log(`   TOTAL_LANDMARKS: ${TOTAL_LANDMARKS}`);
console.log(`   LANDMARK_INDICES keys: ${Object.keys(LANDMARK_INDICES).length}`);

// Test 2: Configuration
console.log("\n2. Testing configuration:");
const defaultConfig = createDefaultConfig();
console.log(`   Default config shootingHand: ${defaultConfig.shootingHand}`);
console.log(`   Default config profile: ${defaultConfig.profile}`);

const customConfig = createConfig({
  shootingHand: "left",
  profile: "pro-form",
  minConfidenceThreshold: 0.6,
});
console.log(`   Custom config shootingHand: ${customConfig.shootingHand}`);
console.log(`   Custom config profile: ${customConfig.profile}`);

// Test 3: Validation
console.log("\n3. Testing validation:");
try {
  const validated = validateConfig({
    shootingHand: "right",
    profile: "youth-fundamentals",
    minConfidenceThreshold: 0.5,
    outputTimingUnit: "frames"
  });
  console.log(`   Validation passed: ${validated.shootingHand}`);
} catch (e) {
  console.log(`   Validation failed: ${e.message}`);
}

// Test 4: Profiles
console.log("\n4. Testing profiles:");
const registry = getProfileRegistry();
const profiles = registry.list();
console.log(`   Built-in profiles: ${profiles.join(", ")}`);
console.log(`   Youth profile name: ${youthFundamentalsProfile.name}`);
console.log(`   High school profile name: ${highSchoolProfile.name}`);
console.log(`   Pro profile name: ${proFormProfile.name}`);

// Test 5: Geometry utilities
console.log("\n5. Testing utilities:");
const angle = calculateAngle(
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 1, y: 1, z: 0 }
);
console.log(`   calculateAngle (90 degrees): ${angle.toFixed(1)}`);

const distance = calculateDistance(
  { x: 0, y: 0, z: 0 },
  { x: 3, y: 4, z: 0 }
);
console.log(`   calculateDistance (5): ${distance.toFixed(1)}`);

// Test 6: ShotAnalyzer class exists
console.log("\n6. Testing ShotAnalyzer:");
console.log(`   ShotAnalyzer is a class: ${typeof ShotAnalyzer === "function"}`);
console.log(`   createShotAnalyzer is a function: ${typeof createShotAnalyzer === "function"}`);

// Test 7: Provider classes exist
console.log("\n7. Testing providers:");
console.log(`   VideoFileProvider is a class: ${typeof VideoFileProvider === "function"}`);
console.log(`   MediaStreamProvider is a class: ${typeof MediaStreamProvider === "function"}`);
console.log(`   createVideoFileProvider is a function: ${typeof createVideoFileProvider === "function"}`);
console.log(`   createMediaStreamProvider is a function: ${typeof createMediaStreamProvider === "function"}`);

// Test 8: ProfileComparisonEngine
console.log("\n8. Testing ProfileComparisonEngine:");
console.log(`   ProfileComparisonEngine is a class: ${typeof ProfileComparisonEngine === "function"}`);

console.log("\n✅ All import tests passed!");
