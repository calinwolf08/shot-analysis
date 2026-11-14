<script lang="ts">
  /**
   * Renders a deviation ShotScorecard (live redesign — step 6): an overall
   * score, then two top-level sections — Structure and Sequencing — each grouped
   * by shot phase. Scores are 1..10 where LOWER IS BETTER (1 = inside the pro
   * band), so the colour scale runs green → amber → red as the score climbs.
   * Reported-only metrics are shown dimmed and never coloured as problems.
   *
   * @see docs/live-redesign-plan.md §3.8
   */
  import type {
    MetricDeviation,
    SectionDeviation,
    ShotScorecard,
  } from "./deviation";

  let {
    card,
    highlightPhase = null,
    onmetric = null,
  }: {
    card: ShotScorecard;
    highlightPhase?: string | null;
    /** When set, metric rows + top-issue chips become clickable (e.g. seek). */
    onmetric?: ((m: MetricDeviation) => void) | null;
  } = $props();

  const GREEN = "#34d399";
  const AMBER = "#fbbf24";
  const RED = "#f87171";
  const DIM = "#6b7280";

  const fmtScore = (n: number | null) => (n === null ? "—" : n.toFixed(1));

  /** Colour for a 1..10 (lower-better) score; in-band is always green. */
  function scoreColor(m: MetricDeviation): string {
    if (!m.scored) return DIM;
    if (m.inBand || m.score <= 1.5) return GREEN;
    if (m.score <= 4) return AMBER;
    return RED;
  }
  function overallColor(n: number | null): string {
    if (n === null) return DIM;
    if (n <= 1.5) return GREEN;
    if (n <= 4) return AMBER;
    return RED;
  }

  const sectionId = (s: SectionDeviation) => `sc-section-${s.section}`;
</script>

<div class="scorecard" data-testid="scorecard">
  <div class="overall" data-testid="sc-overall">
    <div class="num" style="color:{overallColor(card.overall)}">
      {fmtScore(card.overall)}
    </div>
    <div class="meta">
      <span class="hint">lower is better (1 = on target)</span>
      <span class="coverage">
        measured {Math.round(card.measuredFraction * 100)}%
        {#if card.belowCoverageGate}· low coverage{/if}
      </span>
    </div>
  </div>

  {#if card.worst.length > 0}
    <div class="worst" data-testid="sc-worst">
      <span class="worst-label">Top issues</span>
      <div class="chips">
        {#each card.worst as m (m.id)}
          {#if onmetric}
            <button
              class="chip clickable"
              type="button"
              style="border-color:{scoreColor(m)}"
              onclick={() => onmetric(m)}
            >
              {m.label}
              {#if m.direction}<em>{m.direction} by {m.magnitude}</em>{/if}
            </button>
          {:else}
            <span class="chip" style="border-color:{scoreColor(m)}">
              {m.label}
              {#if m.direction}<em>{m.direction} by {m.magnitude}</em>{/if}
            </span>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  {#snippet metricInner(m: MetricDeviation)}
    <span class="dot" style="background:{scoreColor(m)}"></span>
    <span class="label">{m.label}{m.scored ? "" : " (info)"}</span>
    <span class="value">{m.value.toFixed(2)}</span>
    {#if m.scored}
      <span class="score" style="color:{scoreColor(m)}"
        >{m.score.toFixed(1)}</span
      >
    {/if}
    <span class="band">
      {#if m.inBand}
        on target
      {:else if m.direction}
        {m.direction} by {m.magnitude}
      {/if}
    </span>
  {/snippet}

  {#snippet metricRow(m: MetricDeviation)}
    {#if onmetric}
      <button
        class="metric clickable"
        class:reported={!m.scored}
        type="button"
        onclick={() => onmetric(m)}
        data-testid="sc-metric-{m.id}"
      >
        {@render metricInner(m)}
      </button>
    {:else}
      <div
        class="metric"
        class:reported={!m.scored}
        data-testid="sc-metric-{m.id}"
      >
        {@render metricInner(m)}
      </div>
    {/if}
  {/snippet}

  {#each card.sections as section (section.section)}
    <section class="group" data-testid={sectionId(section)}>
      <header class="section-head">
        <span class="section-name">{section.label}</span>
        <span class="section-score" style="color:{overallColor(section.score)}">
          {fmtScore(section.score)}
        </span>
      </header>
      {#each section.phases as group (group.phase)}
        <div
          class="phase"
          class:highlight={group.phase === highlightPhase}
          data-testid="sc-phase-{section.section}-{group.phase}"
        >
          <div class="phase-head">
            <span>{group.label}</span>
            <span class="phase-score">{fmtScore(group.score)}</span>
          </div>
          {#each group.metrics as m (m.id)}
            {@render metricRow(m)}
          {/each}
        </div>
      {/each}
      {#if section.phases.length === 0}
        <p class="empty">No measured metrics.</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .scorecard {
    font-family: system-ui, sans-serif;
    color: #e5e7eb;
  }
  .overall {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
  }
  .overall .num {
    font-size: 3rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .overall .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hint {
    font-size: 0.78rem;
    color: #9ca3af;
  }
  .coverage {
    font-size: 0.72rem;
    color: #9ca3af;
  }
  .worst {
    margin-bottom: 14px;
  }
  .worst-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .chip {
    font-size: 0.78rem;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid #374151;
    background: #111827;
  }
  .chip em {
    color: #9ca3af;
    font-style: normal;
  }
  .group {
    margin-bottom: 14px;
  }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #1f2937;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .section-name {
    font-weight: 700;
    font-size: 0.95rem;
  }
  .section-score {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .phase {
    margin-bottom: 8px;
    border-radius: 6px;
  }
  .phase.highlight {
    background: rgba(37, 99, 235, 0.18);
    outline: 1px solid rgba(37, 99, 235, 0.5);
    padding: 4px 6px;
  }
  .phase-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #cbd5e1;
    margin-bottom: 2px;
  }
  .phase-score {
    color: #9ca3af;
    font-variant-numeric: tabular-nums;
  }
  .metric {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    padding: 2px 0;
  }
  .metric.clickable {
    width: 100%;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    padding: 2px 4px;
  }
  .metric.clickable:hover {
    background: rgba(148, 163, 184, 0.14);
  }
  .chip.clickable {
    cursor: pointer;
    color: inherit;
    font-family: inherit;
  }
  .chip.clickable:hover {
    background: #1f2937;
  }
  .metric.reported .label,
  .metric.reported .value {
    color: #9ca3af;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .label {
    flex: 1;
  }
  .value {
    font-variant-numeric: tabular-nums;
    color: #cbd5e1;
  }
  .score {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    min-width: 2ch;
    text-align: right;
  }
  .band {
    min-width: 9ch;
    text-align: right;
    font-size: 0.72rem;
    color: #9ca3af;
  }
  .empty {
    font-size: 0.8rem;
    color: #9ca3af;
    margin: 0;
  }
</style>
