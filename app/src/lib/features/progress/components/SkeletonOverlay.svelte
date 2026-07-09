<script lang="ts">
  import type { KeyFramePose } from "$lib/features/analysis";

  let {
    pose,
    width = 320,
    height = 420,
  }: { pose: KeyFramePose | null; width?: number; height?: number } = $props();

  // MediaPipe pose connection pairs (subset covering the full body).
  const CONNECTIONS: [number, number][] = [
    [11, 12], // shoulders
    [11, 13],
    [13, 15], // left arm
    [12, 14],
    [14, 16], // right arm
    [11, 23],
    [12, 24], // torso
    [23, 24], // hips
    [23, 25],
    [25, 27], // left leg
    [24, 26],
    [26, 28], // right leg
    [27, 31],
    [28, 32], // feet
    [0, 11],
    [0, 12], // head to shoulders (approx neck)
  ];

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

    const pt = (i: number) => {
      const l = p.landmarks[i];
      if (!l || l.visibility < 0.3) return null;
      return { x: l.x * width, y: l.y * height };
    };

    ctx.strokeStyle = "#ff7a29";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const [a, b] of CONNECTIONS) {
      const pa = pt(a);
      const pb = pt(b);
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.fillStyle = "#f2f4f8";
    for (let i = 0; i < p.landmarks.length; i++) {
      const point = pt(i);
      if (!point) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
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
