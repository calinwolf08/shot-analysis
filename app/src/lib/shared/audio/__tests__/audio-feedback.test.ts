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

  it("records earcons and cancels (interruptions)", () => {
    const audio = createFakeAudio();
    audio.playEarcon("analyzing");
    audio.speak("set point low by 2");
    audio.cancel();
    audio.playEarcon("ready");
    expect(audio.earcons).toEqual(["analyzing", "ready"]);
    expect(audio.spoken).toEqual(["set point low by 2"]);
    expect(audio.cancels).toBe(1);
  });

  it("mute suppresses everything until unmuted", () => {
    const audio = createFakeAudio();
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.beep("score");
    audio.speak("ignored");
    audio.playEarcon("analyzing");
    expect(audio.beeps).toEqual([]);
    expect(audio.spoken).toEqual([]);
    expect(audio.earcons).toEqual([]);

    audio.setMuted(false);
    audio.beep("score");
    audio.playEarcon("ready");
    expect(audio.beeps).toEqual(["score"]);
    expect(audio.earcons).toEqual(["ready"]);
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
