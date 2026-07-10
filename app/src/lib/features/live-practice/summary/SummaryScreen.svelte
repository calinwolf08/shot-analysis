<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { builtInBenchmarks, type MetricName } from "$lib/features/benchmarks";
  import type { RepScore } from "$lib/features/scoring";
  import { createPlanRepo } from "$lib/features/training-plan";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { flushDb } from "$lib/shared/db";
  import type {
    RepRecord,
    ScoreRecord,
    Session,
    ShotRecord,
  } from "$lib/shared/db/repos";
  import { Button, Card, ScoreRing } from "$lib/shared/ui";
  import { BandChart, BarChart } from "$lib/shared/ui/charts";
  import { compareHalves } from "./summary-logic";

  let { sessionId }: { sessionId: string } = $props();

  const services = useAppServices();

  let session = $state<Session | null>(null);
  let reps = $state<RepRecord[]>([]);
  let shots = $state<ShotRecord[]>([]);
  let score = $state<ScoreRecord | null>(null);
  let repScores = $state<RepScore[]>([]);
  let selectedRep = $state<number | null>(null);
  let blockFinished = $state(false);
  let completing = $state(false);

  const metricNames = builtInBenchmarks()[0]!.targets;

  const repValues = $derived(reps.map((r) => r.repScore));
  const bestIndex = $derived(indexOfExtreme(repValues, Math.max));
  const worstIndex = $derived(indexOfExtreme(repValues, Math.min));
  const halves = $derived(compareHalves(repScores));

  const focusMetric = $derived(session?.focusMetric ?? null);
  const focusTrend = $derived.by(() => {
    if (!focusMetric) return null;
    const values = shots
      .filter((s) => !s.excluded)
      .map((s) => s.analysis.metrics[focusMetric]?.value)
      .filter((v): v is number => typeof v === "number");
    if (values.length < 2) return null;
    const target = metricNames[focusMetric as MetricName];
    if (!target || typeof target.ideal !== "number") return null;
    return { values, band: target.acceptable as { min: number; max: number } };
  });

  function indexOfExtreme(
    values: (number | null)[],
    pick: (...v: number[]) => number,
  ): number | null {
    const numeric = values.filter((v): v is number => v !== null);
    if (numeric.length === 0) return null;
    return values.indexOf(pick(...numeric));
  }

  $effect(() => {
    void load(sessionId);
  });

  async function load(id: string) {
    session = await services.repos.session.get(id);
    reps = await services.repos.rep.listBySession(id);
    shots = await services.repos.shot.listBySession(id, {
      includeExcluded: true,
    });
    score = await services.repos.score.latestForRef("session", id);

    const included = shots.filter((s) => !s.excluded);
    if (included.length > 0) {
      const benchmark = await services.benchmarks.getActive();
      repScores = services.scoring.computeSessionScore(
        included,
        benchmark,
      ).reps;
    }

    if (session?.planItemId) {
      const planRepo = createPlanRepo(services);
      const item = await planRepo.getItem(session.planItemId);
      if (item) {
        const items = await planRepo.getItems(item.planId);
        blockFinished = items
          .filter((i) => i.type !== "reassessment" && i.id !== item.id)
          .every((i) => i.status !== "pending");
      }
    }
  }

  function jumpToRep(index: number) {
    selectedRep = index;
    const shotId = reps[index]?.shotId;
    if (shotId) void goto(`/progress/shot/${shotId}${page.url.search}`);
  }

  /** Query string for onward navigation — the plan item binding is spent. */
  function onwardSearch(): string {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local URL builder, never reactive state
    const params = new URLSearchParams(page.url.search);
    params.delete("planItem");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function done() {
    if (completing) return;
    completing = true;
    if (session?.planItemId) {
      await services.trainingPlan.completeItem(session.planItemId);
      await flushDb(services.db);
    }
    await goto(`/${onwardSearch()}`);
  }

  function metricLabel(metric: string): string {
    return metricNames[metric as MetricName]?.displayName ?? metric;
  }
</script>

<main class="summary" data-testid="practice-summary">
  <header>
    <h1>Session summary</h1>
    <ScoreRing
      value={score?.formScore ?? null}
      size={120}
      label="Session"
      testid="summary-score"
    />
    <p class="meta" data-testid="summary-rep-count">
      {reps.length} reps · {shots.filter((s) => s.excluded).length} excluded
    </p>
  </header>

  {#if reps.length > 0}
    <Card>
      <h2>Rep scores</h2>
      <BarChart
        values={repValues}
        testid="summary-rep-chart"
        highlight={selectedRep}
        onbarclick={jumpToRep}
      />
      <div class="jump">
        {#if bestIndex !== null}
          <button
            data-testid="summary-best"
            onclick={() => jumpToRep(bestIndex)}
          >
            Best: rep {bestIndex + 1}
          </button>
        {/if}
        {#if worstIndex !== null && worstIndex !== bestIndex}
          <button
            data-testid="summary-worst"
            onclick={() => jumpToRep(worstIndex)}
          >
            Worst: rep {worstIndex + 1}
          </button>
        {/if}
      </div>
    </Card>
  {/if}

  {#if focusTrend && focusMetric}
    <Card>
      <h2>{metricLabel(focusMetric)} across reps</h2>
      <BandChart
        values={focusTrend.values}
        band={focusTrend.band}
        testid="summary-focus-trend"
      />
      <p class="meta">Green band = benchmark acceptable range</p>
    </Card>
  {/if}

  {#if halves.improved.length > 0 || halves.appeared.length > 0}
    <Card testid="summary-halves">
      <h2>Second half vs first half</h2>
      {#if halves.improved.length > 0}
        <p class="improved">
          Improved: {halves.improved.map(metricLabel).join(", ")}
        </p>
      {/if}
      {#if halves.appeared.length > 0}
        <p class="appeared">
          Watch out: {halves.appeared.map(metricLabel).join(", ")}
        </p>
      {/if}
    </Card>
  {/if}

  {#if blockFinished}
    <Card testid="summary-reassess-prompt">
      <h2>Training block complete 🎉</h2>
      <p class="meta">
        You've finished every session in this plan. Re-assess to measure your
        progress and build the next block.
      </p>
      <Button
        variant="secondary"
        testid="summary-reassess"
        onclick={() => goto(`/assess${onwardSearch()}`)}
      >
        Re-assess with full video
      </Button>
    </Card>
  {/if}

  <Button size="lg" testid="summary-done" disabled={completing} onclick={done}>
    Done
  </Button>
</main>

<style>
  .summary {
    min-height: 100dvh;
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 20px;
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
  .meta {
    margin: 0;
    color: var(--sc-text-dim);
    font-size: 13px;
  }
  .jump {
    display: flex;
    gap: var(--sc-space-2);
    margin-top: var(--sc-space-2);
  }
  .jump button {
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-border);
    border-radius: 999px;
    color: var(--sc-text);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    cursor: pointer;
  }
  .improved {
    color: var(--sc-success);
    margin: 0 0 var(--sc-space-1);
  }
  .appeared {
    color: var(--sc-warn);
    margin: 0;
  }
</style>
