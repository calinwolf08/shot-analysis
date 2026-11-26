/**
 * Shot latency benchmark with REAL MediaPipe: a recorded side-on shot plays
 * as the camera (`?liveVideo=`, looping), and for each shot we time what the
 * player hears (wall clock, from the audio log):
 *   captured → readback: the "shot captured" earcon to the score being spoken
 * plus the full-rate re-check time from the `?debug=capture` file.
 *
 *   LIVE_VIDEO=/path/to/side-on-shot.webm npx playwright test \
 *     src-tests/e2e/manual/shot-latency.spec.ts --project chromium --trace off
 *
 * Skips without LIVE_VIDEO (no real footage is committed). Absolute numbers
 * depend on the machine; compare runs on the same one.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { onboard, startLiveLoop } from "../helpers";

const VIDEO = process.env.LIVE_VIDEO;
const SHOTS = Number(process.env.SHOTS ?? 3) || 3;

test.describe.configure({ timeout: 300_000 });

interface Heard {
  t: number;
  kind: string;
  text?: string;
}

test("captured → spoken score latency", async ({ page }) => {
  test.skip(!VIDEO || !existsSync(VIDEO), "set LIVE_VIDEO to a shot clip");
  const bytes = readFileSync(VIDEO!);
  await page.route(
    (u) => u.pathname === "/__livevideo",
    (route) => route.fulfill({ contentType: "video/webm", body: bytes }),
  );
  await onboard(page, "?e2e=device", "Latency");
  await page.goto(
    `/practice?e2e=device&debug=capture&liveVideo=/__livevideo${process.env.FULL_REFINE ? "&fullRefine=1" : ""}`,
  );
  await page.getByTestId("practice-loop").waitFor({ timeout: 150_000 });
  await startLiveLoop(page);

  const read = () =>
    page.evaluate(
      () =>
        (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
    );
  /** Per shot: captured earcon → first speech after "Analyzing". */
  const cycles = (log: Heard[]) => {
    const out: { capturedAt: number; spokeAt: number; text: string }[] = [];
    for (let i = 0; i < log.length; i++) {
      const e = log[i]!;
      if (e.kind !== "earcon" || e.text !== "captured") continue;
      const a = log.findIndex(
        (x, j) => j > i && x.kind === "speak" && x.text === "Analyzing",
      );
      const r =
        a >= 0
          ? log.findIndex(
              (x, j) => j > a && x.kind === "speak" && x.text !== "Analyzing",
            )
          : -1;
      if (r >= 0)
        out.push({
          capturedAt: e.t,
          spokeAt: log[r]!.t,
          text: log[r]!.text ?? "",
        });
    }
    return out;
  };
  await expect
    .poll(async () => cycles(await read()).length, {
      timeout: 240_000,
      intervals: [2000],
    })
    .toBeGreaterThanOrEqual(SHOTS);
  const done = cycles(await read()).slice(0, SHOTS);

  // Re-check times from the debug capture.
  const dl = page.waitForEvent("download");
  await page.getByTestId("live-capture-download").click();
  const raw = readFileSync((await (await dl).path())!, "utf8");
  // Keep the capture (the scored frames of the last reps) for comparing runs.
  if (process.env.CAPTURE_OUT) writeFileSync(process.env.CAPTURE_OUT, raw);
  const file = JSON.parse(raw) as {
    events: {
      kind: string;
      data?: { ok?: boolean; ms?: number; frames?: number };
    }[];
    meta: { timing?: unknown };
  };
  const refines = file.events
    .filter((e) => e.kind === "refine")
    .map((e) => e.data);
  const ms = done.map((c) => Math.round(c.spokeAt - c.capturedAt));
  // What was heard after each "captured" earcon (ms after it).
  const marks = await page.evaluate(() =>
    performance
      .getEntriesByType("mark")
      .filter((m) => m.name.startsWith("sc:"))
      .map((m) => ({ t: m.startTime, kind: m.name.slice(3) })),
  );
  const log = [...(await read()), ...marks].sort((a, b) => a.t - b.t);
  const timelines = done.map((c) =>
    log
      .filter((e) => e.t >= c.capturedAt - 3000 && e.t <= c.spokeAt + 1)
      .map(
        (e) =>
          `${Math.round(e.t - c.capturedAt)} ${e.kind}${e.text ? ` ${e.text.slice(0, 24)}` : ""}`,
      ),
  );
  console.log(
    JSON.stringify(
      {
        capturedToReadbackMs: ms,
        medianMs: [...ms].sort((a, b) => a - b)[Math.floor(ms.length / 2)],
        refine: refines,
        liveTiming: file.meta.timing,
        readback: done.map((c) => c.text),
        timelines,
      },
      null,
      1,
    ),
  );
});
