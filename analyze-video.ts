#!/usr/bin/env npx tsx
/**
 * CLI script to analyze a basketball shooting video and output metrics JSON.
 *
 * Usage:
 *   npx tsx analyze-video.ts <video-path> [options]
 *
 * Options:
 *   --hand <left|right>     Shooting hand (default: right)
 *   --profile <name>        Profile to compare against (default: youth-fundamentals)
 *   --output <path>         Output JSON path (default: <video-name>_analysis.json)
 *   --pretty                Pretty-print JSON output
 *
 * Example:
 *   npx tsx analyze-video.ts ./videos/shot1.mp4 --hand right --pretty
 */

import { createShotAnalyzer, createConfig, createVideoFileProvider } from "./src/index";
import type { MetricValue } from "./src/metrics/types";
import type { ShotPhases } from "./src/detection/types";
import * as fs from "fs/promises";
import * as path from "path";

interface ValidationExport {
  version: "1.0";
  exportedAt: string;
  video: {
    path: string;
    filename: string;
    width: number;
    height: number;
    fps: number;
    totalFrames: number;
    duration?: number;
  };
  config: {
    shootingHand: "left" | "right";
    profile: string;
  };
  shots: Array<{
    shotIndex: number;
    frameRange: { start: number; end: number };
    phases: Record<string, { startFrame: number; endFrame: number }>;
    metrics: Record<string, {
      value: number | string;
      unit: string;
      frame: number;
      confidence: number;
    }>;
    overallConfidence: number;
  }>;
}

function parseArgs(args: string[]): {
  videoPath: string;
  hand: "left" | "right";
  profile: string;
  output: string | null;
  pretty: boolean;
} {
  const videoPath = args.find(a => !a.startsWith("--"));
  if (!videoPath) {
    console.error("Error: Video path is required");
    console.error("\nUsage: npx tsx analyze-video.ts <video-path> [options]");
    console.error("\nOptions:");
    console.error("  --hand <left|right>     Shooting hand (default: right)");
    console.error("  --profile <name>        Profile name (default: youth-fundamentals)");
    console.error("  --output <path>         Output JSON path");
    console.error("  --pretty                Pretty-print JSON output");
    process.exit(1);
  }

  let hand: "left" | "right" = "right";
  let profile = "youth-fundamentals";
  let output: string | null = null;
  let pretty = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--hand" && args[i + 1]) {
      const val = args[i + 1];
      if (val !== "left" && val !== "right") {
        console.error(`Error: --hand must be 'left' or 'right', got '${val}'`);
        process.exit(1);
      }
      hand = val;
      i++;
    } else if (args[i] === "--profile" && args[i + 1]) {
      profile = args[i + 1];
      i++;
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[i + 1];
      i++;
    } else if (args[i] === "--pretty") {
      pretty = true;
    }
  }

  return { videoPath, hand, profile, output, pretty };
}

function convertPhasesToExport(phases: ShotPhases): Record<string, { startFrame: number; endFrame: number }> {
  const result: Record<string, { startFrame: number; endFrame: number }> = {};
  for (const [phaseName, range] of Object.entries(phases)) {
    if (range) {
      result[phaseName] = {
        startFrame: range.startFrame,
        endFrame: range.endFrame,
      };
    }
  }
  return result;
}

function convertMetricsToExport(metrics: Record<string, MetricValue>): Record<string, {
  value: number | string;
  unit: string;
  frame: number;
  confidence: number;
}> {
  const result: Record<string, {
    value: number | string;
    unit: string;
    frame: number;
    confidence: number;
  }> = {};
  for (const [name, metric] of Object.entries(metrics)) {
    result[name] = {
      value: metric.value,
      unit: metric.unit,
      frame: metric.frame,
      confidence: metric.confidence,
    };
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const { videoPath, hand, profile, output, pretty } = parseArgs(args);

  // Resolve to absolute path
  const absoluteVideoPath = path.resolve(videoPath);

  console.log(`Analyzing video: ${absoluteVideoPath}`);
  console.log(`  Shooting hand: ${hand}`);
  console.log(`  Profile: ${profile}`);
  console.log("");

  // Check if video exists
  try {
    await fs.access(absoluteVideoPath);
  } catch {
    console.error(`Error: Video file not found: ${absoluteVideoPath}`);
    process.exit(1);
  }

  // Create analyzer
  console.log("Initializing analyzer...");
  const analyzer = await createShotAnalyzer(
    createConfig({
      shootingHand: hand,
      profile,
    })
  );

  // Load video
  console.log("Loading video frames...");
  const frameProvider = await createVideoFileProvider(absoluteVideoPath);
  const metadata = frameProvider.getMetadata();
  console.log(`  Resolution: ${metadata.width}x${metadata.height}`);
  console.log(`  FPS: ${frameProvider.getFps()}`);
  if (metadata.duration) {
    console.log(`  Duration: ${(metadata.duration / 1000).toFixed(2)}s`);
  }
  console.log("");

  // Run analysis
  console.log("Running pose detection and shot analysis...");
  const startTime = Date.now();
  const result = await analyzer.analyzeVideo(frameProvider);
  const analysisTime = Date.now() - startTime;
  console.log(`  Analysis completed in ${(analysisTime / 1000).toFixed(2)}s`);
  console.log(`  Detected ${result.shots.length} shot(s)`);
  console.log("");

  // Print summary
  if (result.shots.length > 0) {
    console.log("=== Shot Summary ===");
    for (const shot of result.shots) {
      console.log(`\nShot ${shot.shotIndex + 1}:`);
      console.log(`  Frames: ${shot.frameRange.start} - ${shot.frameRange.end}`);
      console.log(`  Confidence: ${(shot.overallConfidence * 100).toFixed(1)}%`);
      console.log(`  Phases detected: ${Object.keys(shot.phases).join(", ") || "none"}`);
      console.log(`  Metrics calculated: ${Object.keys(shot.metrics).length}`);

      // Show metrics summary
      const metricNames = Object.keys(shot.metrics);
      if (metricNames.length > 0) {
        console.log("  Metrics:");
        for (const name of metricNames) {
          const m = shot.metrics[name];
          const valueStr = typeof m.value === "number" ? m.value.toFixed(2) : m.value;
          console.log(`    - ${name}: ${valueStr} ${m.unit} (frame ${m.frame}, ${(m.confidence * 100).toFixed(0)}% conf)`);
        }
      }
    }
    console.log("");
  }

  // Build export object
  const exportData: ValidationExport = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    video: {
      path: absoluteVideoPath,
      filename: path.basename(absoluteVideoPath),
      width: result.videoMetadata.width,
      height: result.videoMetadata.height,
      fps: result.videoMetadata.fps,
      totalFrames: result.videoMetadata.totalFrames,
      ...(result.videoMetadata.duration !== undefined && { duration: result.videoMetadata.duration }),
    },
    config: {
      shootingHand: hand,
      profile,
    },
    shots: result.shots.map(shot => ({
      shotIndex: shot.shotIndex,
      frameRange: { start: shot.frameRange.start, end: shot.frameRange.end },
      phases: convertPhasesToExport(shot.phases),
      metrics: convertMetricsToExport(shot.metrics as Record<string, MetricValue>),
      overallConfidence: shot.overallConfidence,
    })),
  };

  // Determine output path
  const outputPath = output ?? absoluteVideoPath.replace(/\.[^.]+$/, "_analysis.json");

  // Write JSON
  const jsonContent = pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);

  await fs.writeFile(outputPath, jsonContent, "utf-8");
  console.log(`Analysis saved to: ${outputPath}`);

  // Cleanup
  await analyzer.dispose();
  console.log("Done!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
