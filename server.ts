#!/usr/bin/env npx tsx
/**
 * Local development server for the Shot Analysis Metrics Validator.
 *
 * This server serves the validation UI and the browser bundle. The actual
 * video analysis runs in the browser using MediaPipe, since MediaPipe requires
 * browser APIs (WebGL, canvas, etc.) that aren't available in Node.js.
 *
 * Usage:
 *   npm run validate           # Builds browser bundle and starts server
 *   npx tsx server.ts [port]   # Just starts server (assumes bundle exists)
 *
 * Then open http://localhost:3000 in your browser.
 *
 * API Endpoints:
 *   GET  /                     - Serves the validator UI
 *   GET  /dist/*               - Serves the browser bundle
 *   POST /api/save-validation  - Saves validation results
 *   GET  /api/validations      - Lists saved validations
 *   POST /api/save-poses       - Saves pose data to test-data/<video-name>/poses.json
 *   POST /api/save-labels      - Saves labels to test-data/<video-name>/labels.json
 */

import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";

const PORT = parseInt(process.argv[2] || "3000", 10);
const VALIDATIONS_DIR = path.join(process.cwd(), "validations");
const TEST_DATA_DIR = path.join(process.cwd(), "test-data");

// Ensure validations directory exists
await fs.mkdir(VALIDATIONS_DIR, { recursive: true });

/**
 * Sanitizes a video filename for use as a directory name.
 * - Removes file extension
 * - Replaces spaces with hyphens
 * - Removes special characters (keeps alphanumeric, hyphens, underscores)
 * - Converts to lowercase
 */
function sanitizeVideoName(videoName: string): string {
  return videoName
    .replace(/\.[^.]+$/, "") // Remove file extension
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9_-]/g, "") // Remove special characters
    .toLowerCase();
}

