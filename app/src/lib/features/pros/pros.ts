/**
 * Pro profiles in the app (docs/pro-targets-plan.md, Phase 5):
 *
 *  - `static/reference/pro-profiles.json` (built by `npm run
 *    targets:build:pros`): each pro's value + spread per metric. Absent until
 *    the first build — everything here then degrades to "no pros".
 *  - **Closest pros:** the user's average per metric vs each pro, each
 *    difference measured in that pro's own spread (floored so a very
 *    consistent pro doesn't dominate), averaged over the metrics both have.
 *  - **Score against a pro:** the pooled targets re-centred on one pro — the
 *    band keeps the pooled width (same strictness) around that pro's value,
 *    and "style" metrics (unscored in the pooled targets) are scored, since
 *    matching a pro's style is the point.
 */
import type {
  LiveTargetsV3,
  ProProfile,
  ProProfiles,
  TargetV3,
} from "basketball-shot-analysis";
import type { ScorecardV3 } from "$lib/features/scoring/v3";

export const PRO_PROFILES_URL = "/reference/pro-profiles.json";

let cache: Promise<ProProfiles | null> | null = null;

/** The pro profiles, or null when none have been built. */
export function loadProProfiles(
  fetchImpl: typeof fetch = fetch,
): Promise<ProProfiles | null> {
  cache ??= fetchImpl(PRO_PROFILES_URL)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as ProProfiles;
      return Array.isArray(j?.pros) && j.pros.length > 0 ? j : null;
    })
    .catch(() => null);
  return cache;
}

export function resetProProfilesCache(): void {
  cache = null;
}

// ---- score against a pro ---------------------------------------------------------

/** The pooled targets re-centred on one pro (see header). */
export function targetsForPro(
  pooled: LiveTargetsV3,
  pro: ProProfile,
): LiveTargetsV3 {
  const metrics: Record<string, TargetV3> = {};
  for (const [id, t] of Object.entries(pooled.metrics)) {
    const p = pro.metrics[id];
    if (!p || t.kind === "detail") {
      metrics[id] = t;
      continue;
    }
    const lo = t.override?.passMin ?? t.passMin;
    const hi = t.override?.passMax ?? t.passMax;
    const half = Math.max(p.spread, (hi - lo) / 2);
    // The pro band replaces any hand-set band; a hand-set "scored: false"
    // still wins (it's an explicit call that the metric isn't usable).
    const { override, ...rest } = t;
    metrics[id] = {
      ...rest,
      ideal: p.value,
      passMin: p.value - half,
      passMax: p.value + half,
      scored: override?.scored ?? (t.scored || t.style === true),
      ...(override?.scored !== undefined
        ? { override: { scored: override.scored } }
        : {}),
    };
  }
  return {
    ...pooled,
    builtFrom: `${pooled.builtFrom} — re-centred on ${pro.name}`,
    metrics,
  };
}

/**
 * The targets to score with: the pooled targets, or re-centred on the pro the
 * user picked (`scoreAgainstPro` setting) when that pro exists.
 */
export function chooseTargets(
  pooled: LiveTargetsV3,
  profiles: ProProfiles | null,
  proId: string | null,
): { targets: LiveTargetsV3; pro: ProProfile | null } {
  const pro = proId
    ? (profiles?.pros.find((p) => p.id === proId) ?? null)
    : null;
  return pro
    ? { targets: targetsForPro(pooled, pro), pro }
    : { targets: pooled, pro: null };
}

// ---- closest pros ------------------------------------------------------------------

export interface UserMetric {
  readonly mean: number;
  readonly n: number;
}

/** The user's mean value per metric over their scored shots. */
export function userAverages(
  cards: readonly ScorecardV3[],
): Record<string, UserMetric> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const c of cards) {
    for (const r of [...c.phases.flatMap((p) => p.metrics), ...c.details]) {
      if (r.value === null || !Number.isFinite(r.value)) continue;
      const e = acc.get(r.id) ?? { sum: 0, n: 0 };
      e.sum += r.value;
      e.n += 1;
      acc.set(r.id, e);
    }
  }
  return Object.fromEntries(
    [...acc].map(([id, e]) => [id, { mean: e.sum / e.n, n: e.n }]),
  );
}

export interface ProMatch {
  readonly pro: ProProfile;
  /** Mean difference in pro spreads (0 = identical; lower = closer). */
  readonly distance: number;
  /** 0–100: a friendly similarity (100 = identical, 0 at 3+ spreads apart). */
  readonly similarity: number;
  readonly compared: number;
  /** Metric ids closest to / furthest from this pro, best first / worst first. */
  readonly best: readonly string[];
  readonly worst: readonly string[];
}

/** Minimum user shots per metric for it to count in the comparison. */
export const MIN_USER_SHOTS = 3;

export function closestPros(
  user: Readonly<Record<string, UserMetric>>,
  profiles: ProProfiles,
  targets: LiveTargetsV3,
  opts: { top?: number; highlights?: number } = {},
): ProMatch[] {
  const matches: ProMatch[] = [];
  for (const pro of profiles.pros) {
    const diffs: { id: string; d: number }[] = [];
    for (const [id, p] of Object.entries(pro.metrics)) {
      const u = user[id];
      const t = targets.metrics[id];
      if (!u || u.n < MIN_USER_SHOTS || !t || t.kind === "detail") continue;
      // Floor the spread: half the pooled score step.
      const scale = Math.max(p.spread, t.rampSd * 0.5, 1e-9);
      diffs.push({ id, d: Math.abs(u.mean - p.value) / scale });
    }
    if (diffs.length === 0) continue;
    const distance = diffs.reduce((s, x) => s + x.d, 0) / diffs.length;
    const sorted = [...diffs].sort((a, b) => a.d - b.d);
    const k = opts.highlights ?? 3;
    matches.push({
      pro,
      distance,
      similarity: Math.round(100 * Math.max(0, 1 - distance / 3)),
      compared: diffs.length,
      best: sorted.slice(0, k).map((x) => x.id),
      worst: sorted
        .slice(-k)
        .reverse()
        .map((x) => x.id),
    });
  }
  return matches
    .sort((a, b) => a.distance - b.distance)
    .slice(0, opts.top ?? 3);
}
