<script lang="ts">
  import LineChart from "./LineChart.svelte";

  let {
    values,
    band,
    height = 120,
    testid = "band-chart",
  }: {
    values: number[];
    /** Benchmark acceptable range drawn behind the series. */
    band: { min: number; max: number };
    height?: number;
    testid?: string;
  } = $props();

  // Shared y-domain covering both the data and the band.
  const domain = $derived.by(() => {
    const all = [...values, band.min, band.max];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.1;
    return { lo: lo - pad, hi: hi + pad };
  });

  function y(v: number): number {
    const { lo, hi } = domain;
    const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    return height - 4 - t * (height - 8);
  }
</script>

<div class="band-chart" data-testid={testid} style="height: {height}px">
  <svg viewBox="0 0 100 {height}" preserveAspectRatio="none" aria-hidden="true">
    <rect
      x="0"
      y={y(band.max)}
      width="100"
      height={Math.max(0, y(band.min) - y(band.max))}
      fill="rgb(59 201 133 / 14%)"
      stroke="rgb(59 201 133 / 35%)"
      stroke-width="0.5"
      data-testid="{testid}-band"
    />
  </svg>
  <div class="line">
    <LineChart
      {values}
      min={domain.lo}
      max={domain.hi}
      {height}
      testid="{testid}-series"
    />
  </div>
</div>

<style>
  .band-chart {
    position: relative;
    width: 100%;
  }
  svg,
  .line {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
