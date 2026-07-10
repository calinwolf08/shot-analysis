import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __shotcoach?: {
      run: (sql: string, params?: unknown[]) => Promise<unknown>;
      query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    };
  }
}

test("app boots the web database and persists across reload", async ({
  page,
}) => {
  await page.goto("/?e2e=1");
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });

  // Write a setting through the debug hook…
  await page.evaluate(async () => {
    await window.__shotcoach!.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      ["e2e-probe", "persisted-value"],
    );
  });

  // Give the debounced IndexedDB persistence a beat to flush.
  await page.waitForTimeout(500);

  // …reload and confirm it survived (sql.js image restored from IndexedDB).
  await page.goto("/?e2e=1");
  await page.waitForSelector('[data-testid="db-ready"]', { state: "attached" });
  const value = await page.evaluate(async () => {
    const rows = (await window.__shotcoach!.query(
      "SELECT value FROM settings WHERE key = ?",
      ["e2e-probe"],
    )) as { value: string }[];
    return rows[0]?.value;
  });
  expect(value).toBe("persisted-value");
});
