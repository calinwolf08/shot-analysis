<script lang="ts">
  import type { FocusAreaRow } from "$lib/features/diagnosis";
  import { Card } from "$lib/shared/ui";

  let { areas }: { areas: FocusAreaRow[] } = $props();

  interface AreaPayload {
    displayName: string;
    whyItMatters: string;
    surfaced: boolean;
    metrics: {
      metric: string;
      displayName: string;
      shortCue: string;
      feedback: string | null;
    }[];
  }

  const surfaced = $derived(
    areas
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .filter((a) => (a.metrics as AreaPayload).surfaced)
      .slice(0, 3),
  );

  function payload(area: FocusAreaRow): AreaPayload {
    return area.metrics as AreaPayload;
  }
</script>

<section class="issues" data-testid="top-issues">
  <h2>What to fix first</h2>
  {#each surfaced as area, i (area.id)}
    {@const p = payload(area)}
    <Card testid="top-issue-{i}">
      <div class="head">
        <span class="rank">#{area.rank}</span>
        <strong>{p.displayName}</strong>
        <span class="severity">
          severity {(area.severity * 100).toFixed(0)}
        </span>
      </div>
      {#if p.metrics[0]?.feedback}
        <p class="feedback">{p.metrics[0].feedback}</p>
      {/if}
      <p class="why"><em>Why it matters:</em> {p.whyItMatters}</p>
    </Card>
  {/each}
</section>

<style>
  .issues {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sc-space-2);
  }
  .rank {
    color: var(--sc-primary);
    font-weight: 800;
  }
  .severity {
    margin-left: auto;
    color: var(--sc-text-dim);
    font-size: 12px;
  }
  .feedback {
    margin: var(--sc-space-2) 0 0;
    font-size: 14px;
  }
  .why {
    margin: var(--sc-space-2) 0 0;
    color: var(--sc-text-dim);
    font-size: 13px;
  }
</style>
