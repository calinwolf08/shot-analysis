<script lang="ts">
  /**
   * v3 scorecard: the shot's phases in order (Load → Rise → Set point →
   * Release), each with its 0–10+ score and plain-language rows ("Knee bend:
   * too shallow by 12°", target band underneath). 0 = on target; the display
   * caps at 10+. Details are measured but not scored.
   */
  import {
    describeResult,
    displayScore,
    scoreBand,
    targetText,
    type MetricResultV3,
    type ScorecardV3,
  } from "./score";

  let {
    card,
    highlightPhase = null,
    onmetric = null,
  }: {
    card: ScorecardV3;
    highlightPhase?: string | null;
    onmetric?: ((m: MetricResultV3) => void) | null;
  } = $props();
</script>

{#snippet chip(score: number | null, testid?: string)}
  <span class="chip" data-band={scoreBand(score) ?? "none"} data-testid={testid}
    >{displayScore(score)}</span
  >
{/snippet}

{#snippet row(m: MetricResultV3)}
  <li
    class:off={m.direction !== null}
    class:unmeasured={m.value === null}
    data-testid="v3-row-{m.id}"
  >
    <button class="row" disabled={!onmetric} onclick={() => onmetric?.(m)}>
      <span class="what">
        <span class="text">{describeResult(m)}</span>
        <span class="target"
          >{m.value === null
            ? (m.note ?? "")
            : targetText(m)}{#if m.note === "low resolution"}
            · low frame-rate timing{/if}</span
        >
      </span>
      {#if m.scored}{@render chip(m.score)}{/if}
    </button>
  </li>
{/snippet}

<section class="card" data-testid="scorecard-v3">
  <header>
    <div class="overall">
      {@render chip(card.overall, "v3-overall")}
      <span class="title">Shot score</span>
    </div>
    <p class="legend" data-testid="v3-legend">
      <span class="chip" data-band="good">0</span> on target ·
      <span class="chip" data-band="fair">1–3</span> close ·
      <span class="chip" data-band="off">3–6</span> off ·
      <span class="chip" data-band="far">6–10+</span> way off
    </p>
    {#if card.belowCoverageGate}
      <p class="gate">
        Not enough of this shot was tracked to score it overall.
      </p>
    {/if}
  </header>

  {#each card.phases as p (p.phase)}
    <section
      class="phase"
      class:hl={highlightPhase === p.phase}
      data-testid="v3-phase-{p.phase}"
    >
      <h3>
        <span>{p.name}</span>
        {@render chip(p.score, `v3-phase-score-${p.phase}`)}
      </h3>
      <ul>
        {#each p.metrics as m (m.id)}{@render row(m)}{/each}
      </ul>
    </section>
  {/each}

  {#if card.details.length > 0}
    <details class="phase">
      <summary>Details (not scored)</summary>
      <ul>
        {#each card.details as m (m.id)}{@render row(m)}{/each}
      </ul>
    </details>
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .overall {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .overall .chip {
    font-size: 22px;
    padding: 4px 12px;
  }
  .title {
    font-weight: 700;
    font-size: 18px;
  }
  .legend,
  .gate {
    margin: 0;
    font-size: 12px;
    color: var(--sc-text-dim);
  }
  .phase {
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
    padding: 8px 10px;
  }
  .phase.hl {
    border-color: var(--sc-primary);
  }
  h3 {
    margin: 0 0 6px;
    font-size: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  li + li {
    border-top: 1px solid var(--sc-border);
  }
  .row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .row:not(:disabled) {
    cursor: pointer;
  }
  .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .text {
    font-size: 14px;
  }
  li.off .text {
    font-weight: 600;
  }
  li.unmeasured .text {
    color: var(--sc-text-dim);
  }
  .target {
    font-size: 11px;
    color: var(--sc-text-dim);
  }
  .chip {
    flex: none;
    min-width: 2.6em;
    text-align: center;
    padding: 1px 6px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: #0b1220;
    background: #6b7280;
  }
  .chip[data-band="good"] {
    background: #34d399;
  }
  .chip[data-band="fair"] {
    background: #fde047;
  }
  .chip[data-band="off"] {
    background: #fb923c;
  }
  .chip[data-band="far"] {
    background: #f87171;
  }
</style>
