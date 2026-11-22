/**
 * The targets the app scores with: the pooled pro targets, or re-centred on
 * the pro the user picked in Profile ("Score against"). Every screen that
 * scores shots loads targets through here so they agree.
 */
import type { LiveTargetsV3, ProProfile } from "basketball-shot-analysis";
import type { SettingsRepo } from "$lib/shared/db/repos";
import { loadLiveTargetsV3 } from "$lib/features/scoring/v3/targets";
import { chooseTargets, loadProProfiles } from "./pros";

export async function loadScoringTargets(
  settings: Pick<SettingsRepo, "get">,
  fetchImpl: typeof fetch = fetch,
): Promise<{ targets: LiveTargetsV3; pro: ProProfile | null }> {
  const [pooled, profiles, proId] = await Promise.all([
    loadLiveTargetsV3(fetchImpl),
    loadProProfiles(fetchImpl),
    settings.get("scoreAgainstPro").catch(() => null),
  ]);
  return chooseTargets(pooled, profiles, proId);
}