async function savePoses(data: unknown, videoName: string): Promise<string> {
  const sanitizedName = sanitizeVideoName(videoName);
  const videoDir = path.join(TEST_DATA_DIR, sanitizedName);

  // Create directory if it doesn't exist
  await fs.mkdir(videoDir, { recursive: true });

  const filePath = path.join(videoDir, "poses.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[Save] Poses saved to: ${filePath}`);
  return filePath;
}

async function saveLabels(data: unknown, videoName: string): Promise<string> {
  const sanitizedName = sanitizeVideoName(videoName);
  const videoDir = path.join(TEST_DATA_DIR, sanitizedName);

  // Create directory if it doesn't exist
  await fs.mkdir(videoDir, { recursive: true });

  const filePath = path.join(videoDir, "labels.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[Save] Labels saved to: ${filePath}`);
  return filePath;
}

async function saveValidation(
  data: unknown,
  filename: string,
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = path.join(VALIDATIONS_DIR, `${safeName}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[Save] Validation saved to: ${filePath}`);
  return filePath;
}

async function listValidations(): Promise<string[]> {
  const files = await fs.readdir(VALIDATIONS_DIR);
  return files.filter((f) => f.endsWith(".json"));
}

const VIDEO_EXT_RE = /\.(mp4|mov|webm)$/i;

const VIDEOS_DIR = path.join(TEST_DATA_DIR, "videos");

/**
 * Lists test-data cases that can be loaded in one click: any folder holding
 * both poses.json and labels.json. The shared source videos live in
 * test-data/videos/, keyed by each case's poses.json `video` field, so we
 * report that filename only when the matching video is actually present.
 */
async function listTestCases(): Promise<
  { name: string; video: string | null }[]
> {
  let entries: string[];
  try {
    entries = await fs.readdir(TEST_DATA_DIR);
  } catch {
    return [];
  }
  let videoFiles: Set<string>;
  try {
    videoFiles = new Set(await fs.readdir(VIDEOS_DIR));
  } catch {
    videoFiles = new Set();
  }
  const cases: { name: string; video: string | null }[] = [];
  for (const name of entries.sort()) {
    if (name === "videos") continue;
    const dir = path.join(TEST_DATA_DIR, name);
    let files: string[];
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) continue;
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    if (!files.includes("poses.json") || !files.includes("labels.json")) {
      continue;
    }
    // Resolve the video from the shared videos/ folder via the poses `video`
    // field (falling back to labels.json).
    let video: string | null = null;
    for (const meta of ["poses.json", "labels.json"]) {
      try {
        const parsed = JSON.parse(
          await fs.readFile(path.join(dir, meta), "utf-8"),
        );
        if (typeof parsed.video === "string" && videoFiles.has(parsed.video)) {
          video = parsed.video;
          break;
        }
      } catch {
        // ignore malformed metadata
      }
    }
    cases.push({ name, video });
  }
  return cases;
}

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/**
 * Serves a single file from a test-data case folder (poses.json, labels.json,
 * or the video). Rejects anything with path traversal or a disallowed name.
 */
async function serveTestDataFile(
  res: http.ServerResponse,
  caseName: string,
  fileName: string,
): Promise<void> {
  const safeCase = path.basename(caseName);
  const safeFile = path.basename(fileName);
  const allowed =
    safeFile === "poses.json" ||
    safeFile === "labels.json" ||
    VIDEO_EXT_RE.test(safeFile);
  if (!allowed || safeCase !== caseName || safeFile !== fileName) {
    sendError(res, "Not found", 404);
    return;
  }
  const filePath = path.join(TEST_DATA_DIR, safeCase, safeFile);
  try {
    const content = await fs.readFile(filePath);
    const type =
      CONTENT_TYPES[path.extname(safeFile).toLowerCase()] ??
      "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    sendError(res, "Not found", 404);
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, message: string, status = 500) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

// Check if browser bundle exists
const bundlePath = path.join(process.cwd(), "dist", "shot-analysis.browser.js");
const bundleMapPath = path.join(
  process.cwd(),
  "dist",
  "shot-analysis.browser.js.map",
);

try {
  await fs.access(bundlePath);
} catch {
  console.error("Browser bundle not found at:", bundlePath);
  console.error(
    "Run 'npm run build:browser' first, or use 'npm run validate' to build and start.",
  );
  process.exit(1);
}

// Read the HTML file
const htmlPath = path.join(process.cwd(), "validate-metrics.html");
let htmlContent = await fs.readFile(htmlPath, "utf-8");

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers for local development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  try {
    // Serve HTML UI
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlContent);
      return;
    }

    // Serve browser bundle
    if (
      req.method === "GET" &&
      url.pathname === "/dist/shot-analysis.browser.js"
    ) {
      const content = await fs.readFile(bundlePath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(content);
      return;
    }

    // Serve source map
    if (
      req.method === "GET" &&
      url.pathname === "/dist/shot-analysis.browser.js.map"
    ) {
      try {
        const content = await fs.readFile(bundleMapPath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(content);
      } catch {
        sendError(res, "Source map not found", 404);
      }
      return;
    }

    // Save validation
    if (req.method === "POST" && url.pathname === "/api/save-validation") {
      const body = await readBody(req);
      const { data, filename } = JSON.parse(body);

      if (!data || !filename) {
        sendError(res, "data and filename are required", 400);
        return;
      }

      const filePath = await saveValidation(data, filename);
      sendJson(res, { success: true, path: filePath });
      return;
    }

    // List validations
    if (req.method === "GET" && url.pathname === "/api/validations") {
      const files = await listValidations();
      sendJson(res, { files });
      return;
    }

    // List loadable test cases (folders with poses.json + labels.json)
    if (req.method === "GET" && url.pathname === "/api/test-cases") {
      const cases = await listTestCases();
      sendJson(res, { cases });
      return;
    }

    // Serve placeholder reference assets: /reference/<file>.json
    if (req.method === "GET" && url.pathname.startsWith("/reference/")) {
      const file = path.basename(url.pathname.slice("/reference/".length));
      if (/^[a-zA-Z0-9_-]+\.json$/.test(file)) {
        try {
          const content = await fs.readFile(
            path.join(process.cwd(), "reference", file),
            "utf-8",
          );
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(content);
        } catch {
          sendError(res, "Not found", 404);
        }
        return;
      }
      sendError(res, "Not found", 404);
      return;
    }

    // Serve a file from a test-data case: /test-data/<name>/<file>
    if (req.method === "GET" && url.pathname.startsWith("/test-data/")) {
      const parts = url.pathname.slice("/test-data/".length).split("/");
      if (parts.length === 2 && parts[0] && parts[1]) {
        await serveTestDataFile(
          res,
          decodeURIComponent(parts[0]),
          decodeURIComponent(parts[1]),
        );
        return;
      }
      sendError(res, "Not found", 404);
      return;
    }

    // Save poses
    if (req.method === "POST" && url.pathname === "/api/save-poses") {
      const body = await readBody(req);
      const { data, videoName } = JSON.parse(body);

      if (!data || !videoName) {
        sendError(res, "data and videoName are required", 400);
        return;
      }

      const filePath = await savePoses(data, videoName);
      sendJson(res, { success: true, path: filePath });
      return;
    }

    // Save labels
    if (req.method === "POST" && url.pathname === "/api/save-labels") {
      const body = await readBody(req);
      const { data, videoName } = JSON.parse(body);

      if (!data || !videoName) {
        sendError(res, "data and videoName are required", 400);
        return;
      }

      const filePath = await saveLabels(data, videoName);
      sendJson(res, { success: true, path: filePath });
      return;
    }

    // 404 for unknown routes
    sendError(res, "Not found", 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Server] Error:", message);
    sendError(res, message, 500);
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       Shot Analysis Metrics Validator                     ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT.toString().padEnd(5)}                ║
║                                                           ║
║  1. Open the URL above in your browser                    ║
║  2. Select a video file to analyze                        ║
║  3. Click "Analyze" - analysis runs in your browser       ║
║  4. Review metrics and mark any incorrect values          ║
║  5. Export validation results to ./validations/           ║
║                                                           ║
║  Press Ctrl+C to stop the server                          ║
╚═══════════════════════════════════════════════════════════╝
`);
});
