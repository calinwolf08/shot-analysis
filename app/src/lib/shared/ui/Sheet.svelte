<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title,
    children,
  }: { open?: boolean; title?: string; children: Snippet } = $props();

  function close() {
    open = false;
  }
</script>

{#if open}
  <div
    class="backdrop"
    data-testid="sheet-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === "Escape" && close()}
    role="presentation"
  ></div>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title ?? "Sheet"}
    data-testid="sheet"
  >
    <div class="handle" aria-hidden="true"></div>
    {#if title}
      <h3>{title}</h3>
    {/if}
    {@render children()}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 55%);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 41;
    background: var(--sc-card);
    border-radius: var(--sc-radius) var(--sc-radius) 0 0;
    border-top: 1px solid var(--sc-border);
    padding: var(--sc-space-3) var(--sc-space-4)
      calc(var(--sc-space-5) + env(safe-area-inset-bottom));
    max-height: 80dvh;
    overflow-y: auto;
  }
  .handle {
    width: 36px;
    height: 4px;
    border-radius: 999px;
    background: var(--sc-border);
    margin: 0 auto var(--sc-space-3);
  }
  h3 {
    margin: 0 0 var(--sc-space-3);
  }
</style>
