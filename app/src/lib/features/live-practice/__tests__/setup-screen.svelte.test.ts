import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type {
  LandmarkFrame,
  LiveAnalysisSession,
} from "$lib/features/analysis";
import { createFakeAudio } from "$lib/shared/audio";
import SetupScreen from "../setup/SetupScreen.svelte";
import { makeCursor, stillPose } from "../coordinator/synthetic-streams";

function fakeSession() {
  const callbacks = new Set<(f: LandmarkFrame) => void>();
  const session: LiveAnalysisSession = {
    fps: 15,
    onFrame(cb) {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    analyzeWindow: () => Promise.reject(new Error("not used in setup")),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };
  return {
    session,
    emit(frames: LandmarkFrame[]) {
      for (const frame of frames) for (const cb of callbacks) cb(frame);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SetupScreen", () => {
  it("flips readiness ticks as replayed pose frames stream in", async () => {
    const { session, emit } = fakeSession();
    const audio = createFakeAudio();
    render(SetupScreen, {
      session,
      audio,
      onstart: () => {},
      onexit: () => {},
    });

    // No camera injected → lighting auto-passes; jsdom has no
    // devicemotion → stability auto-passes.
    expect(screen.getByTestId("check-lighting").dataset.state).toBe("pass");
    expect(screen.getByTestId("check-stability").dataset.state).toBe("pass");
    expect(screen.getByTestId("check-full-body").dataset.state).toBe("pending");

    const start = screen.getByTestId<HTMLButtonElement>("setup-start");
    expect(start.disabled).toBe(true);

    // 2.5 s of full-body side-on pose satisfies the sustained checks.
    emit(stillPose(makeCursor(), 2500));
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId("check-full-body").dataset.state).toBe("pass");
    expect(screen.getByTestId("check-side-view").dataset.state).toBe("pass");
    expect(start.disabled).toBe(false);
  });

  it("lets the user override a failing check", async () => {
    const { session } = fakeSession();
    render(SetupScreen, {
      session,
      audio: createFakeAudio(),
      onstart: () => {},
      onexit: () => {},
    });

    screen.getByTestId("override-full-body").click();
    screen.getByTestId("override-side-view").click();
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId("check-full-body").dataset.state).toBe("pass");
    expect(screen.getByTestId<HTMLButtonElement>("setup-start").disabled).toBe(
      false,
    );
  });

  it("runs a 3-2-1 countdown with beeps, then hands off", async () => {
    const { session, emit } = fakeSession();
    const audio = createFakeAudio();
    const onstart = vi.fn();
    render(SetupScreen, {
      session,
      audio,
      onstart,
      onexit: () => {},
    });

    emit(stillPose(makeCursor(), 2500));
    await vi.advanceTimersByTimeAsync(0);
    screen.getByTestId("setup-start").click();
    await vi.advanceTimersByTimeAsync(0);

    expect(screen.getByTestId("setup-countdown").textContent).toBe("3");
    expect(audio.beeps).toEqual(["count"]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByTestId("setup-countdown").textContent).toBe("2");
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByTestId("setup-countdown").textContent).toBe("1");
    expect(onstart).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(onstart).toHaveBeenCalledOnce();
    expect(audio.beeps).toEqual(["count", "count", "count", "go"]);
    expect(screen.queryByTestId("setup-countdown")).toBeNull();
  });

  it("starts the pose session on mount", () => {
    const { session } = fakeSession();
    render(SetupScreen, {
      session,
      audio: createFakeAudio(),
      onstart: () => {},
      onexit: () => {},
    });
    expect(session.start).toHaveBeenCalledOnce();
  });
});
