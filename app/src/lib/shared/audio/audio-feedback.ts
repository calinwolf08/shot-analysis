/**
 * AudioFeedbackService — beeps/earcons (WebAudio) and spoken feedback
 * (speechSynthesis), with a mute switch. Both backends degrade to no-ops
 * when the platform APIs are missing (jsdom, older webviews).
 *
 * `speak` and `playEarcon` return a Promise that resolves when the sound has
 * FINISHED (immediately when muted or unsupported), so callers can sequence
 * announcements without overlap — e.g. read the shot feedback, THEN play the
 * "ready" tone and resume tracking. Speech resolves on the utterance's end or
 * error event, with a safety timeout (some engines never fire `end`), and on
 * `cancel()`.
 */

export type BeepKind = "count" | "go" | "score";

/**
 * Short non-speech cues around a live shot: `captured` when a shot is
 * recognized, `analyzing` while it's scored, `ready` when tracking resumes.
 */
export type EarconKind = "captured" | "analyzing" | "ready";

export interface AudioFeedbackService {
  beep(kind?: BeepKind): void;
  /** Speak; resolves when finished (or cancelled / muted / unsupported). */
  speak(text: string): Promise<void>;
  /** Play an earcon; resolves when it has finished playing. */
  playEarcon(kind: EarconKind): Promise<void>;
  /** Stop any in-flight speech (its speak() promise resolves). */
  cancel(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

const BEEP_FREQ: Record<BeepKind, number> = {
  count: 660,
  go: 990,
  score: 880,
};

/**
 * Earcon motifs, distinct by contour so they're recognizable through earbuds
 * or across a gym: captured = rising two-note, analyzing = soft single,
 * ready = bright double-tap.
 */
const EARCON_TONES: Record<EarconKind, number[]> = {
  captured: [523, 784],
  analyzing: [660],
  ready: [1047, 1047],
};
const EARCON_GAIN = 0.35;
const EARCON_TONE_S = 0.16;
const EARCON_GAP_S = 0.06;

/** Upper bound for one utterance, in case `end` never fires. */
export function speechTimeoutMs(text: string): number {
  return 2000 + text.length * 90;
}

export function createWebAudioFeedbackService(): AudioFeedbackService {
  let muted = false;
  let ctx: AudioContext | null = null;
  /** Resolvers for utterances still speaking (resolved on cancel). */
  const pending = new Set<() => void>();

  function audioContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") return null;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
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
      if (muted || !text) return Promise.resolve();
      if (typeof speechSynthesis === "undefined") return Promise.resolve();
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          pending.delete(finish);
          resolve();
        };
        const timer = setTimeout(finish, speechTimeoutMs(text));
        pending.add(finish);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.onend = finish;
        utterance.onerror = finish;
        try {
          speechSynthesis.speak(utterance);
        } catch {
          finish();
        }
      });
    },

    playEarcon(kind) {
      if (muted) return Promise.resolve();
      const ac = audioContext();
      if (!ac) return Promise.resolve();
      let t = ac.currentTime;
      for (const freq of EARCON_TONES[kind]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(EARCON_GAIN, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + EARCON_TONE_S);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + EARCON_TONE_S + 0.01);
        t += EARCON_TONE_S + EARCON_GAP_S;
      }
      const ms = (t - ac.currentTime) * 1000;
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    cancel() {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      for (const finish of [...pending]) finish();
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
  /** Every audible call in order, e.g. "earcon:ready", "speak:Shot captured". */
  readonly sequence: string[];
  /** How many times speech was cancelled (interruptions). */
  cancels: number;
}

/**
 * Test double recording every call (mute suppresses recording too). Speech
 * and earcons resolve on the next microtask unless `holdSpeech` is set, in
 * which case each speak() waits until `releaseSpeech()` (or cancel()).
 */
export function createFakeAudio(
  opts: { holdSpeech?: boolean } = {},
): FakeAudio & { releaseSpeech(): void; readonly speaking: number } {
  let muted = false;
  const beeps: BeepKind[] = [];
  const spoken: string[] = [];
  const earcons: EarconKind[] = [];
  const sequence: string[] = [];
  const held: (() => void)[] = [];
  const fake = {
    beeps,
    spoken,
    earcons,
    sequence,
    cancels: 0,
    get speaking() {
      return held.length;
    },
    releaseSpeech() {
      while (held.length) held.shift()!();
    },
    beep(kind: BeepKind = "count") {
      if (!muted) beeps.push(kind);
    },
    speak(text: string) {
      if (muted) return Promise.resolve();
      spoken.push(text);
      sequence.push(`speak:${text}`);
      if (!opts.holdSpeech) return Promise.resolve();
      return new Promise<void>((resolve) => held.push(resolve));
    },
    playEarcon(kind: EarconKind) {
      if (!muted) {
        earcons.push(kind);
        sequence.push(`earcon:${kind}`);
      }
      return Promise.resolve();
    },
    cancel() {
      fake.cancels += 1;
      fake.releaseSpeech();
    },
    setMuted(next: boolean) {
      muted = next;
    },
    isMuted: () => muted,
  };
  return fake;
}
