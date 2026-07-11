<script lang="ts">
  import type { KeyFramePose } from "$lib/features/analysis";
  import { drawSkeleton } from "$lib/shared/ui/pose-skeleton";

  let {
    pose,
    width = 320,
    height = 420,
  }: { pose: KeyFramePose | null; width?: number; height?: number } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // jsdom / unsupported → canvas stays blank
    draw(ctx, pose);
  });

  function draw(ctx: CanvasRenderingContext2D, p: KeyFramePose | null) {
    ctx.clearRect(0, 0, width, height);
    // Blank "court" backdrop.
    ctx.fillStyle = "#141821";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#232936";
    ctx.strokeRect(8, 8, width - 16, height - 16);
    if (!p) return;
    drawSkeleton(ctx, p.landmarks, width, height);
  }
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  data-testid="skeleton-overlay"
  data-frame={pose?.frameIndex ?? -1}
  aria-label="Pose skeleton at the selected key frame"
></canvas>

<style>
  canvas {
    width: 100%;
    max-width: 360px;
    border-radius: var(--sc-radius);
    border: 1px solid var(--sc-border);
  }
</style>
