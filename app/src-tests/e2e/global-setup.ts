/**
 * Runs once before the suite: wait for the single adapter-node server, then
 * reset the throwaway e2e database to a clean slate (drops user + user-data
 * rows, keeps the seeded global catalogs). Specs still use unique emails, so
 * this is belt-and-suspenders isolation across repeated local runs.
 */
import type { FullConfig } from "@playwright/test";

const BASE = "http://localhost:4173";

async function globalSetup(_config: FullConfig): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) break;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  try {
    await fetch(`${BASE}/api/auth-test/reset`, { method: "POST" });
  } catch {
    // Non-fatal: unique emails already isolate specs.
  }
}

export default globalSetup;
