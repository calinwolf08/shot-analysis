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
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
