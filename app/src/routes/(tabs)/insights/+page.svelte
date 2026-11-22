<script lang="ts">
  import { useAppServices } from "$lib/shared/config/services-context";
  import { displayScore, scoreBand } from "$lib/features/scoring/v3";
  import {
    closestPros,
    loadProProfiles,
    loadScoringTargets,
    userAverages,
    type ProMatch,
  } from "$lib/features/pros";
  import { scoreStoredShots } from "$lib/features/live-practice/review/scored-shots";
  import { phaseName } from "$lib/features/live-practice/loop/readback";
  import {
    INSIGHTS_WINDOWS,
    summarizeInsights,
    windowStart,
    type InsightsSummary,
    type InsightsWindow,
    type ScoredShotAt,
  } from "$lib/features/insights";
  import { LineChart } from "$lib/shared/ui/charts";
  import { EmptyState } from "$lib/shared/ui";

  const services = useAppServices();

  let windowKey = $state<InsightsWindow>("7d");
  let summary = $state<InsightsSummary | null>(null);
  let loading = $state(true);
  /** The pros the user's form is closest to (none until pros are built). */
  let matches = $state<ProMatch[]>([]);
  /** Metric id → label, for the match highlights. */
  let labels = $state<Record<string, string>>({});

  $effect(() => {
    void load(windowKey);
  });

  async function load(key: InsightsWindow) {
    loading = true;
    const player = await services.repos.player.getFirst();
    if (!player) {
      summary = null;
      loading = false;
      return;
    }
    const { targets } = await loadScoringTargets(services.repos.settings);
    const since = windowStart(key, Date.now());
    const shots = await services.repos.shot.listByPlayer(player.id, {
      ...(since > 0 ? { since } : {}),
      limit: 500,
    });
    // Shots that can't be re-analyzed on the v3 metrics are left out.
    const scored: ScoredShotAt[] = (
      await scoreStoredShots(
        services.repos.shot,
        shots,
        player.shootingHand,
        targets,
      )
    )
      .filter((x) => x.card !== null)
      .map((x) => ({ createdAt: x.record.createdAt, scorecard: x.card! }));
    summary = summarizeInsights(scored, { window: key });
    const profiles = await loadProProfiles();
    matches = profiles
      ? closestPros(
          userAverages(scored.map((s) => s.scorecard)),
          profiles,
          targets,
        )
      : [];
    labels = Object.fromEntries(
      Object.entries(targets.metrics).map(([id, t]) => [id, t.label]),
    );
    loading = false;
  }

  const trendValues = $derived(
    (summary?.trend ?? [])
      .map((p) => p.overall)
      .filter((n): n is number => n !== null),
  );

  const BAND_COLOR = {
    good: "#34d399",
    fair: "#fde047",
    off: "#fb923c",
    far: "#f87171",
  } as const;
  function color(n: number | null): string {
    const b = scoreBand(n);
    return b ? BAND_COLOR[b] : "#6b7280";
  }
  const fmt = displayScore;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const phaseLabel = phaseName;
</script>

<main class="insights" data-testid="insights">
  <h1>Insights</h1>

  <div class="windows">
    {#each INSIGHTS_WINDOWS as w (w.key)}
      <button
        class:active={w.key === windowKey}
        data-testid="window-{w.key}"
        onclick={() => (windowKey = w.key)}
      >
        {w.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="dim">Loading…</p>
  {:else if !summary || summary.shotCount === 0}
    <EmptyState
      title="No shots in this window"
      body="Practice some shots and your recurring issues and progress will show up here."
    />
  {:else}
    <section class="overview">
      <div class="avg">
        <span class="num" style="color:{color(summary.avgOverall)}">
          {fmt(summary.avgOverall)}
        </span>
        <span class="sub"
          >avg score · {summary.shotCount} shots · 0 = on target</span
        >
      </div>
      {#if trendValues.length > 1}
        <LineChart
          values={trendValues}
          min={0}
          max={10}
          testid="insights-trend"
        />
      {/if}
    </section>

    <section class="issues" data-testid="insights-issues">
      <h2>Recurring issues</h2>
      {#if summary.issues.length === 0}
        <p class="dim">Nothing consistently off-target — nice.</p>
      {:else}
        <ul>
          {#each summary.issues as issue (issue.id)}
            <li data-testid="issue-{issue.id}">
              <span class="badge" style="background:{color(issue.avgScore)}">
                {displayScore(issue.avgScore)}
              </span>
              <span class="meta">
                <span class="label"
                  ><b class="phase">{phaseLabel(issue.phase)}:</b>
                  {issue.label}{issue.phrase ? ` — ${issue.phrase}` : ""}</span
                >
                <span class="freq">
                  off in {issue.occurrences} of {summary.shotCount}
                  ({pct(issue.frequency)})
                </span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if matches.length > 0}
      <section class="pros" data-testid="insights-pros">
        <h2>Closest pros</h2>
        <ul>
          {#each matches as m (m.pro.id)}
            <li data-testid="pro-match-{m.pro.id}">
              <span class="sim">{m.similarity}%</span>
              <span class="meta">
                <b>{m.pro.name}</b>
                <span class="freq"
                  >Closest: {m.best
                    .map((id) => labels[id] ?? id)
                    .join(", ")}</span
                >
                <span class="freq"
                  >Furthest: {m.worst
                    .map((id) => labels[id] ?? id)
                    .join(", ")}</span
                >
              </span>
            </li>
          {/each}
        </ul>
        <p class="dim small">
          Similarity over {matches[0]?.compared ?? 0} metrics, each measured against
          that pro's own shot-to-shot spread.
        </p>
      </section>
    {/if}
  {/if}
</main>

<style>
  .insights {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 15px;
  }
  .windows {
    display: flex;
    gap: var(--sc-space-2);
    flex-wrap: wrap;
  }
  .windows button {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: var(--sc-text-dim);
    cursor: pointer;
    font-size: 13px;
  }
  .windows button.active {
    background: var(--sc-primary);
    color: #0b1220;
    font-weight: 700;
    border-color: var(--sc-primary);
  }
  .dim {
    color: var(--sc-text-dim);
  }
  .small {
    font-size: 12px;
  }
  .pros ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .pros li {
    display: flex;
    gap: var(--sc-space-3);
    align-items: center;
  }
  .pros .sim {
    min-width: 48px;
    text-align: center;
    font-weight: 700;
    color: var(--sc-primary);
  }
  .pros .meta {
    display: flex;
    flex-direction: column;
  }
  .overview {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  .avg {
    display: flex;
    align-items: baseline;
    gap: var(--sc-space-3);
  }
  .avg .num {
    font-size: 2.6rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .avg .sub {
    color: var(--sc-text-dim);
    font-size: 0.8rem;
  }
  .issues ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .issues li {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
    padding: 8px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
  }
  .badge {
    min-width: 2.4rem;
    text-align: center;
    padding: 4px 0;
    border-radius: 8px;
    font-weight: 800;
    color: #0b1220;
    font-variant-numeric: tabular-nums;
  }
  .meta {
    display: flex;
    flex-direction: column;
  }
  .label {
    font-weight: 600;
  }
  .phase {
    color: var(--sc-primary);
  }
  .freq {
    font-size: 0.78rem;
    color: var(--sc-text-dim);
  }
</style>
