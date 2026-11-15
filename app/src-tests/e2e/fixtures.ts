/**
 * Shared test fixture that makes "no browser console errors" a default
 * assertion for EVERY spec that imports `test` from here. A console error or an
 * uncaught page error anywhere in a test fails that test — this is what catches
 * runtime breakage a human would hit (a missing export, a 404'd asset, a thrown
 * component) that API-level assertions miss.
 *
 * The listener is an `auto` fixture, so it attaches even when a test never
 * references it. A test that legitimately expects an error can whitelist it:
 *
 *   test("...", async ({ page, allowConsoleErrors }) => {
 *     allowConsoleErrors(/known benign message/);
 *     ...
 *   });
 */
import { test as base, expect } from "@playwright/test";

/** Benign noise that isn't a real app fault. Keep this list short. */
const DEFAULT_ALLOW: (string | RegExp)[] = [
  /favicon\.ico/i, // browser auto-requests it; the app doesn't ship one
];

type Fixtures = {
  /** Add patterns for console errors this test should tolerate. */
  allowConsoleErrors: (...patterns: (string | RegExp)[]) => void;
};

export const test = base.extend<Fixtures>({
  allowConsoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      const allow = [...DEFAULT_ALLOW];

      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      await use((...patterns) => allow.push(...patterns));

      const leaked = errors.filter(
        (e) =>
          !allow.some((p) =>
            typeof p === "string" ? e.includes(p) : p.test(e),
          ),
      );
      expect(
        leaked,
        `Unexpected browser console error(s) during "${testInfo.title}"`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
