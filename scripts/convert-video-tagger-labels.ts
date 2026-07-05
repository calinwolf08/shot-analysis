/**
 * Convert video-tagger JSON label files to test-data format.
 *
 * Run: npx tsx scripts/convert-video-tagger-labels.ts
 *
 * Input: video-tagger format from OneDrive
 * Output: test-data format in test-data/{video-name}/labels.json
 */

import fs from "fs";
import path from "path";

// Video-tagger input format
interface VideoTaggerShot {
  shot_number: number;
  orientation?: string;
  keypoints: {
    legs_start_bending?: number | null;
    leg_bend_low_point?: number | null;
    ball_low_point?: number | null;
    ball_starts_upward?: number | null;
    legs_start_extending?: number | null;
    arms_most_acute?: number | null; // Ignored in new schema
    set_point?: number | null;
    legs_fully_extended?: number | null; // Ignored in new schema
    arms_fully_extended?: number | null;
    feet_leave_ground?: number | null;
    feet_land?: number | null;
    release?: number | null;
  };
}

interface VideoTaggerLabels {
  video: string;
  fps?: number;
  shots: VideoTaggerShot[];
}

// Test-data output format
interface TestDataShot {
  shotNumber: number;
  startFrame: number;
  endFrame: number;
  cameraOrientation: string;
  legs_start_bending?: number | null;
  leg_bend_low_point?: number | null;
  ball_low_point?: number | null;
  ball_starts_upward?: number | null;
  legs_start_extending?: number | null;
  set_point?: number | null;
  arms_fully_extended?: number | null;
  feet_leave_ground?: number | null;
  feet_land?: number | null;
  release?: number | null;
}

interface TestDataLabels {
  video: string;
  labeledBy: string;
  labeledAt: string;
  shots: TestDataShot[];
}

// Configuration
const ONEDRIVE_BASE =
  "/mnt/c/Users/calin/OneDrive - Soul Focused Group/Personal Photos/basketball clips";

const VIDEO_TAGGER_FILES = [
  { player: "chris", file: "20190103_180930_labels.json" },
  { player: "chris", file: "20190103_181419_labels.json" },
  { player: "chris", file: "chris 5_labels.json" },
  { player: "cody", file: "20190804_140617_labels.json" },
  { player: "cody", file: "20190818_142631_labels.json" },
  { player: "cole", file: "20201212_134104_labels.json" },
  { player: "jax", file: "20181219_173607_labels.json" },
  { player: "edmond", file: "20190804_140654_labels.json" },
];

/**
 * Extract video name (without extension) from labels filename.
 * Handles both "20190103_180930_labels.json" and "chris 5_labels.json" formats.
 */
function extractVideoName(labelsFilename: string): string {
  return labelsFilename.replace("_labels.json", "");
}

/**
 * Normalize directory name for test-data folder.
 * Converts spaces to hyphens and makes lowercase.
 */
function normalizeDirectoryName(videoName: string): string {
  return videoName.replace(/\s+/g, "-").toLowerCase();
}

/**
 * Convert video-tagger shot to test-data format.
 */
