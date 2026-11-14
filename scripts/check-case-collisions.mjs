#!/usr/bin/env node
/**
 * Fails when two git-tracked paths differ only by case (e.g. Toast.svelte vs
 * toast.svelte.ts). Such collisions resolve inconsistently across tooling —
 * Vite's dev server picked the wrong `./toast.svelte`, breaking the app in dev
 * while the production build stayed green — and they break outright on
 * case-insensitive filesystems (macOS/Windows). Deterministic, no network, no
 * browser.
 *
 * Run from the repo root: node scripts/check-case-collisions.mjs
 */
import { execSync } from "node:child_process";

/** @type {Map<string, string[]>} lowercased path -> actual paths */
const byLower = new Map();

// Always scan the whole repo, whichever directory this is invoked from
// (root `check:case` or the app workspace's `verify`).
const root = execSync("git rev-parse --show-toplevel", {
  encoding: "utf8",
}).trim();
const files = execSync("git ls-files", { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

for (const path of files) {
  const key = path.toLowerCase();
  const group = byLower.get(key);
  if (group) group.push(path);
  else byLower.set(key, [path]);
}

const collisions = [...byLower.values()].filter(
  (group) => new Set(group).size > 1,
);

if (collisions.length > 0) {
  console.error(
    "Case-only filename collision(s) found — rename so paths differ by more than case:\n",
  );
  for (const group of collisions) {
    console.error("  " + group.join("  <>  "));
  }
  console.error(
    "\nThese resolve inconsistently (Vite dev vs prod build) and break on " +
      "case-insensitive filesystems.",
  );
  process.exit(1);
}

console.log(
  `No case-only filename collisions (${files.length} tracked files).`,
);
