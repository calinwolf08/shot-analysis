/**
 * Audio probe for dev/E2E builds: wraps an AudioFeedbackService and mirrors
 * every audible call into `window.__scAudioLog`, so e2e specs can assert what
 * the player would HEAR (cue spacing, announcement order) without real audio.
 * Muted calls are not logged — they're not heard.
 *
 * Only wired when `import.meta.env.DEV || VITE_E2E === "1"`; production builds
 * never install it (checked by scripts/check-debug-stripped.mjs).
 */
import type { AudioFeedbackService } from "./audio-feedback";

export interface AudioLogEntry {
  /** performance.now() when the call was made. */
  readonly t: number;
  readonly kind: "speak" | "earcon" | "beep" | "cancel";
  /** Spoken text, earcon/beep kind; absent for cancel. */
  readonly text?: string;
}

declare global {
  interface Window {
    __scAudioLog?: AudioLogEntry[];
  }
}

export function withAudioProbe(
  inner: AudioFeedbackService,
  log: AudioLogEntry[] = installGlobalLog(),
  now: () => number = () => performance.now(),
): AudioFeedbackService {
  const push = (kind: AudioLogEntry["kind"], text?: string) => {
    log.push(
      text === undefined ? { t: now(), kind } : { t: now(), kind, text },
    );
  };
  return {
    beep(kind) {
      if (!inner.isMuted()) push("beep", kind ?? "count");
      inner.beep(kind);
    },
    speak(text) {
      if (!inner.isMuted()) push("speak", text);
      inner.speak(text);
    },
    playEarcon(kind) {
      if (!inner.isMuted()) push("earcon", kind);
      inner.playEarcon(kind);
    },
    cancel() {
      push("cancel");
      inner.cancel();
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
