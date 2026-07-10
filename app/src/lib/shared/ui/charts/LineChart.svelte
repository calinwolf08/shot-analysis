<script lang="ts">
  let {
    values,
    min,
    max,
    height = 120,
    testid = "line-chart",
    color = "var(--sc-primary)",
    markerIndexes = [],
  }: {
    values: number[];
    /** Y-axis bounds; default to the data extent with 10% padding. */
    min?: number;
    max?: number;
    height?: number;
    testid?: string;
    color?: string;
    /** Indexes drawn with a ring marker (e.g. assessments). */
    markerIndexes?: number[];
  } = $props();

  const bounds = $derived.by(() => {
    if (values.length === 0) return { lo: 0, hi: 1 };
    const dataLo = Math.min(...values);
    const dataHi = Math.max(...values);
    const pad = (dataHi - dataLo || 1) * 0.1;
    return { lo: min ?? dataLo - pad, hi: max ?? dataHi + pad };
  });

  function x(i: number): number {
    return values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
  }
  function y(v: number): number {
    const { lo, hi } = bounds;
    const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    return height - 4 - t * (height - 8);
  }

  const points = $derived(
    values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" "),
  );
</script>

<svg
  viewBox="0 0 100 {height}"
  preserveAspectRatio="none"
  data-testid={testid}
  role="img"
  aria-label="Line chart of {values.length} values"
  style="height: {height}px"
>
  {#if values.length > 1}
    <polyline
      {points}
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
      data-testid="{testid}-line"
    />
  {/if}
  {#each values as v, i (i)}
    <circle
      cx={x(i)}
      cy={y(v)}
      r="2.5"
      fill={color}
      data-testid="{testid}-point-{i}"
    />
    {#if markerIndexes.includes(i)}
      <circle
        cx={x(i)}
        cy={y(v)}
        r="5"
        fill="none"
        stroke={color}
        stroke-width="1.25"
        data-testid="{testid}-marker-{i}"
      />
    {/if}
  {/each}
</svg>

<style>
  svg {
    width: 100%;
    display: block;
  }
</style>
