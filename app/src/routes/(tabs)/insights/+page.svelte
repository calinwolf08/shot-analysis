<script lang="ts">
  import { useAppServices } from "$lib/shared/config/services-context";
  import { scorecardForShot } from "$lib/features/live-practice";
  import { loadLiveTargets } from "$lib/features/scoring";
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
    const targets = await loadLiveTargets();
    const since = windowStart(key, Date.now());
    const shots = await services.repos.shot.listByPlayer(player.id, {
      ...(since > 0 ? { since } : {}),
      limit: 500,
    });
    const scored: ScoredShotAt[] = shots.map((s) => ({
      createdAt: s.createdAt,
      scorecard: scorecardForShot(s.analysis, targets),
    }));
    summary = summarizeInsights(scored, { window: key });
    loading = false;
  }

  const trendValues = $derived(
    (summary?.trend ?? [])
      .map((p) => p.overall)
      .filter((n): n is number => n !== null),
  );

  function color(n: number | null): string {
    if (n === null) return "#6b7280";
    if (n <= 1.5) return "#34d399";
    if (n <= 4) return "#fbbf24";
    return "#f87171";
  }
  const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(1));
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const PHASE_LABELS: Record<string, string> = {
    gather: "Gather",
    load: "Load",
    rise: "Rise",
    setPoint: "Set Point",
    release: "Release",
    followThrough: "Follow-through",
    sequencing: "Sequencing",
  };
  const phaseLabel = (p: string) => PHASE_LABELS[p] ?? p;
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
          >avg score · {summary.shotCount} shots · lower is better</span
        >
      </div>
      {#if trendValues.length > 1}
        <LineChart
          values={trendValues}
          min={1}
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
                {issue.avgScore.toFixed(1)}
              </span>
              <span class="meta">
                <span class="label">{issue.label}</span>
                <span class="freq">
                  off in {issue.occurrences} of {summary.shotCount}
                  ({pct(issue.frequency)}) · {phaseLabel(issue.phase)}
                </span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
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
  .freq {
    font-size: 0.78rem;
    color: var(--sc-text-dim);
  }
</style>
