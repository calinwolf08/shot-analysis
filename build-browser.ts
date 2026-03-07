#!/usr/bin/env npx tsx
/**
 * Build script for creating a browser bundle of the shot analysis library.
 *
 * This creates a UMD bundle that can be loaded directly in the browser
 * via a script tag. The library is exposed as `window.ShotAnalysis`.
 *
 * Usage:
 *   npx tsx build-browser.ts
 *
 * Output:
 *   dist/shot-analysis.browser.js
 */

import * as esbuild from "esbuild";
import * as path from "path";

async function build() {
  console.log("Building browser bundle...");

  const result = await esbuild.build({
    entryPoints: [path.join(process.cwd(), "src/browser-entry.ts")],
    bundle: true,
    minify: false, // Keep unminified for debugging
    sourcemap: true,
    format: "iife",
    globalName: "ShotAnalysis",
    outfile: path.join(process.cwd(), "dist/shot-analysis.browser.js"),
    platform: "browser",
    target: ["es2020", "chrome90", "firefox88", "safari14"],
    // External dependencies that should come from CDN
    external: [],
    // Define environment
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    // Handle Node.js built-ins
    plugins: [
      {
        name: "node-externals",
        setup(build) {
          // Mark node-only modules as external/empty for browser
          build.onResolve({ filter: /^(fs|path|os|child_process)/ }, () => {
            return { path: "empty", namespace: "node-empty" };
          });
          build.onLoad({ filter: /.*/, namespace: "node-empty" }, () => {
            return { contents: "export default {}" };
          });
        },
      },
    ],
  });

  if (result.errors.length > 0) {
    console.error("Build errors:", result.errors);
    process.exit(1);
  }

  console.log("Browser bundle created: dist/shot-analysis.browser.js");
  console.log(
    'Include in HTML: <script src="dist/shot-analysis.browser.js"></script>',
  );
  console.log("Access via: window.ShotAnalysis");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
