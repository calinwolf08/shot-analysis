<script lang="ts">
  import { BAND_COLORS, scoreBand } from "./score-band";

  let {
    value = null,
    size = 120,
    label,
    testid = "score-ring",
  }: {
    value?: number | null;
    size?: number;
    label?: string;
    testid?: string;
  } = $props();

  const band = $derived(scoreBand(value));
  const stroke = $derived(BAND_COLORS[band]);
  const radius = $derived((size - 12) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const progress = $derived(
    value === null ? 0 : Math.max(0, Math.min(100, value)) / 100,
  );
  const display = $derived(value === null ? "–" : Math.round(value).toString());
</script>

<div
  class="ring"
  style="width:{size}px;height:{size}px"
  data-testid={testid}
  data-band={band}
  role="img"
  aria-label="{label ?? 'Score'}: {display} out of 100"
>
  <svg width={size} height={size} viewBox="0 0 {size} {size}">
    <defs>
      <linearGradient id="sc-elite-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3ddc84" />
        <stop offset="100%" stop-color="#ff7a29" />
      </linearGradient>
    </defs>
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="var(--sc-card-raised)"
      stroke-width="8"
    />
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      {stroke}
      stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={circumference * (1 - progress)}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  <div class="center">
    <span class="value sc-numeral" style="font-size:{size / 3.4}px">
      {display}
    </span>
    {#if label}
      <span class="label">{label}</span>
    {/if}
  </div>
</div>

<style>
  .ring {
    position: relative;
    display: inline-block;
  }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .value {
    line-height: 1;
    color: var(--sc-text);
  }
  .label {
    font-size: 11px;
    color: var(--sc-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
