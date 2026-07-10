import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import DrillPlayerScreen from "../components/DrillPlayerScreen.svelte";
import drillsJson from "../data/drills.json";
import { parseDrillFile } from "../schema";

const drill = parseDrillFile(drillsJson).drills.find(
  (d) => d.slug === "guide-hand-discipline",
)!;

describe("DrillPlayerScreen", () => {
  it("renders video, coaching points, and what-this-fixes chips", () => {
    render(DrillPlayerScreen, {
      drill,
      onback: () => {},
      oncomplete: () => {},
    });

    const video = screen.getByTestId<HTMLVideoElement>("drill-video");
    expect(video.getAttribute("src")).toBe("/drills/placeholder.webm");
    expect(video.getAttribute("poster")).toBe("/drills/placeholder-thumb.svg");

    expect(screen.getByText(drill.title)).toBeTruthy();
    expect(screen.getByTestId("placeholder-badge")).toBeTruthy();

    const points = screen.getByTestId("drill-coaching-points");
    expect(points.querySelectorAll("li")).toHaveLength(
      drill.coachingPoints.length,
    );

    const fixes = screen.getByTestId("drill-fixes");
    expect(fixes.textContent).toContain("Guide hand"); // issue group
    expect(fixes.textContent).toContain("Guide hand release"); // metric name
  });

  it("marks complete once: persists via oncomplete then locks the button", async () => {
    const oncomplete = vi.fn().mockResolvedValue(undefined);
    render(DrillPlayerScreen, { drill, onback: () => {}, oncomplete });

    const button = screen.getByTestId<HTMLButtonElement>("drill-complete");
    expect(button.textContent).toContain("Mark complete");
    button.click();
    await vi.waitFor(() => expect(button.disabled).toBe(true));
    expect(button.textContent).toContain("Completed");

    button.click();
    await Promise.resolve();
    expect(oncomplete).toHaveBeenCalledTimes(1);
  });

  it("routes the back button to onback", async () => {
    const onback = vi.fn();
    render(DrillPlayerScreen, { drill, onback, oncomplete: () => {} });
    screen.getByTestId("drill-back").click();
    await Promise.resolve();
    expect(onback).toHaveBeenCalledOnce();
  });
});
