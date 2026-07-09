import type { Platform } from "../config/platform";
import { isNative } from "../config/platform";
import type { DatabaseAdapter } from "./adapter";
import { createIdbBytesStore } from "./bytes-store";

/**
 * Creates the platform-appropriate DatabaseAdapter:
 * - iOS/Android → @capacitor-community/sqlite
 * - web (dev, e2e) → sql.js persisted to IndexedDB
 * Node tests construct the better-sqlite3 driver directly.
 *
 * Drivers are dynamically imported so only the selected one lands in the
 * client bundle for a given platform.
 */
export async function createDatabase(
  platform: Platform,
): Promise<DatabaseAdapter> {
  if (isNative(platform)) {
    const { createCapacitorSqliteAdapter } =
      await import("./drivers/capacitor-sqlite");
    return createCapacitorSqliteAdapter();
  }
  const { createSqlJsAdapter } = await import("./drivers/sqljs-web");
  const db = await createSqlJsAdapter({
    store: createIdbBytesStore(),
    wasmUrl: "/sqljs/sql-wasm.wasm",
  });
  // Best-effort flush when the page is being torn down (reload/close).
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      void db.flush();
    });
  }
  return db;
}
