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
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // One SvelteKit adapter-node server: the SPA + the backend API
      // (/api/auth, /api/health, …) on a single origin. VITE_E2E enables the
      // debug/test surfaces; the replay fixtures are copied into the node
      // output. AUTH_E2E exposes the password-reset link for the reset test.
      // Specs use unique emails, so the on-disk e2e DB can persist across runs.
      command:
        "VITE_E2E=1 BUILD_TARGET=node npm run build && node scripts/copy-fixtures-to-build.mjs && AUTH_E2E=1 DATABASE_PATH=data/e2e.sqlite AUTH_SECRET=e2e-secret-change-me-000000 ORIGIN=http://localhost:4173 AUTH_BASE_URL=http://localhost:4173 PORT=4173 node build",
      url: "http://localhost:4173/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
