<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { ShotRecord } from "$lib/shared/db/repos";
  import { scoreBand } from "$lib/shared/ui";

  let {
    shots,
    scores,
  }: {
    shots: ShotRecord[];
    scores: Map<string, number | null>;
  } = $props();
</script>

<section class="strip-wrap">
  <h2>Shots</h2>
  <div class="strip" data-testid="shot-strip">
    {#each shots as shot (shot.id)}
      {@const score = scores.get(shot.id) ?? null}
      <button
        class="shot"
        data-testid="shot-card-{shot.shotIndex}"
        data-band={scoreBand(score)}
        onclick={() => goto(`/progress/shot/${shot.id}${page.url.search}`)}
      >
        <span class="score sc-numeral">
          {score === null ? "–" : Math.round(score)}
        </span>
        <span class="label">Shot {shot.shotIndex + 1}</span>
        <span class="meta">
          {Math.round((shot.overallConfidence ?? 0) * 100)}% conf
        </span>
      </button>
    {/each}
  </div>
</section>

<style>
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
  .strip {
    display: flex;
    gap: var(--sc-space-2);
    overflow-x: auto;
    padding-bottom: var(--sc-space-2);
  }
  .shot {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 84px;
    padding: 12px;
    border-radius: var(--sc-radius);
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: var(--sc-text);
    cursor: pointer;
  }
  .score {
    font-size: 24px;
  }
  .shot[data-band="fail"] .score {
    color: var(--sc-fail);
  }
  .shot[data-band="warn"] .score {
    color: var(--sc-warn);
  }
  .shot[data-band="good"] .score,
  .shot[data-band="elite"] .score {
    color: var(--sc-success);
  }
  .label {
    font-size: 12px;
    font-weight: 600;
  }
  .meta {
    font-size: 10px;
    color: var(--sc-text-dim);
  }
</style>
