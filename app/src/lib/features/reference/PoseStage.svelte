<script lang="ts">
  /**
   * One pose stage for the dev viewers: the skeleton at true aspect (review
   * framing, fitted once over the whole window), optional source video under
   * it, and optionally the selected metric's geometry drawn on top.
   *
   * Probe attributes on the canvas (for E2E): data-frame (shown frameIndex),
   * data-geometry (families actually drawn, comma-separated).
   */
  import {
    computeShotFraming,
    projectWith,
    sourceRect,
    type Framing,
  } from "$lib/features/live-practice/review/framing";
  import { drawSkeleton } from "$lib/shared/ui/pose-skeleton";
  import {
    drawGeometry,
    type Geometry,
    type GeometrySides,
    type Landmark,
  } from "./metric-geometry";

  interface StageFrame {
    readonly frameIndex: number;
    readonly landmarks: readonly Landmark[];
  }

  let {
    frames,
    source,
    frame,
    fps = 30,
    videoUrl = null,
    geometry = null,
    testid = "stage",
    label = null,
  }: {
    /** The frames of the window being shown (framing fits all of them). */
    frames: readonly StageFrame[];
    /** Source pixel size (only the ratio matters). */
    source: { width: number; height: number };
    /** frameIndex to show (nearest stored frame is drawn). */
    frame: number;
    fps?: number;
    videoUrl?: string | null;
    geometry?: {
      items: readonly Geometry[];
      sides: GeometrySides;
      /** frameIndex range the metric spans (for paths). */
      span: readonly [number, number];
    } | null;
    testid?: string;
    label?: string | null;
  } = $props();

  let stageW = $state(0);
  let stageH = $state(0);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let videoReady = $state(false);

  const framing = $derived.by((): Framing | null => {
    if (stageW <= 0 || stageH <= 0 || frames.length === 0) return null;
    return computeShotFraming(
      frames as unknown as Parameters<typeof computeShotFraming>[0],
      { width: stageW, height: stageH },
      source,
    );
  });
  const videoBox = $derived(framing ? sourceRect(framing) : null);

  const shown = $derived.by(() => {
    let best: StageFrame | null = null;
    let d = Infinity;
    for (const f of frames) {
      const dd = Math.abs(f.frameIndex - frame);
      if (dd < d) {
        d = dd;
        best = f;
      }
    }
    return best;
  });

  $effect(() => {
    const v = videoEl;
    const f = frame;
    if (!v || !videoReady) return;
    try {
      v.currentTime = f / fps;
    } catch {
      /* not seekable yet */
    }
  });

  $effect(() => {
    const c = canvas;
    const fr = framing;
    const s = shown;
    const g = geometry;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(stageW * dpr);
    c.height = Math.round(stageH * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, stageW, stageH);
    c.dataset.geometry = "";
    if (!s || !fr) return;
    const project = projectWith(fr);
    drawSkeleton(ctx, s.landmarks as never, stageW, stageH, {
      strokeStyle: "rgb(64 224 120 / 90%)",
      jointStyle: "rgb(255 255 255 / 90%)",
      lineWidth: 3,
      jointRadius: 3,
      project,
    });
    c.dataset.frame = String(s.frameIndex);
    if (g && g.items.length > 0) {
      const [a, b] = g.span;
      const pathFrames = frames
        .filter((f) => f.frameIndex >= a && f.frameIndex <= b)
        .map((f) => f.landmarks);
      c.dataset.geometry = drawGeometry(ctx, g.items, s.landmarks, {
        ...g.sides,
        project,
        pathFrames,
      }).join(",");
    }
  });
</script>

<div
  class="stage"
  bind:clientWidth={stageW}
  bind:clientHeight={stageH}
  data-testid="{testid}-stage"
>
  {#if videoUrl}
    <video
      bind:this={videoEl}
      src={videoUrl}
      muted
      playsinline
      preload="auto"
      data-testid="{testid}-video"
      style={videoBox
        ? `left:${videoBox.left}px;top:${videoBox.top}px;width:${videoBox.width}px;height:${videoBox.height}px`
        : ""}
      onloadedmetadata={() => (videoReady = true)}
    ></video>
  {/if}
  <canvas bind:this={canvas} data-testid="{testid}-skeleton"></canvas>
  {#if label}<span class="label">{label}</span>{/if}
</div>

<style>
  .stage {
    position: relative;
    aspect-ratio: 4 / 3;
    background: #000;
    border-radius: var(--sc-radius);
    overflow: hidden;
  }
  video {
    position: absolute;
    object-fit: fill;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .label {
    position: absolute;
    left: 8px;
    top: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 2px #000;
  }
</style>
