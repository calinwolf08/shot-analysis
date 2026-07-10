<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    variant = "primary",
    size = "md",
    disabled = false,
    type = "button",
    testid,
    onclick,
    children,
  }: {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    type?: "button" | "submit";
    testid?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

<button
  {type}
  class="btn {variant} {size}"
  {disabled}
  data-testid={testid}
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sc-space-2);
    border: none;
    border-radius: var(--sc-radius);
    font-family: var(--sc-font);
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .btn:not(:disabled):active {
    filter: brightness(1.15);
  }
  .primary {
    background: var(--sc-primary);
    color: #14100c;
  }
  .secondary {
    background: var(--sc-card-raised);
    color: var(--sc-text);
    border: 1px solid var(--sc-border);
  }
  .ghost {
    background: transparent;
    color: var(--sc-text-dim);
  }
  .danger {
    background: var(--sc-fail);
    color: #1a0d0d;
  }
  .sm {
    padding: 6px 12px;
    font-size: 13px;
  }
  .md {
    padding: 12px 20px;
    font-size: 15px;
  }
  .lg {
    padding: 16px 28px;
    font-size: 17px;
    width: 100%;
  }
</style>
