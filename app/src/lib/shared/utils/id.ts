/**
 * Injectable id source so persisted rows have deterministic ids in tests.
 */
export interface IdGenerator {
  /** Returns a new unique id. */
  next(): string;
}

export const uuidIdGenerator: IdGenerator = {
  next: () => globalThis.crypto.randomUUID(),
};

export interface FakeIdGenerator extends IdGenerator {
  /** How many ids have been handed out. */
  readonly count: number;
}

export function createFakeIdGenerator(prefix = "id"): FakeIdGenerator {
  let n = 0;
  return {
    get count() {
      return n;
    },
    next() {
      n += 1;
      return `${prefix}-${n}`;
    },
  };
}
