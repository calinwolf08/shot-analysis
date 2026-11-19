import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { onboard, screenPath, startLiveLoop } from "./helpers";

/**
 * Phase 4 — the after-shot sequence, heard and seen:
 *   "captured" tone → "Shot captured" → "Analyzing" → worst metrics → "ready"
 * tone, each waiting for the previous to finish, and no new shot picked up
 * until the ready tone. E2E builds simulate speech durations, so the order and
 * overlap checks are deterministic.
 */

interface Heard {
  t: number;
  kind: string;
  text?: string;
}

const heard = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __scAudioLog?: Heard[] }).__scAudioLog ?? [],
  );

/** Records every status-strip state the page shows, in order. */
async function watchStatus(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __statusSeen?: string[] };
    w.__statusSeen = [];
    const el = document.querySelector('[data-testid="status-strip"]');
    if (!el) throw new Error("no status strip");
    const record = () => {
      const s = el.getAttribute("data-state") ?? "";
      if (w.__statusSeen!.at(-1) !== s) w.__statusSeen!.push(s);
    };
    record();
    new MutationObserver(record).observe(el, { attributes: true });
  });
}
const statusSeen = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __statusSeen?: string[] }).__statusSeen ?? [],
  );

async function start(page: Page, name: string) {
  // One side-on shot, looping at real speed (a new shot every ~5 s).
  await onboard(page, "?e2e=replay&replaySpeed=1", name);
  await startLiveLoop(page);
  await watchStatus(page);
}

test("each shot: captured → analyzing → feedback → ready, never overlapping", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await start(page, "Sequence");

  // Screenshots of each state as a spotter would see them. States are short
  // (simulated speech), so catch each one on whichever shot shows it next
  // (rAF polling); the ORDER is asserted from the recorded log below.
  const shoot = async (state: string, name: string) => {
    await page.waitForFunction(
      (s) =>
        document
          .querySelector('[data-testid="status-strip"]')
          ?.getAttribute("data-state") === s,
      state,
      { polling: "raf", timeout: 40_000 },
    );
    await page.screenshot({ path: screenPath("phase4", name) });
  };
  await shoot("captured", "1-captured");
  await shoot("analyzing", "2-analyzing");
  await shoot("readback", "3-feedback");
  await shoot("ready", "4-ready-card-stays");
  await expect(page.getByTestId("rep-feedback")).toBeVisible();

  // Let at least two more shots happen.
  await expect
    .poll(
      async () =>
        (await heard(page)).filter(
          (e) => e.kind === "earcon" && e.text === "captured",
        ).length,
      { timeout: 40_000 },
    )
    .toBeGreaterThanOrEqual(3);
  await page.getByTestId("practice-pause").click();

  const log = await heard(page);
  // 1) Speech never overlaps: every line ends before the next begins.
  let speaking: string | null = null;
  for (const e of log) {
    if (e.kind === "speak") {
      expect(
        speaking,
        `"${e.text}" started while "${speaking}" was playing`,
      ).toBeNull();
      speaking = e.text ?? "";
    } else if (e.kind === "speak-end") {
      speaking = null;
    }
  }
  // 2) Each shot's cycle completes before the next shot is captured.
  const shotEvents = log.filter(
    (e) =>
      (e.kind === "earcon" && (e.text === "captured" || e.text === "ready")) ||
      (e.kind === "speak" &&
        (e.text === "Shot captured" || e.text === "Analyzing")),
  );
  const cycles: string[][] = [];
  for (const e of shotEvents) {
    const tag = `${e.kind}:${e.text}`;
    if (tag === "earcon:captured") cycles.push([tag]);
    else cycles.at(-1)?.push(tag);
  }
  const complete = cycles.filter((c) => c.includes("earcon:ready"));
  expect(complete.length).toBeGreaterThanOrEqual(2);
  for (const c of complete) {
    expect(c).toEqual([
      "earcon:captured",
      "speak:Shot captured",
      "speak:Analyzing",
      "earcon:ready",
    ]);
  }
  // 3) The readback sits between "Analyzing" ending and the ready tone.
  const i = log.findIndex((e) => e.kind === "speak" && e.text === "Analyzing");
  const next = log
    .slice(i + 1)
    .filter((e) => e.kind === "speak" || e.kind === "earcon");
  expect(next[0]!.kind).toBe("speak"); // the metrics (or "On target")
  expect(next[1]).toMatchObject({ kind: "earcon", text: "ready" });

  // The strip mirrored it for a spotter.
  const seen = (await statusSeen(page)).join(" ");
  expect(seen).toContain("captured analyzing readback ready");
});

test("muted (spotter watching the screen): the strip still walks the sequence", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await start(page, "Muted");
  await page.getByTestId("practice-mute").click();
  await expect(page.getByTestId("rep-feedback")).toBeVisible({
    timeout: 40_000,
  });
  await expect(page.getByTestId("status-strip")).toHaveAttribute(
    "data-state",
    "ready",
  );
  const seen = (await statusSeen(page)).join(" ");
  expect(seen).toMatch(/captured.*readback.*ready/);
  // Nothing audible was logged while muted.
  expect(
    (await heard(page)).filter(
      (e) => e.kind !== "cancel" && e.kind !== "unlock",
    ),
  ).toEqual([]);
});
