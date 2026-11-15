/**
 * AudioFeedbackService — countdown beeps (WebAudio) and spoken feedback
 * (speechSynthesis), with a mute switch. Both backends degrade to no-ops
 * when the platform APIs are missing (jsdom, older webviews).
 */

export type BeepKind = "count" | "go" | "score";

/**
 * Short non-speech cues that bracket a live shot: `analyzing` when a shot is
 * recognized and scoring starts, `ready` when the result has been read back and
 * the next shot can begin.
 */
export type EarconKind = "analyzing" | "ready";

export interface AudioFeedbackService {
  beep(kind?: BeepKind): void;
  speak(text: string): void;
  /** Play a bracketing earcon (shot recognized / ready for next). */
  playEarcon(kind: EarconKind): void;
  /** Stop any in-flight speech so the next readback can interrupt it. */
  cancel(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

const BEEP_FREQ: Record<BeepKind, number> = {
  count: 660,
  go: 990,
  score: 880,
};

/** Earcon motifs (ascending pair = "analyzing", single = "ready"). */
const EARCON_TONES: Record<EarconKind, number[]> = {
  analyzing: [660, 880],
  ready: [990],
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

    playEarcon(kind) {
      if (muted) return;
      const ac = audioContext();
      if (!ac) return;
      let t = ac.currentTime;
      for (const freq of EARCON_TONES[kind]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.13);
        t += 0.13;
      }
    },

    cancel() {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
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
  readonly earcons: EarconKind[];
  /** How many times speech was cancelled (interruptions). */
  cancels: number;
}

/** Test double recording every call (mute suppresses recording too). */
export function createFakeAudio(): FakeAudio {
  let muted = false;
  const beeps: BeepKind[] = [];
  const spoken: string[] = [];
  const earcons: EarconKind[] = [];
  const fake: FakeAudio = {
    beeps,
    spoken,
    earcons,
    cancels: 0,
    beep(kind = "count") {
      if (!muted) beeps.push(kind);
    },
    speak(text) {
      if (!muted) spoken.push(text);
    },
    playEarcon(kind) {
      if (!muted) earcons.push(kind);
    },
    cancel() {
      fake.cancels += 1;
    },
    setMuted(next) {
      muted = next;
    },
    isMuted: () => muted,
  };
  return fake;
}
