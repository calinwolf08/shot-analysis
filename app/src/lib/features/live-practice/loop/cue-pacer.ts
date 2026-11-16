/**
 * Cue pacer: decides WHEN a positioning cue may be spoken so the player has
 * time to react (the old loop re-spoke a cue the instant it changed and every
 * 4 s, which spammed "step back" / "turn" while the player was moving).
 *
 * Rules (all durations from the tuning file):
 *  - a correction cue is spoken only once it has been the current cue for
 *    `holdMs` (a cue that flickers is never spoken);
 *  - after any spoken cue, nothing else for `cooldownMs`;
 *  - the same cue repeats at most every `repeatSameMs`;
 *  - "ready" is spoken once when positioned has held `readyHoldMs`. It skips
 *    the cooldown (the player just fixed their position and should hear it
 *    straight away) and re-arms only after a correction cue has held `holdMs`
 *    (so a brief flicker out of position doesn't produce a second "Ready").
 *
 * Pure + clock-injected; `coachable: false` (analyzing, feedback, muted)
 * suppresses speech without losing the hold timers.
 */
import type { CueTuning } from "../tuning";

/** A correction cue id, or null when positioned. */
export type PacedCue = string | null;

export type PacerOutput =
  | { readonly kind: "cue"; readonly cue: string }
  | { readonly kind: "ready" }
  | null;

export interface PacerSnapshot {
  readonly current: PacedCue;
  /** How long the current state (cue or positioned) has held, ms. */
  readonly heldMs: number;
  /** Remaining global cooldown, ms (0 when none). */
  readonly cooldownLeftMs: number;
  readonly readyAnnounced: boolean;
  readonly lastSpoken: string | null;
}

export interface CuePacer {
  /** Feed the gate's current cue (null = positioned); returns what to speak. */
  update(cue: PacedCue, coachable: boolean): PacerOutput;
  snapshot(): PacerSnapshot;
  reset(): void;
}

export function createCuePacer(
  cfg: CueTuning,
  now: () => number = () => performance.now(),
): CuePacer {
  let current: PacedCue | undefined = undefined;
  let since = 0;
  let lastSpokenAt = Number.NEGATIVE_INFINITY;
  let lastSpoken: string | null = null;
  const lastSaidCueAt = new Map<string, number>();
  let readyAnnounced = false;

  return {
    update(cue, coachable) {
      const t = now();
      if (cue !== current) {
        current = cue;
        since = t;
      }
      const held = t - since;

      if (cue === null) {
        if (readyAnnounced || held < cfg.readyHoldMs || !coachable) return null;
        readyAnnounced = true;
        lastSpokenAt = t;
        lastSpoken = "ready";
        return { kind: "ready" };
      }

      // A correction that has held re-arms "Ready" for the next time.
      if (held >= cfg.holdMs) readyAnnounced = false;

      if (!coachable || held < cfg.holdMs) return null;
      if (t - lastSpokenAt < cfg.cooldownMs) return null;
      const prev = lastSaidCueAt.get(cue);
      if (prev !== undefined && t - prev < cfg.repeatSameMs) return null;

      lastSaidCueAt.set(cue, t);
      lastSpokenAt = t;
      lastSpoken = cue;
      return { kind: "cue", cue };
    },

    snapshot() {
      const t = now();
      return {
        current: current ?? null,
        heldMs: current === undefined ? 0 : t - since,
        cooldownLeftMs: Math.max(0, cfg.cooldownMs - (t - lastSpokenAt)),
        readyAnnounced,
        lastSpoken,
      };
    },

    reset() {
      current = undefined;
      since = 0;
      lastSpokenAt = Number.NEGATIVE_INFINITY;
      lastSpoken = null;
      lastSaidCueAt.clear();
      readyAnnounced = false;
    },
  };
}
