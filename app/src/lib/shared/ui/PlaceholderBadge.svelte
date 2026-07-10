<script lang="ts">
  let { show = true, text = "Sample data" }: { show?: boolean; text?: string } =
    $props();
</script>

{#if show}
  <span
    class="badge"
    data-testid="placeholder-badge"
    title="This uses placeholder content, not real elite-shooter data."
  >
    {text}
  </span>
{/if}

<style>
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px dashed var(--sc-text-dim);
    color: var(--sc-text-dim);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
