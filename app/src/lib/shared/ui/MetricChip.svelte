<script lang="ts">
  let {
    status,
    label,
    testid = "metric-chip",
  }: {
    status: "pass" | "warning" | "fail" | "low-confidence";
    label: string;
    testid?: string;
  } = $props();
</script>

<span class="chip {status}" data-testid={testid} data-status={status}>
  <span class="dot" aria-hidden="true"></span>
  {label}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--sc-card-raised);
    color: var(--sc-text);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .pass .dot {
    background: var(--sc-success);
  }
  .warning .dot {
    background: var(--sc-warn);
  }
  .fail .dot {
    background: var(--sc-fail);
  }
  .low-confidence {
    color: var(--sc-text-dim);
  }
  .low-confidence .dot {
    background: transparent;
    border: 1.5px solid var(--sc-text-dim);
  }
</style>