function convertShot(shot: VideoTaggerShot): TestDataShot {
  const kp = shot.keypoints;

  // Calculate endFrame from the maximum keyframe value
  const allFrames = [
    kp.legs_start_bending,
    kp.leg_bend_low_point,
    kp.ball_low_point,
    kp.ball_starts_upward,
    kp.legs_start_extending,
    kp.set_point,
    kp.arms_fully_extended,
    kp.feet_leave_ground,
    kp.feet_land,
    kp.release,
  ].filter((f): f is number => f !== null && f !== undefined);

  const endFrame =
    allFrames.length > 0 ? Math.max(...allFrames) + 5 : kp.legs_start_bending ?? 0;

  // Use legs_start_bending as startFrame for compatibility
  const startFrame = kp.legs_start_bending ?? 0;

  const result: TestDataShot = {
    shotNumber: shot.shot_number,
    startFrame,
    endFrame,
    cameraOrientation: shot.orientation ?? "unknown",
  };

  // Map keyframes (preserving nulls, excluding arms_most_acute and legs_fully_extended)
  if (kp.legs_start_bending !== undefined) {
    result.legs_start_bending = kp.legs_start_bending;
  }
  if (kp.leg_bend_low_point !== undefined) {
    result.leg_bend_low_point = kp.leg_bend_low_point;
  }
  if (kp.ball_low_point !== undefined) {
    result.ball_low_point = kp.ball_low_point;
  }
  if (kp.ball_starts_upward !== undefined) {
    result.ball_starts_upward = kp.ball_starts_upward;
  }
  if (kp.legs_start_extending !== undefined) {
    result.legs_start_extending = kp.legs_start_extending;
  }
  if (kp.set_point !== undefined) {
    result.set_point = kp.set_point;
  }
  if (kp.arms_fully_extended !== undefined) {
    result.arms_fully_extended = kp.arms_fully_extended;
  }
  if (kp.feet_leave_ground !== undefined) {
    result.feet_leave_ground = kp.feet_leave_ground;
  }
  if (kp.feet_land !== undefined) {
    result.feet_land = kp.feet_land;
  }
  if (kp.release !== undefined) {
    result.release = kp.release;
  }

  return result;
}

/**
 * Convert video-tagger labels to test-data format.
 */
function convertLabels(input: VideoTaggerLabels): TestDataLabels {
  return {
    video: input.video,
    labeledBy: "human",
    labeledAt: new Date().toISOString(),
    shots: input.shots.map(convertShot),
  };
}

/**
 * Process a single video-tagger label file.
 */
function processLabelFile(
  player: string,
  filename: string
): { videoName: string; shots: number; success: boolean; error?: string } {
  const videoName = extractVideoName(filename);
  const inputPath = path.join(ONEDRIVE_BASE, player, filename);

  try {
    // Read input file
    const inputContent = fs.readFileSync(inputPath, "utf-8");
    const inputLabels: VideoTaggerLabels = JSON.parse(inputContent);

    // Convert to test-data format
    const outputLabels = convertLabels(inputLabels);

    // Determine output directory
    const dirName = normalizeDirectoryName(videoName);
    const outputDir = path.join(process.cwd(), "test-data", dirName);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`  Created directory: test-data/${dirName}/`);
    }

    // Write output file
    const outputPath = path.join(outputDir, "labels.json");
    fs.writeFileSync(outputPath, JSON.stringify(outputLabels, null, 2) + "\n");

    // Check for poses.json
    const posesInputPath = inputPath.replace("_labels.json", "_poses.json");
    if (fs.existsSync(posesInputPath)) {
      const posesOutputPath = path.join(outputDir, "poses.json");
      fs.copyFileSync(posesInputPath, posesOutputPath);
      console.log(`  Copied poses.json`);
    } else {
      console.log(`  Warning: No poses.json found for ${videoName}`);
    }

    return {
      videoName,
      shots: outputLabels.shots.length,
      success: true,
    };
  } catch (error) {
    return {
      videoName,
      shots: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main conversion function.
 */
function main(): void {
  console.log("=== Video-Tagger to Test-Data Conversion ===\n");
  console.log(`Input: ${ONEDRIVE_BASE}`);
  console.log(`Output: ${process.cwd()}/test-data/\n`);

  let totalShots = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const { player, file } of VIDEO_TAGGER_FILES) {
    console.log(`Processing ${player}/${file}...`);
    const result = processLabelFile(player, file);

    if (result.success) {
      console.log(`  ✓ Converted ${result.shots} shots`);
      totalShots += result.shots;
      successCount++;
    } else {
      console.log(`  ✗ Error: ${result.error}`);
      errorCount++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Files processed: ${successCount}/${VIDEO_TAGGER_FILES.length}`);
  console.log(`Total shots: ${totalShots}`);
  if (errorCount > 0) {
    console.log(`Errors: ${errorCount}`);
  }
}

main();
