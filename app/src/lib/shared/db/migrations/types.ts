export interface Migration {
  /** Monotonically increasing, unique. */
  version: number;
  /** Human-readable name recorded in commit messages/logs. */
  name: string;
  /** Ordered DDL/DML statements applied inside one transaction. */
  up: string[];
}
