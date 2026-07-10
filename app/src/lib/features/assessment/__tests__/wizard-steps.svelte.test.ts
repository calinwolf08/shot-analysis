import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { makeShotAnalysis } from "$lib/shared/testing/fixtures";
import type { ShotRecord } from "$lib/shared/db/repos";
import AnalyzeStep from "../components/AnalyzeStep.svelte";
import ReviewStep from "../components/ReviewStep.svelte";

describe("AnalyzeStep", () => {
  it("renders progress from emitted events", () => {
    render(AnalyzeStep, {
      progress: {
        videoIndex: 1,
        videoCount: 3,
        videoName: "clip-2.mp4",
        analysis: {
          framesProcessed: 250,
          totalFrames: 500,
          shotsDetected: 2,
          phase: "detecting",
        },
        totalShotsDetected: 4,
      },
      oncancel: () => undefined,
    });
    expect(screen.getByTestId("assess-analyze-video").textContent).toContain(
      "Video 2 of 3",
    );
    expect(screen.getByTestId("assess-analyze-phase").textContent).toContain(
      "Detecting pose…",
    );
    expect(screen.getByTestId("assess-analyze-phase").textContent).toContain(
      "50%",
    );
    expect(screen.getByTestId("assess-shots-ticker").textContent).toContain(
      "4",
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "50",
    );
  });

  it("fires oncancel", async () => {
    const oncancel = vi.fn();
    render(AnalyzeStep, { progress: null, oncancel });
    await userEvent.click(screen.getByTestId("assess-cancel"));
    expect(oncancel).toHaveBeenCalledOnce();
  });
});

function makeShotRecord(index: number, excluded = false): ShotRecord {
  return {
    id: `shot-${index}`,
    sessionId: "sess",
    videoId: null,
    shotIndex: index,
    orientation: "side-right",
    startFrame: index * 100,
    endFrame: index * 100 + 60,
    overallConfidence: 0.8,
    excluded,
    analysis: makeShotAnalysis({ shotIndex: index }),
    createdAt: 0,
  };
}

describe("ReviewStep", () => {
  it("renders shot cards and toggles exclusion", async () => {
    const shots = [makeShotRecord(0), makeShotRecord(1)];
    const excluded = new Set<string>();
    const ontoggle = vi.fn((shot: ShotRecord) => {
      if (excluded.has(shot.id)) excluded.delete(shot.id);
      else excluded.add(shot.id);
    });
    const onfinish = vi.fn();

    const { rerender } = render(ReviewStep, {
      shots,
      isExcluded: (s: ShotRecord) => excluded.has(s.id),
      ontoggle,
      onfinish,
    });

    expect(screen.getByTestId("review-shot-0")).toBeTruthy();
    expect(screen.getByTestId("review-shot-1")).toBeTruthy();

    await userEvent.click(screen.getByTestId("review-exclude-0"));
    expect(ontoggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: "shot-0" }),
    );

    await rerender({
      shots,
      isExcluded: (s: ShotRecord) => excluded.has(s.id),
      ontoggle,
      onfinish,
    });
    // Count in the CTA reflects the exclusion.
    expect(screen.getByTestId("assess-finish-review").textContent).toContain(
      "1 shot",
    );

    await userEvent.click(screen.getByTestId("assess-finish-review"));
    expect(onfinish).toHaveBeenCalledOnce();
  });

  it("disables finish when everything is excluded", () => {
    const shots = [makeShotRecord(0, true)];
    render(ReviewStep, {
      shots,
      isExcluded: () => true,
      ontoggle: () => undefined,
      onfinish: () => undefined,
    });
    expect(
      (screen.getByTestId("assess-finish-review") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
