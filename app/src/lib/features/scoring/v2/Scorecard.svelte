<script lang="ts">
  /**
   * Renders a v2 ShotScore: two headline numbers (Sequencing / Structure),
   * each expanding into categories → metrics with a target-band bar (the user's
   * value as a dot on the band). Unmeasured metrics are shown honestly, and the
   * measured fraction is surfaced so gaps aren't hidden.
   */
  import type { ShotScore, MetricScore } from "basketball-shot-analysis";

  let {
    score,
    onSeek,
  }: { score: ShotScore; onSeek?: (frame: number) => void } = $props();

  const pct = (n: number | null) =>
    n === null ? "—" : Math.round(n).toString();
  const statusColor: Record<string, string> = {
    good: "#34d399",
    close: "#fbbf24",
    off: "#f87171",
    unmeasured: "#6b7280",
  };

  /** Position (0..1) of a value within a band expanded by K on each side. */
  function dotPos(m: MetricScore): number | null {
    if (m.value === null) return null;
    const [lo, hi] = m.band;
    const w = Math.max(hi - lo, 1e-6);
    const min = lo - w;
    const max = hi + w;
    return Math.max(0, Math.min(1, (m.value - min) / (max - min)));
  }
  /** Band region (left%, width%) within the same expanded scale. */
  function bandRegion(m: MetricScore): { left: number; width: number } {
    const [lo, hi] = m.band;
    const w = Math.max(hi - lo, 1e-6);
    const span = hi + w - (lo - w);
    return { left: (w / span) * 100, width: ((hi - lo) / span) * 100 };
  }
</script>

<div class="scorecard">
  <div class="headline">
    <div class="head-score">
      <div class="head-label">Sequencing</div>
      <div class="head-num">{pct(score.sequencing.score)}</div>
      <div class="head-sub">
        order {pct(score.sequencing.orderScore)}% · measured {Math.round(
          score.sequencing.measuredFraction * 100,
        )}%
      </div>
    </div>
    <div class="head-score">
      <div class="head-label">Structure</div>
      <div class="head-num">{pct(score.structure.score)}</div>
      <div class="head-sub">
        measured {Math.round(score.structure.measuredFraction * 100)}%
      </div>
    </div>
  </div>

  {#snippet metricRow(m: MetricScore)}
    <div class="metric" class:unmeasured={m.status === "unmeasured"}>
      <div class="metric-top">
        <span class="dot" style="background:{statusColor[m.status]}"></span>
        <span class="metric-label"
          >{m.label}{m.reportedOnly ? " (info)" : ""}</span
        >
        <span class="metric-value">
          {m.value === null ? "n/a" : m.value.toFixed(2)}
        </span>
        {#if m.frame !== null && onSeek}
          <button class="frame-btn" onclick={() => onSeek?.(m.frame!)}
            >f{m.frame}</button
          >
        {/if}
      </div>
      {#if m.value !== null}
        <div class="bar">
          <div
            class="band"
            style="left:{bandRegion(m).left}%;width:{bandRegion(m).width}%"
          ></div>
          {#if dotPos(m) !== null}
            <div
              class="marker"
              style="left:{dotPos(m)! * 100}%;background:{statusColor[
                m.status
              ]}"
            ></div>
          {/if}
        </div>
        <div class="band-text">
          target {m.band[0].toFixed(2)} – {m.band[1].toFixed(2)}
        </div>
      {/if}
    </div>
  {/snippet}

  <div class="category">
    <div class="cat-header">Sequencing</div>
    {#each score.sequencing.metrics as m (m.id)}
      {@render metricRow(m)}
    {/each}
  </div>

  {#each score.structure.categories as cat (cat.id)}
    <div class="category">
      <div class="cat-header">
        {cat.label}
        <span class="cat-score">{pct(cat.score)}</span>
      </div>
      {#each cat.metrics as m (m.id)}
        {@render metricRow(m)}
      {/each}
    </div>
  {/each}
</div>

<style>
  .scorecard {
    font-family: system-ui, sans-serif;
    color: #e5e7eb;
  }
  .headline {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }
  .head-score {
    flex: 1;
    background: #111827;
    border: 1px solid #1f2937;
    border-radius: 10px;
    padding: 12px 16px;
    text-align: center;
  }
  .head-label {
    font-size: 0.8rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .head-num {
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1.1;
  }
  .head-sub {
    font-size: 0.72rem;
    color: #6b7280;
  }
  .category {
    margin-bottom: 12px;
  }
  .cat-header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.9rem;
    color: #cbd5e1;
    border-bottom: 1px solid #1f2937;
    padding-bottom: 4px;
    margin-bottom: 6px;
  }
  .cat-score {
    color: #9ca3af;
  }
  .metric {
    padding: 4px 0;
  }
  .metric.unmeasured {
    opacity: 0.5;
  }
  .metric-top {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .metric-label {
    flex: 1;
  }
  .metric-value {
    font-variant-numeric: tabular-nums;
    color: #cbd5e1;
  }
  .frame-btn {
    background: #1f2937;
    color: #9ca3af;
    border: none;
    border-radius: 4px;
    font-size: 0.72rem;
    padding: 1px 6px;
    cursor: pointer;
  }
  .bar {
    position: relative;
    height: 6px;
    background: #1f2937;
    border-radius: 3px;
    margin: 4px 0 2px;
  }
  .band {
    position: absolute;
    top: 0;
    height: 100%;
    background: rgba(52, 211, 153, 0.25);
    border-radius: 3px;
  }
  .marker {
    position: absolute;
    top: -2px;
    width: 3px;
    height: 10px;
    border-radius: 2px;
    transform: translateX(-1px);
  }
  .band-text {
    font-size: 0.68rem;
    color: #6b7280;
  }
</style>
