<script lang="ts">
  /**
   * Keyframe scorecard: the shot's keyframes in order (Setup → Release), each
   * with its 0–10+ score and one short row per enabled check in the same words
   * as the practice card and the voice ("Knees too bent by 5"). 0 = in range
   * (green), 1–3 yellow, 4+ red; the display caps at 10+.
   */
  import {
    checkText,
    displayScore,
    severity,
    type CheckResult,
    type KeyframeScorecard,
  } from "./score";

  let {
    card,
    highlight = null,
    oncheck = null,
  }: {
    card: KeyframeScorecard;
    /** Keyframe to outline (e.g. the one being viewed). */
    highlight?: string | null;
    oncheck?: ((r: CheckResult) => void) | null;
  } = $props();
</script>

{#snippet chip(score: number | null, testid?: string)}
  <span
    class="chip"
    data-severity={severity(score) ?? "none"}
    data-testid={testid}>{displayScore(score)}</span
  >
{/snippet}

<section class="card" data-testid="scorecard-keyframes">
  <header>
    <div class="overall">
      {@render chip(card.overall, "kf-overall")}
      <span class="title">Shot score</span>
    </div>
    <p class="legend">
      <span class="chip" data-severity="good">0</span> in range ·
      <span class="chip" data-severity="warn">1–3</span> just outside ·
      <span class="chip" data-severity="bad">4+</span> well outside
    </p>
    {#if card.belowCoverageGate}
      <p class="gate">
        Not enough of this shot was tracked to score it overall.
      </p>
    {/if}
  </header>

  {#each card.keyframes.filter((k) => k.checks.length > 0) as k (k.keyframe)}
    <section
      class="phase"
      class:hl={highlight === k.keyframe}
      data-testid="kf-phase-{k.keyframe}"
    >
      <h3>
        <span>{k.name}</span>
        {@render chip(k.score, `kf-phase-score-${k.keyframe}`)}
      </h3>
      <ul>
        {#each k.checks as r (r.id)}
          <li
            class:off={!!r.score}
            class:unmeasured={r.value === null}
            data-testid="kf-row-{r.id}"
          >
            <button
              class="row"
              disabled={!oncheck}
              onclick={() => oncheck?.(r)}
            >
              <span class="text">{checkText(r)}</span>
              {#if r.scored}{@render chip(r.score)}{/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
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
  .text {
    font-size: 14px;
  }
  li.off .text {
    font-weight: 600;
  }
  li.unmeasured .text {
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
  .chip[data-severity="good"] {
    background: #34d399;
  }
  .chip[data-severity="warn"] {
    background: #fde047;
  }
  .chip[data-severity="bad"] {
    background: #f87171;
  }
</style>
