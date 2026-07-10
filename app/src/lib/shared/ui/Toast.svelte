<script lang="ts">
  import { toasts } from "./toast.svelte";
</script>

{#if toasts.messages.length > 0}
  <div class="stack" data-testid="toast-stack" role="status" aria-live="polite">
    {#each toasts.messages as toast (toast.id)}
      <button
        class="toast {toast.kind}"
        onclick={() => toasts.dismiss(toast.id)}
      >
        {toast.text}
      </button>
    {/each}
  </div>
{/if}

<style>
  .stack {
    position: fixed;
    bottom: calc(84px + env(safe-area-inset-bottom));
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
    z-index: 60;
    width: min(92vw, 420px);
  }
  .toast {
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius-sm);
    background: var(--sc-card-raised);
    color: var(--sc-text);
    padding: 10px 14px;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .toast.error {
    border-color: var(--sc-fail);
  }
  .toast.success {
    border-color: var(--sc-success);
  }
</style>
