import type { DatabaseAdapter } from "../adapter";

/**
 * Shared BEGIN/COMMIT + savepoint nesting logic for drivers whose engines
 * only expose plain statement execution.
 */
export async function runInTransaction<T>(
  adapter: DatabaseAdapter,
  exec: (sql: string) => Promise<void> | void,
  depth: { value: number },
  fn: (tx: DatabaseAdapter) => Promise<T>,
): Promise<T> {
  const savepoint = `sp_${depth.value}`;
  const begin = depth.value === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`;
  const commit =
    depth.value === 0 ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`;
  const rollbackStmts =
    depth.value === 0
      ? ["ROLLBACK"]
      : [
          `ROLLBACK TO SAVEPOINT ${savepoint}`,
          `RELEASE SAVEPOINT ${savepoint}`,
        ];

  await exec(begin);
  depth.value += 1;
  try {
    const result = await fn(adapter);
    depth.value -= 1;
    await exec(commit);
    return result;
  } catch (err) {
    depth.value -= 1;
    for (const stmt of rollbackStmts) await exec(stmt);
    throw err;
  }
}
