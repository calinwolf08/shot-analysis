import type { DatabaseAdapter } from "./adapter";
import type { Clock, IdGenerator } from "../utils";

/** Everything a repository needs; built once in AppServices. */
export interface RepoContext {
  db: DatabaseAdapter;
  clock: Clock;
  ids: IdGenerator;
}

/** SQLite has no boolean type — normalize 0/1. */
export function toBool(v: unknown): boolean {
  return v === 1 || v === true;
}

export function fromBool(v: boolean): number {
  return v ? 1 : 0;
}

/** Parse a JSON column, throwing a descriptive error on corruption. */
export function parseJson<T>(text: string, context: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Corrupted JSON in ${context}`);
  }
}
