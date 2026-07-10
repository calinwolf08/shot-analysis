<script lang="ts">
  import { scoreBand, BAND_COLORS } from "../score-band";

  let {
    values,
    max = 100,
    height = 120,
    testid = "bar-chart",
    highlight = null,
    onbarclick,
  }: {
    /** One bar per entry; null renders an empty slot. */
    values: (number | null)[];
    max?: number;
    height?: number;
    testid?: string;
    /** Index drawn with a highlight ring (e.g. best/worst rep). */
    highlight?: number | null;
    onbarclick?: (index: number) => void;
  } = $props();

  const gap = 4;
  const barWidth = $derived(
    values.length > 0 ? (100 - gap * (values.length - 1)) / values.length : 0,
  );

  function barHeight(v: number | null): number {
    if (v === null || max <= 0) return 0;
    return Math.max(2, (Math.min(v, max) / max) * (height - 4));
  }

  // The elite band color is an SVG gradient defined inside ScoreRing;
  // bars use a flat color instead.
  function fillFor(v: number | null): string {
    if (v === null) return "var(--sc-border)";
    const band = scoreBand(v);
    return band === "elite" ? "var(--sc-primary)" : BAND_COLORS[band];
  }
</script>

<svg
  viewBox="0 0 100 {height}"
  preserveAspectRatio="none"
  data-testid={testid}
  role="img"
  aria-label="Bar chart of {values.length} values"
  style="height: {height}px"
>
  {#each values as value, i (i)}
    {@const h = barHeight(value)}
    <rect
      x={i * (barWidth + gap)}
      y={height - h}
      width={barWidth}
      height={h}
      rx="1.5"
      fill={fillFor(value)}
      opacity={highlight !== null && highlight !== i ? 0.55 : 1}
      stroke={highlight === i ? "var(--sc-text)" : "none"}
      stroke-width={highlight === i ? 1 : 0}
      data-testid="{testid}-bar-{i}"
      style={onbarclick ? "cursor: pointer" : ""}
      onclick={() => onbarclick?.(i)}
      role={onbarclick ? "button" : undefined}
    />
  {/each}
</svg>

<style>
  svg {
    width: 100%;
    display: block;
  }
</style>
