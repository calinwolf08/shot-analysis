#!/usr/bin/env npx tsx
/**
 * Automated test for the validation tool using Playwright.
 *
 * Usage:
 *   npx tsx test-validation.ts <video-path>
 */

import { chromium } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";

const VIDEO_PATH =
  process.argv[2] ||
  "/mnt/c/Users/calin/OneDrive - Soul Focused Group/Personal Photos/basketball clips/chris/chris 5.mp4";
const SERVER_PORT = 3001; // Use different port to avoid conflicts

async function startServer(): Promise<ChildProcess> {
  console.log("Starting server...");
  const server = spawn("npx", ["tsx", "server.ts", String(SERVER_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server startup timeout")),
      30000,
    );

    server.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      console.log("[Server]", text.trim());
      if (text.includes("Server running at")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    server.stderr?.on("data", (data: Buffer) => {
      console.error("[Server Error]", data.toString().trim());
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return server;
}

async function runTest() {
  // Check video exists
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`Video not found: ${VIDEO_PATH}`);
    process.exit(1);
  }

  console.log(`Testing with video: ${VIDEO_PATH}`);

  let server: ChildProcess | null = null;

  try {
    // Start server
    server = await startServer();

    // Launch browser
    console.log("Launching browser...");
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--use-gl=egl", // Better WebGL support
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture console messages
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      console.log(text);
    });

    // Navigate to the page
    console.log(`Navigating to http://localhost:${SERVER_PORT}...`);
    await page.goto(`http://localhost:${SERVER_PORT}`, {
      waitUntil: "networkidle",
    });

    // Set the video file using file chooser
    console.log("Setting video file...");
    const fileInput = await page.$("#videoFileInput");
    if (!fileInput) {
      throw new Error("Could not find file input");
    }
    await fileInput.setInputFiles(VIDEO_PATH);

    // Wait for file to be selected
    await page.waitForFunction(() => {
      const input = document.getElementById(
        "videoFileInput",
      ) as HTMLInputElement;
      return input?.files?.length > 0;
    });

    // Click analyze button
    console.log("Clicking Analyze button...");
    const analyzeBtn = await page.$("#analyzeBtn");
    if (!analyzeBtn) {
      throw new Error("Could not find analyze button");
    }

    // Check button is enabled
    const isDisabled = await analyzeBtn.isDisabled();
    if (isDisabled) {
      throw new Error("Analyze button is disabled");
    }

    await analyzeBtn.click();

    // First wait for analysis to START (progress section becomes visible)
    console.log("Waiting for analysis to start...");
    await page.waitForFunction(
      () => {
        const progress = document.getElementById("progressSection");
        return progress && !progress.classList.contains("hidden");
      },
      { timeout: 10000 },
    );

    // Then wait for analysis to complete (progress section hidden again OR results visible)
    console.log("Analysis started, waiting for completion...");
    try {
      await page.waitForFunction(
        () => {
          // Check if progress section is hidden (analysis complete)
          const progress = document.getElementById("progressSection");
          const progressHidden = progress?.classList.contains("hidden");
          // Check for metrics content visible
          const metricsContent = document.getElementById("metricsContent");
          const metricsVisible =
            metricsContent && !metricsContent.classList.contains("hidden");
          // Check analyze button text (changes back to "Analyze Video" when done)
          const btn = document.getElementById("analyzeBtn");
          const btnReady = btn?.textContent === "Analyze Video";
          return (progressHidden && btnReady) || metricsVisible;
        },
        { timeout: 180000 },
      ); // 3 minute timeout for analysis
    } catch (err) {
      console.log(
        "Timeout waiting for analysis - capturing current state anyway",
      );
    }

    // Give a moment for final console logs
    await page.waitForTimeout(1000);

    // Check results
    const result = await page.evaluate(() => {
      const statShots = document.getElementById("statShots")?.textContent;
      const statMetrics = document.getElementById("statMetrics")?.textContent;
      const noDataVisible = !document
        .getElementById("noDataMessage")
        ?.classList.contains("hidden");
      return { shots: statShots, metrics: statMetrics, noDataVisible };
    });

    console.log("\n=== RESULTS ===");
    console.log(`Shots detected: ${result.shots}`);
    console.log(`Metrics: ${result.metrics}`);
    console.log(`No data message visible: ${result.noDataVisible}`);

    // Print relevant console logs
    console.log("\n=== RELEVANT CONSOLE LOGS ===");
    const relevantLogs = consoleLogs.filter(
      (log) =>
        log.includes("[ShotDetector]") ||
        log.includes("[Analyzer]") ||
        log.includes("[DEBUG]") ||
        log.includes("Frame "),
    );
    relevantLogs.forEach((log) => console.log(log));

    await browser.close();
  } finally {
    if (server) {
      console.log("\nStopping server...");
      server.kill();
    }
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
