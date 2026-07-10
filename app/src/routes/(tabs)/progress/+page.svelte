<script lang="ts">
  import { page } from "$app/state";
  import type { BenchmarkProfile } from "$lib/features/benchmarks";
  import {
    ProgressDashboard,
    type ProgressTotals,
    type ScoreHistoryPoint,
  } from "$lib/features/progress";
  import { useAppServices } from "$lib/shared/config/services-context";

  const services = useAppServices();

  let history = $state<ScoreHistoryPoint[] | null>(null);
  let totals = $state<ProgressTotals | null>(null);
  let benchmark = $state<BenchmarkProfile | null>(null);

  $effect(() => {
    void load();
  });

  async function load() {
    const player = await services.repos.player.getFirst();
    if (!player) return;
    benchmark = await services.benchmarks.getActive();
    history = await services.progress.scoreHistory(player.id);
    totals = await services.progress.totals(player.id);
  }

  async function loadTrend(
    metric: Parameters<typeof services.progress.metricTrend>[1],
  ) {
    const player = await services.repos.player.getFirst();
    if (!player) return [];
    return services.progress.metricTrend(player.id, metric);
  }
</script>

<h1>Progress</h1>
{#if history && totals && benchmark}
  <ProgressDashboard
    {history}
    {totals}
    {benchmark}
    {loadTrend}
    sessionHref={(point) =>
      `/progress/session/${point.sessionId}${page.url.search}`}
  />
{:else}
  <p class="loading">Loading…</p>
{/if}

<style>
  h1 {
    margin: 0 0 var(--sc-space-4);
  }
  .loading {
    color: var(--sc-text-dim);
  }
</style>
