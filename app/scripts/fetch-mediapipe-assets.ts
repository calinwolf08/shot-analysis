/**
 * Stages MediaPipe assets into static/mediapipe/ for offline-first serving:
 * - WASM runtime: copied from the locked @mediapipe/tasks-vision npm package
 *   (deterministic; ~22 MB, gitignored, restaged by this script on demand)
 * - Pose landmarker model (.task, "full" variant ~9 MB): committed to the
 *   repo; downloaded here only if missing.
 *
 * Run from app/: npx tsx scripts/fetch-mediapipe-assets.ts
 */
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, "..", "static", "mediapipe");
const wasmDir = join(staticDir, "wasm");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const MODEL_FILE = join(staticDir, "pose_landmarker_full.task");

async function main(): Promise<void> {
  mkdirSync(wasmDir, { recursive: true });

  // 1) WASM runtime from node_modules (resolve via the package main —
  // its exports map does not expose package.json).
  const require = createRequire(import.meta.url);
  const pkgDir = dirname(require.resolve("@mediapipe/tasks-vision"));
  const srcWasmDir = join(pkgDir, "wasm");
  for (const file of readdirSync(srcWasmDir)) {
    copyFileSync(join(srcWasmDir, file), join(wasmDir, file));
  }
  console.log(`WASM runtime staged: ${readdirSync(wasmDir).join(", ")}`);

  // 2) Pose model (download once, keep committed).
  if (existsSync(MODEL_FILE) && statSync(MODEL_FILE).size > 1_000_000) {
    console.log("Pose model already present, skipping download");
  } else {
    console.log(`Downloading pose model from ${MODEL_URL} …`);
    const res = await fetch(MODEL_URL);
    if (!res.ok || !res.body) {
      throw new Error(`Model download failed: HTTP ${res.status}`);
    }
    await pipeline(
      Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
      createWriteStream(MODEL_FILE),
    );
    console.log(
      `Model saved (${(statSync(MODEL_FILE).size / 1048576).toFixed(1)} MB)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
