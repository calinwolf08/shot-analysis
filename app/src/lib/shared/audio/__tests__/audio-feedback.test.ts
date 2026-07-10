import { describe, expect, it } from "vitest";
import {
  createFakeAudio,
  createWebAudioFeedbackService,
} from "../audio-feedback";

describe("createFakeAudio", () => {
  it("records beeps and speech in order", () => {
    const audio = createFakeAudio();
    audio.beep();
    audio.beep("go");
    audio.speak("Nice shot");
    expect(audio.beeps).toEqual(["count", "go"]);
    expect(audio.spoken).toEqual(["Nice shot"]);
  });

  it("mute suppresses everything until unmuted", () => {
    const audio = createFakeAudio();
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.beep("score");
    audio.speak("ignored");
    expect(audio.beeps).toEqual([]);
    expect(audio.spoken).toEqual([]);

    audio.setMuted(false);
    audio.beep("score");
    expect(audio.beeps).toEqual(["score"]);
  });
});

describe("createWebAudioFeedbackService", () => {
  it("degrades to a no-op without WebAudio/speechSynthesis (node)", () => {
    const audio = createWebAudioFeedbackService();
    expect(() => {
      audio.beep("go");
      audio.speak("hello");
    }).not.toThrow();
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    expect(() => audio.beep()).not.toThrow();
  });
});
