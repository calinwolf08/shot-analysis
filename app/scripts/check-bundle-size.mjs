/**
 * Initial-JS budget check: sums the gzipped size of every script the SPA
 * shell (build/index.html) loads up front — <script src>, module preload
 * links, and the inline bootstrap's static imports. Fails when the total
 * exceeds the budget (MediaPipe + the worker must stay lazy-loaded).
 *
 * Run after `npm run build`: node scripts/check-bundle-size.mjs
 */
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUDGET_KB = 350;

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, "..", "build");

const html = readFileSync(join(buildDir, "index.html"), "utf8");

const files = new Set();
// Attribute order varies (href before rel in SvelteKit's output).
for (const [link] of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*>/g)) {
  const href = link.match(/href="([^"]+)"/)?.[1];
  if (href) files.add(href);
}
for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  files.add(src);
}
// The inline bootstrap imports the entry modules directly.
for (const [, href] of html.matchAll(/import\("([^"]+\.js)"\)/g)) {
  files.add(href);
}

if (files.size === 0) {
  console.error("check-bundle-size: no initial scripts found in index.html");
  process.exit(1);
}

let total = 0;
const rows = [];
for (const href of [...files].sort()) {
  const path = join(buildDir, href.replace(/^\.?\//, ""));
  const gz = gzipSync(readFileSync(path)).length;
  total += gz;
  rows.push(`${(gz / 1024).toFixed(1).padStart(8)} KB  ${href}`);
}

console.log("Initial JS (gzip):");
for (const row of rows) console.log(row);
const totalKb = total / 1024;
console.log(
  `${"-".repeat(40)}\n${totalKb.toFixed(1)} KB total (budget ${BUDGET_KB} KB)`,
);

if (totalKb > BUDGET_KB) {
  console.error(
    `check-bundle-size: initial JS ${totalKb.toFixed(1)} KB exceeds the ${BUDGET_KB} KB budget`,
  );
  process.exit(1);
}
console.log("check-bundle-size: OK");
