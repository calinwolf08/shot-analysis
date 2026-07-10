import { z } from "zod";
import type { RepoContext } from "../repo-base";

/**
 * Typed settings registry: every setting has a Zod schema + default. Values
 * are stored as JSON strings; corrupted values fall back to the default.
 */
export const SETTINGS = {
  onboarded: { schema: z.boolean(), default: false },
  voiceFeedback: { schema: z.boolean(), default: true },
  activeBenchmarkId: { schema: z.string().nullable(), default: null },
  keepRepClips: { schema: z.boolean(), default: false },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<
  (typeof SETTINGS)[K]["schema"]
>;

export interface SettingsRepo {
  get<K extends SettingKey>(key: K): Promise<SettingValue<K>>;
  set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
}

export function createSettingsRepo(ctx: RepoContext): SettingsRepo {
  const { db } = ctx;
  return {
    async get(key) {
      const spec = SETTINGS[key];
      const rows = await db.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        [key],
      );
      const raw = rows[0]?.value;
      if (raw === undefined) {
        return spec.default as SettingValue<typeof key>;
      }
      try {
        return spec.schema.parse(JSON.parse(raw)) as SettingValue<typeof key>;
      } catch {
        return spec.default as SettingValue<typeof key>;
      }
    },

    async set(key, value) {
      const spec = SETTINGS[key];
      const parsed = spec.schema.parse(value);
      await db.run(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [key, JSON.stringify(parsed)],
      );
    },
  };
}
