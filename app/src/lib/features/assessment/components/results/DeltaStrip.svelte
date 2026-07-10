<script lang="ts">
  import type { FocusDelta, ScoreDelta } from "./deltas";

  let {
    scoreDeltas,
    focusDeltas,
  }: {
    scoreDeltas: ScoreDelta[];
    focusDeltas: FocusDelta[];
  } = $props();
</script>

<section class="strip" data-testid="delta-strip">
  <h2>Since last assessment</h2>
  <div class="scores">
    {#each scoreDeltas as d (d.key)}
      {#if d.delta !== null}
        <span
          class="chip"
          class:up={d.delta >= 0}
          class:down={d.delta < 0}
          data-testid="delta-{d.key}"
          data-delta={Math.round(d.delta)}
        >
          {d.label}
          {d.delta >= 0 ? "▲" : "▼"}
          {Math.abs(Math.round(d.delta))}
        </span>
      {/if}
    {/each}
  </div>
  {#if focusDeltas.length > 0}
    <ul class="focus">
      {#each focusDeltas as f (f.issueGroup)}
        <li
          class:improved={f.delta < 0}
          data-testid="delta-focus-{f.issueGroup}"
        >
          <span>{f.displayName}</span>
          <span class="verdict">
            {#if f.resolved}
              resolved 🎉
            {:else if f.delta < 0}
              ▼ improved
            {:else if f.delta > 0}
              ▲ needs work
            {:else}
              unchanged
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .strip {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
    padding: var(--sc-space-3);
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
  }
  h2 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sc-text-dim);
  }
  .scores {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-space-2);
  }
  .chip {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-border);
  }
  .chip.up {
    color: var(--sc-success);
  }
  .chip.down {
    color: var(--sc-fail);
  }
  .focus {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .focus li {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }
  .verdict {
    color: var(--sc-warn);
    font-weight: 600;
  }
  li.improved .verdict {
    color: var(--sc-success);
  }
</style>
