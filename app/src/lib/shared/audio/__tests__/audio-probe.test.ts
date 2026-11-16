import { describe, expect, it } from "vitest";
import { createFakeAudio } from "../audio-feedback";
import { withAudioProbe, type AudioLogEntry } from "../audio-probe";

describe("withAudioProbe", () => {
  it("logs audible calls and forwards them", () => {
    const inner = createFakeAudio();
    const log: AudioLogEntry[] = [];
    let t = 0;
    const audio = withAudioProbe(inner, log, () => (t += 10));
    audio.speak("Ready");
    audio.playEarcon("ready");
    audio.beep();
    audio.cancel();
    expect(log).toEqual([
      { t: 10, kind: "speak", text: "Ready" },
      { t: 20, kind: "earcon", text: "ready" },
      { t: 30, kind: "beep", text: "count" },
      { t: 40, kind: "cancel" },
    ]);
    expect(inner.spoken).toEqual(["Ready"]);
    expect(inner.earcons).toEqual(["ready"]);
  });

  it("does not log what is muted (not heard)", () => {
    const inner = createFakeAudio();
    const log: AudioLogEntry[] = [];
    const audio = withAudioProbe(inner, log);
    audio.setMuted(true);
    audio.speak("x");
    audio.playEarcon("analyzing");
    expect(log).toEqual([]);
    expect(audio.isMuted()).toBe(true);
  });
});
