/**
 * Repository contract (implemented on the server with Kysely —
 * lib/server/repos.ts; the browser uses the API-backed remote repos).
 */
import { z } from "zod";

/**
 * Typed settings registry: every setting has a Zod schema + default. Values
 * are stored as JSON strings; corrupted values fall back to the default.
 */
export const SETTINGS = {
  onboarded: { schema: z.boolean(), default: false },
  voiceFeedback: { schema: z.boolean(), default: true },
  activeBenchmarkId: { schema: z.string().nullable(), default: null },
  keepRepClips: { schema: z.boolean(), default: false },
  /** Live-lesson focus-area ids; [] = coach on everything. */
  liveFocusAreas: { schema: z.array(z.string()), default: [] as string[] },
  /** Score against one pro (pro-profiles id) instead of all pros; null = all. */
  scoreAgainstPro: { schema: z.string().nullable(), default: null },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<
  (typeof SETTINGS)[K]["schema"]
>;

export interface SettingsRepo {
  get<K extends SettingKey>(key: K): Promise<SettingValue<K>>;
  set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
}
