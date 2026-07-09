<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    raised = false,
    padded = true,
    testid,
    children,
  }: {
    raised?: boolean;
    padded?: boolean;
    testid?: string;
    children: Snippet;
  } = $props();
</script>

<div class="card" class:raised class:padded data-testid={testid}>
  {@render children()}
</div>

<style>
  .card {
    background: var(--sc-card);
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
  }
  .card.raised {
    background: var(--sc-card-raised);
  }
  .card.padded {
    padding: var(--sc-space-4);
  }
</style>
