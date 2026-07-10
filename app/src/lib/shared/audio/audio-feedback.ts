/**
 * AudioFeedbackService — countdown beeps (WebAudio) and spoken feedback
 * (speechSynthesis), with a mute switch. Both backends degrade to no-ops
 * when the platform APIs are missing (jsdom, older webviews).
 */

export type BeepKind = "count" | "go" | "score";

export interface AudioFeedbackService {
  beep(kind?: BeepKind): void;
  speak(text: string): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

const BEEP_FREQ: Record<BeepKind, number> = {
  count: 660,
  go: 990,
  score: 880,
};

export function createWebAudioFeedbackService(): AudioFeedbackService {
  let muted = false;
  let ctx: AudioContext | null = null;

  function audioContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") return null;
    ctx ??= new AudioContext();
    return ctx;
  }

  return {
    beep(kind = "count") {
      if (muted) return;
      const ac = audioContext();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = BEEP_FREQ[kind];
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.2);
    },

    speak(text) {
      if (muted) return;
      if (typeof speechSynthesis === "undefined") return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      speechSynthesis.speak(utterance);
    },

    setMuted(next) {
      muted = next;
    },

    isMuted: () => muted,
  };
}

export interface FakeAudio extends AudioFeedbackService {
  readonly beeps: BeepKind[];
  readonly spoken: string[];
}

/** Test double recording every call (mute suppresses recording too). */
export function createFakeAudio(): FakeAudio {
  let muted = false;
  const beeps: BeepKind[] = [];
  const spoken: string[] = [];
  return {
    beeps,
    spoken,
    beep(kind = "count") {
      if (!muted) beeps.push(kind);
    },
    speak(text) {
      if (!muted) spoken.push(text);
    },
    setMuted(next) {
      muted = next;
    },
    isMuted: () => muted,
  };
}
