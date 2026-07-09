<script lang="ts">
  import { METRIC_CATEGORIES } from "$lib/features/benchmarks";
  import { MetricChip } from "$lib/shared/ui";
  import { categoryLabel, type MetricsByCategory } from "./metrics-summary";

  let { byCategory }: { byCategory: MetricsByCategory } = $props();

  let open = $state<Record<string, boolean>>({});

  function toggle(category: string) {
    open = { ...open, [category]: !open[category] };
  }
</script>

<section class="accordion" data-testid="metrics-accordion">
  <h2>All metrics</h2>
  {#each METRIC_CATEGORIES as category (category)}
    {@const rows = byCategory[category]}
    <div class="group" data-testid="metrics-group-{category}">
      <button class="header" onclick={() => toggle(category)}>
        <span>{categoryLabel(category)}</span>
        <span class="count">{rows.length}</span>
        <span class="chevron">{open[category] ? "▾" : "▸"}</span>
      </button>
      {#if open[category]}
        <div class="rows">
          {#each rows as row (row.metric)}
            <div
              class="row"
              class:dimmed={row.status === "low-confidence" ||
                row.status === "no-data"}
              data-testid="metric-row-{row.metric}"
            >
              <div class="name">
                {row.displayName}
                {#if row.status === "low-confidence"}
                  <span class="note">low confidence — not scored</span>
                {/if}
              </div>
              <div class="values">
                <span class="value sc-numeral">{row.valueText}</span>
                <span class="target"
                  >ideal {row.idealText} ({row.rangeText})</span
                >
                {#if row.std !== null}
                  <span class="std">σ {row.std.toFixed(1)}</span>
                {/if}
              </div>
              <MetricChip
                status={row.status === "no-data"
                  ? "low-confidence"
                  : row.status === "low-confidence"
                    ? "low-confidence"
                    : row.status}
                label={row.status === "no-data" ? "no data" : row.status}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</section>

<style>
  .accordion {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
  .group {
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    overflow: hidden;
  }
  .header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sc-space-2);
    padding: 12px 16px;
    background: var(--sc-card);
    border: none;
    color: var(--sc-text);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  .count {
    margin-left: auto;
    color: var(--sc-text-dim);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px var(--sc-space-3);
    padding: 10px 16px;
    border-top: 1px solid var(--sc-border);
    align-items: center;
    font-size: 13px;
  }
  .row.dimmed {
    opacity: 0.55;
  }
  .name {
    font-weight: 600;
  }
  .note {
    display: block;
    font-weight: 400;
    color: var(--sc-text-dim);
    font-size: 11px;
  }
  .values {
    grid-column: 1;
    display: flex;
    gap: var(--sc-space-3);
    color: var(--sc-text-dim);
    flex-wrap: wrap;
  }
  .value {
    color: var(--sc-text);
  }
  .row :global(.chip) {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
</style>
