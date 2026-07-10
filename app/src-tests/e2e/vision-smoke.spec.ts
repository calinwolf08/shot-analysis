/**
 * Vision-stack smoke test: drives the REAL MediaPipe worker (not the replay
 * backend) end-to-end, headless. Feeds a person-less clip (the drill
 * placeholder) through video decode → MediaPipe pose detection → shot
 * detection; since there's no shooter, it must reach the "no shots" state
 * without the vision stack erroring. Proves WASM + WebGL delegate + model
 * load and inference all work headless — the piece the replay tests stub.
 *
 * `?e2e=device` keeps the DB/test hooks on but leaves the real worker in
 * place (only `?e2e=replay` swaps the backend).
 */
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 180_000 });

const PLACEHOLDER_VIDEO = fileURLToPath(
  new URL("../../static/drills/placeholder.webm", import.meta.url),
);

async function onboard(page: Page) {
  await page.goto("/?e2e=device");
  await page.waitForURL("**/onboarding**");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-name").fill("Vision");
  await page.getByTestId("onboarding-to-camera").click();
  await page.getByTestId("onboarding-finish").click();
  await page.waitForURL(/\/\?e2e=device$/);
}

test("real MediaPipe worker runs the full vision pipeline headless", async ({
  page,
}) => {
  const fatal: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") fatal.push(m.text());
  });

  await onboard(page);

  // Non-replay assessment shows the real file input (not the fixture picker).
  await page.getByTestId("start-assessment").click();
  await page.waitForURL("**/assess**");
  await expect(page.getByTestId("assess-file-input")).toBeAttached();

  await page.getByTestId("assess-file-input").setInputFiles(PLACEHOLDER_VIDEO);
  await page.getByTestId("assess-start").click();

  // The real pipeline runs (WASM init + per-frame pose detection). With no
  // shooter in frame it resolves to the no-shots coaching state. A vision
  // failure would instead surface a generic error — assert we got the
  // clean no-shots path.
  await expect(page.getByTestId("assess-no-shots")).toBeVisible({
    timeout: 150_000,
  });
  await expect(page.getByTestId("assess-error")).toHaveCount(0);

  // No WASM/WebGL/model-load errors on the console.
  const visionErrors = fatal.filter((t) =>
    /wasm|webgl|mediapipe|landmark|OFFSCREEN|GL_/i.test(t),
  );
  expect(visionErrors, visionErrors.join("\n")).toEqual([]);
});
