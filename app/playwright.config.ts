import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config: tests the production SPA build served by `vite preview`.
 *
 * Chromium resolution: the CI/dev container preinstalls browsers at
 * $PLAYWRIGHT_BROWSERS_PATH, whose revision may not match this
 * @playwright/test version. Resolution order:
 *   1. PLAYWRIGHT_CHROMIUM_EXECUTABLE env override
 *   2. the container's stable /opt/pw-browsers/chromium symlink
 *   3. playwright's own downloaded browser (default)
 */
const containerChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync(containerChromium) ? containerChromium : undefined);

export default defineConfig({
  testDir: "src-tests/e2e",
  globalSetup: "./src-tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      // Full suite against the PRODUCTION build (adapter-node), the artifact
      // we ship.
      name: "chromium",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4173" },
    },
    {
      // Tier B — parity smoke against the DEV server (vite dev), the thing you
      // actually run locally. Its on-demand ESM resolution differs from the
      // bundled prod build, so dev-only breakage (e.g. a case-only filename
      // collision resolving to the wrong module) shows up here and nowhere
      // else. Kept to the page-load + navigation smoke to stay fast.
      name: "chromium-dev",
      testMatch: ["**/smoke.spec.ts", "**/navigation.spec.ts"],
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5174" },
    },
  ],
  webServer: [
    {
      // One SvelteKit adapter-node server: the SPA + the backend API
      // (/api/auth, /api/health, …) on a single origin. VITE_E2E enables the
      // debug/test surfaces; the replay fixtures are copied into the node
      // output. AUTH_E2E exposes the password-reset link for the reset test.
      // Specs use unique emails, so the on-disk e2e DB can persist across runs.
      // BODY_SIZE_LIMIT is raised well above adapter-node's 512K default:
      // assessment/live POST multi-MB pose payloads to /api/analysis/* (see
      // docs/hosting-and-deployment.md).
      command:
        "VITE_E2E=1 BUILD_TARGET=node npm run build && node scripts/copy-fixtures-to-build.mjs && AUTH_E2E=1 BODY_SIZE_LIMIT=64M DATABASE_PATH=data/e2e.sqlite AUTH_SECRET=e2e-secret-change-me-000000 ORIGIN=http://localhost:4173 AUTH_BASE_URL=http://localhost:4173 PORT=4173 node build",
      url: "http://localhost:4173/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      // Tier B dev server: the same app served by `vite dev` on its own port
      // and throwaway DB. Catches dev-only runtime breakage the prod build
      // can't reproduce.
      command:
        "VITE_E2E=1 AUTH_E2E=1 BODY_SIZE_LIMIT=64M DATABASE_PATH=data/e2e-dev.sqlite AUTH_SECRET=e2e-secret-change-me-000000 ORIGIN=http://localhost:5174 AUTH_BASE_URL=http://localhost:5174 npm run dev -- --port 5174 --strictPort",
      url: "http://localhost:5174/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
