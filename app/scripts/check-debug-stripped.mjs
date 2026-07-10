/**
 * Verifies the production build (no VITE_E2E) contains none of the debug
 * surfaces — the `import.meta.env.VITE_E2E === "1"` guards must be
 * constant-folded away. Run after `npm run build`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MARKERS = [
  "Debug: drill catalog",
  "Debug: replay analysis",
  "debug-analyze-run",
  "debug-drill-list",
];

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, "..", "build");

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(js|html)$/.test(entry)) yield path;
  }
}

const hits = [];
for (const file of walk(buildDir)) {
  const content = readFileSync(file, "utf8");
  for (const marker of MARKERS) {
    if (content.includes(marker)) hits.push(`${marker} → ${file}`);
  }
}

if (hits.length > 0) {
  console.error("check-debug-stripped: debug surfaces leaked into the build:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("check-debug-stripped: OK (no debug surfaces in the build)");
