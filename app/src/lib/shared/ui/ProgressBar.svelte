<script lang="ts">
  let {
    value = 0,
    label,
    testid = "progress-bar",
  }: { value?: number; label?: string; testid?: string } = $props();

  const clamped = $derived(Math.max(0, Math.min(1, value)));
</script>

<div
  class="track"
  data-testid={testid}
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(clamped * 100)}
  aria-label={label}
>
  <div class="fill" style="width:{clamped * 100}%"></div>
</div>

<style>
  .track {
    height: 6px;
    border-radius: 999px;
    background: var(--sc-card-raised);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--sc-primary);
    border-radius: 999px;
    transition: width 0.2s ease;
  }
</style>
