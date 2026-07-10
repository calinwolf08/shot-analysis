<script lang="ts">
  import type { BenchmarkProfile, MetricName } from "$lib/features/benchmarks";
  import { METRIC_NAMES } from "$lib/features/benchmarks";
  import { Card, EmptyState } from "$lib/shared/ui";
  import { BandChart, LineChart } from "$lib/shared/ui/charts";
  import type {
    MetricTrendPoint,
    ProgressTotals,
    ScoreHistoryPoint,
  } from "../service";

  let {
    history,
    totals,
    benchmark,
    loadTrend,
    sessionHref,
  }: {
    history: ScoreHistoryPoint[];
    totals: ProgressTotals;
    benchmark: BenchmarkProfile;
    loadTrend: (metric: MetricName) => Promise<MetricTrendPoint[]>;
    /** Builds the link target for a history entry. */
    sessionHref: (point: ScoreHistoryPoint) => string;
  } = $props();

  type SubScore = "overall" | "form" | "consistency" | "efficiency";
  const SUB_KEYS: Record<SubScore, keyof ScoreHistoryPoint> = {
    overall: "overallScore",
    form: "formScore",
    consistency: "consistencyScore",
    efficiency: "efficiencyScore",
  };

  let subScore = $state<SubScore>("overall");
  let metric = $state<MetricName | "">("");
  let trend = $state<MetricTrendPoint[]>([]);

  const chartPoints = $derived(
    history
      .map((h, i) => ({ value: h[SUB_KEYS[subScore]] as number | null, i }))
      .filter((p): p is { value: number; i: number } => p.value !== null),
  );
  const chartValues = $derived(chartPoints.map((p) => p.value));
  const assessmentMarkers = $derived(
    chartPoints
      .map((p, chartIndex) => ({ chartIndex, point: history[p.i]! }))
      .filter(({ point }) => point.type === "assessment")
      .map(({ chartIndex }) => chartIndex),
  );

  const metricTarget = $derived(
    metric ? benchmark.targets[metric as MetricName] : undefined,
  );

  async function pickMetric(value: string) {
    metric = value as MetricName | "";
    trend = metric ? await loadTrend(metric as MetricName) : [];
  }

  function dateLabel(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
</script>

<div class="dashboard" data-testid="progress-dashboard">
  <section class="totals" data-testid="progress-totals">
    <div class="stat">
      <span class="value sc-numeral" data-testid="progress-streak"
        >{totals.streakDays}</span
      >
      <span class="label">day streak</span>
    </div>
    <div class="stat">
      <span class="value sc-numeral">{totals.sessions}</span>
      <span class="label">sessions</span>
    </div>
    <div class="stat">
      <span class="value sc-numeral">{totals.repsAnalyzed}</span>
      <span class="label">shots analyzed</span>
    </div>
  </section>

  {#if history.length === 0}
    <EmptyState
      title="No sessions yet"
      body="Complete an assessment or a live practice session to start your history."
    />
  {:else}
    <Card>
      <div class="chart-head">
        <h2>Score over time</h2>
        <div class="toggles" role="group" aria-label="Sub-score">
          {#each Object.keys(SUB_KEYS) as key (key)}
            <button
              class:active={subScore === key}
              data-testid="progress-toggle-{key}"
              onclick={() => (subScore = key as SubScore)}
            >
              {key}
            </button>
          {/each}
        </div>
      </div>
      {#if chartValues.length > 0}
        <LineChart
          values={chartValues}
          min={0}
          max={100}
          markerIndexes={assessmentMarkers}
          testid="progress-score-chart"
        />
        <p class="hint">Ringed points are assessments</p>
      {:else}
        <p class="hint">No {subScore} scores recorded yet.</p>
      {/if}
    </Card>

    <Card>
      <h2>Metric explorer</h2>
      <select
        data-testid="progress-metric-picker"
        value={metric}
        onchange={(e) => void pickMetric(e.currentTarget.value)}
      >
        <option value="">Pick a metric…</option>
        {#each METRIC_NAMES as name (name)}
          <option value={name}>
            {benchmark.targets[name]?.displayName ?? name}
          </option>
        {/each}
      </select>
      {#if metric && trend.length > 0 && metricTarget && typeof metricTarget.ideal === "number"}
        <BandChart
          values={trend.map((t) => t.mean)}
          band={metricTarget.acceptable as { min: number; max: number }}
          testid="progress-metric-chart"
        />
        <p class="hint">
          Session means (σ {trend.map((t) => t.std.toFixed(1)).join(", ")}) vs
          the benchmark band
        </p>
      {:else if metric}
        <p class="hint" data-testid="progress-metric-empty">
          No measurements for this metric yet.
        </p>
      {/if}
    </Card>

    <Card>
      <h2>History</h2>
      <ul class="history" data-testid="progress-history">
        {#each [...history].reverse() as point (point.sessionId)}
          <li>
            <a
              href={sessionHref(point)}
              data-testid="history-{point.sessionId}"
            >
              <span class="type">
                {point.type === "assessment" ? "Assessment" : "Live practice"}
              </span>
              <span class="date">{dateLabel(point.completedAt)}</span>
              <span class="score sc-numeral">
                {point.overallScore === null
                  ? point.formScore === null
                    ? "–"
                    : Math.round(point.formScore)
                  : Math.round(point.overallScore)}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  .totals {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sc-space-2);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--sc-space-3);
    background: var(--sc-card);
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
  }
  .value {
    font-size: 24px;
    font-weight: 800;
  }
  .label {
    font-size: 11px;
    color: var(--sc-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
  .chart-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-space-2);
    flex-wrap: wrap;
  }
  .toggles {
    display: flex;
    gap: 4px;
  }
  .toggles button {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 999px;
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: var(--sc-text-dim);
    cursor: pointer;
    text-transform: capitalize;
  }
  .toggles button.active {
    color: var(--sc-primary);
    border-color: var(--sc-primary);
  }
  .hint {
    margin: var(--sc-space-2) 0 0;
    color: var(--sc-text-dim);
    font-size: 12px;
  }
  select {
    width: 100%;
    padding: 10px 12px;
    border-radius: var(--sc-radius);
    border: 1px solid var(--sc-border);
    background: var(--sc-card-raised);
    color: var(--sc-text);
    margin-bottom: var(--sc-space-3);
  }
  .history {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .history a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-space-3);
    padding: 10px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card-raised);
    color: var(--sc-text);
    text-decoration: none;
    font-size: 14px;
  }
  .type {
    font-weight: 600;
  }
  .date {
    color: var(--sc-text-dim);
    font-size: 12px;
    flex: 1;
    text-align: right;
  }
  .score {
    font-weight: 700;
    min-width: 32px;
    text-align: right;
  }
</style>
