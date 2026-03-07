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
 */

import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";

const PORT = parseInt(process.argv[2] || "3000", 10);
const VALIDATIONS_DIR = path.join(process.cwd(), "validations");

// Ensure validations directory exists
await fs.mkdir(VALIDATIONS_DIR, { recursive: true });

async function saveValidation(data: unknown, filename: string): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = path.join(VALIDATIONS_DIR, `${safeName}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[Save] Validation saved to: ${filePath}`);
  return filePath;
}

async function listValidations(): Promise<string[]> {
  const files = await fs.readdir(VALIDATIONS_DIR);
  return files.filter(f => f.endsWith(".json"));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
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
const bundleMapPath = path.join(process.cwd(), "dist", "shot-analysis.browser.js.map");

try {
  await fs.access(bundlePath);
} catch {
  console.error("Browser bundle not found at:", bundlePath);
  console.error("Run 'npm run build:browser' first, or use 'npm run validate' to build and start.");
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
    if (req.method === "GET" && url.pathname === "/dist/shot-analysis.browser.js") {
      const content = await fs.readFile(bundlePath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(content);
      return;
    }

    // Serve source map
    if (req.method === "GET" && url.pathname === "/dist/shot-analysis.browser.js.map") {
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
