import { describe, expect, it, vi } from "vitest";
import { createFakeAudio } from "../audio-feedback";
import {
  simulatedSpeechMs,
  withAudioProbe,
  type AudioLogEntry,
} from "../audio-probe";

describe("withAudioProbe", () => {
  it("logs audible calls (speech start + end) and forwards them", async () => {
    const inner = createFakeAudio();
    const log: AudioLogEntry[] = [];
    let t = 0;
    const audio = withAudioProbe(inner, { log, now: () => (t += 10) });
    await audio.speak("Ready");
    await audio.playEarcon("ready");
    audio.beep();
    audio.cancel();
    expect(log).toEqual([
      { t: 10, kind: "speak", text: "Ready" },
      { t: 20, kind: "speak-end", text: "Ready" },
      { t: 30, kind: "earcon", text: "ready" },
      { t: 40, kind: "beep", text: "count" },
      { t: 50, kind: "cancel" },
    ]);
    expect(inner.spoken).toEqual(["Ready"]);
    expect(inner.earcons).toEqual(["ready"]);
  });

  it("does not log what is muted (not heard)", async () => {
    const inner = createFakeAudio();
    const log: AudioLogEntry[] = [];
    const audio = withAudioProbe(inner, { log });
    audio.setMuted(true);
    await audio.speak("x");
    await audio.playEarcon("analyzing");
    expect(log).toEqual([]);
    expect(audio.isMuted()).toBe(true);
  });

  it("simulates speech duration without the engine; cancel ends it", async () => {
    vi.useFakeTimers();
    try {
      const inner = createFakeAudio();
      const log: AudioLogEntry[] = [];
      const audio = withAudioProbe(inner, {
        log,
        simulateSpeech: simulatedSpeechMs,
      });
      let done = false;
      void audio.speak("Shot captured").then(() => (done = true));
      await vi.advanceTimersByTimeAsync(simulatedSpeechMs("Shot captured") - 1);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
      expect(inner.spoken).toEqual([]); // engine never used

      let cut = false;
      void audio.speak("a long readback line here").then(() => (cut = true));
      audio.cancel();
      await vi.advanceTimersByTimeAsync(0);
      expect(cut).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("simulated length grows with text, with a floor", () => {
    expect(simulatedSpeechMs("Hi")).toBe(400);
    expect(simulatedSpeechMs("x".repeat(20))).toBe(1200);
  });
});
