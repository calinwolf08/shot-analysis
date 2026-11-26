/** Loads (and caches) the keyframe targets served from static/reference. */
import type { KeyframeTargets } from "basketball-shot-analysis";

export const KEYFRAME_TARGETS_URL = "/reference/live-targets-keyframes.json";

let cache: Promise<KeyframeTargets> | null = null;

export function loadKeyframeTargets(
  fetchImpl: typeof fetch = fetch,
): Promise<KeyframeTargets> {
  cache ??= fetchImpl(KEYFRAME_TARGETS_URL).then((r) => {
    if (!r.ok) throw new Error(`live-targets-keyframes.json: HTTP ${r.status}`);
    return r.json() as Promise<KeyframeTargets>;
  });
  return cache;
}

export function resetKeyframeTargetsCache(): void {
  cache = null;
}
