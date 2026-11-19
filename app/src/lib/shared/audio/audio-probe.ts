/**
 * Audio probe for dev/E2E builds: wraps an AudioFeedbackService and mirrors
 * every audible call into `window.__scAudioLog`, so e2e specs can assert what
 * the player would HEAR (cue spacing, announcement order, overlap) without
 * real audio. Muted calls are not logged — they're not heard.
 *
 * Speech logs a `speak` entry when it starts and `speak-end` when it finishes.
 * With `simulateSpeech`, speech isn't sent to the engine at all: it "lasts" a
 * deterministic time from its length (headless browsers have no voices, so a
 * real utterance would end instantly or never), which makes timing assertions
 * stable.
 *
 * Only wired when `import.meta.env.DEV || VITE_E2E === "1"`; production builds
 * never install it (checked by scripts/check-debug-stripped.mjs).
 */
import type { AudioFeedbackService } from "./audio-feedback";

export interface AudioLogEntry {
  /** performance.now() when the call was made. */
  readonly t: number;
  readonly kind:
    | "speak"
    | "speak-end"
    | "earcon"
    | "beep"
    | "cancel"
    | "unlock";
  /** Spoken text, earcon/beep kind; absent for cancel. */
  readonly text?: string;
}

declare global {
  interface Window {
    __scAudioLog?: AudioLogEntry[];
  }
}

export interface AudioProbeOptions {
  /** Where entries go (default: window.__scAudioLog). */
  readonly log?: AudioLogEntry[];
  readonly now?: () => number;
  /** Fake speech duration instead of the real engine (E2E). */
  readonly simulateSpeech?: (text: string) => number;
}

/** Deterministic E2E speech length: ~60 ms per character, at least 400 ms. */
export const simulatedSpeechMs = (text: string): number =>
  Math.max(400, text.length * 60);

export function withAudioProbe(
  inner: AudioFeedbackService,
  opts: AudioProbeOptions = {},
): AudioFeedbackService {
  const log = opts.log ?? installGlobalLog();
  const now = opts.now ?? (() => performance.now());
  const push = (kind: AudioLogEntry["kind"], text?: string) => {
    log.push(
      text === undefined ? { t: now(), kind } : { t: now(), kind, text },
    );
  };
  const simulated = new Set<() => void>();

  function fakeSpeak(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        simulated.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      simulated.add(finish);
    });
  }

  return {
    beep(kind) {
      if (!inner.isMuted()) push("beep", kind ?? "count");
      inner.beep(kind);
    },
    async speak(text) {
      if (inner.isMuted() || !text) return;
      push("speak", text);
      if (opts.simulateSpeech) await fakeSpeak(opts.simulateSpeech(text));
      else await inner.speak(text);
      push("speak-end", text);
    },
    playEarcon(kind) {
      if (!inner.isMuted()) push("earcon", kind);
      return inner.playEarcon(kind);
    },
    cancel() {
      push("cancel");
      for (const finish of [...simulated]) finish();
      inner.cancel();
    },
    unlock() {
      push("unlock");
      inner.unlock();
    },
    setMuted: (m) => inner.setMuted(m),
    isMuted: () => inner.isMuted(),
  };
}

function installGlobalLog(): AudioLogEntry[] {
  if (typeof window === "undefined") return [];
  window.__scAudioLog ??= [];
  return window.__scAudioLog;
}
