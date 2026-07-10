/**
 * Injectable time source so anything time-dependent is deterministic in tests.
 */
export interface Clock {
  /** Current time as epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export interface FakeClock extends Clock {
  /** Move time forward by `ms` milliseconds. */
  advance(ms: number): void;
  /** Jump to an absolute epoch-ms time. */
  set(ms: number): void;
}

export function createFakeClock(start = 0): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      if (ms < 0) throw new Error("FakeClock.advance: ms must be >= 0");
      current += ms;
    },
    set(ms: number) {
      current = ms;
    },
  };
}
