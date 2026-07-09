<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    icon = "🏀",
    title,
    body,
    action,
  }: {
    icon?: string;
    title: string;
    body?: string;
    action?: Snippet;
  } = $props();
</script>

<div class="empty" data-testid="empty-state">
  <div class="icon" aria-hidden="true">{icon}</div>
  <h3>{title}</h3>
  {#if body}
    <p>{body}</p>
  {/if}
  {#if action}
    {@render action()}
  {/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-space-3);
    padding: var(--sc-space-6) var(--sc-space-4);
    text-align: center;
  }
  .icon {
    font-size: 40px;
  }
  h3 {
    margin: 0;
    font-size: 17px;
  }
  p {
    margin: 0;
    color: var(--sc-text-dim);
    font-size: 14px;
    max-width: 300px;
  }
</style>
