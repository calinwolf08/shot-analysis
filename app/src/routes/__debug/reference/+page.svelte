<script lang="ts">
  /**
   * Curry model viewer (dev/E2E only). Shows the reference shots the live
   * targets are built from — Stephen Curry's 7 labeled side-on shots — with the
   * pose overlay, and a per-shot metric table next to each target's band so
   * the targets can be audited. Values are computed EXACTLY as
   * `npm run targets:build` computes them (parity is unit-tested).
   *
   * Video: the clip is local-only (gitignored). In `npm run dev` it's served
   * from test-data automatically; otherwise pick the file. Without it the
   * viewer is skeleton-only.
   */
  import { onDestroy, onMount } from "svelte";
  import type { PoseData } from "basketball-shot-analysis";
  import {
    buildMetricTable,
    computeReferenceShots,
    type MetricGroup,
    type ReferenceLabels,
    type ReferenceShot,
    type TargetEntry,
  } from "$lib/features/reference/curry-model";
  import {
    computeShotFraming,
    projectWith,
    sourceRect,
    type Framing,
  } from "$lib/features/live-practice/review/framing";
  import { drawSkeleton } from "$lib/shared/ui/pose-skeleton";

  const enabled = import.meta.env.DEV || import.meta.env.VITE_E2E === "1";
  const REF = "/fixtures/reference/stephen-curry-1";
  /** Frames of context shown around each labeled shot window. */
  const CONTEXT = 8;

  let status = $state<"loading" | "ready" | "error">("loading");
  let error = $state<string | null>(null);
  let poses = $state.raw<PoseData | null>(null);
  let shots = $state.raw<ReferenceShot[]>([]);
  let table = $state.raw<MetricGroup[]>([]);
  let shotIdx = $state(0);
  let frame = $state(0);
  let selected = $state<{ id: string; shot: number } | null>(null);

  let videoUrl = $state<string | null>(null);
  let localVideo = false;
  let videoEl = $state<HTMLVideoElement | null>(null);
  let videoReady = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let stageW = $state(0);
  let stageH = $state(0);

  const shot = $derived(shots[shotIdx] ?? null);
  const fps = $derived(poses?.fps ?? 30);
  const lo = $derived(shot ? Math.max(0, shot.startFrame - CONTEXT) : 0);
  const hi = $derived(
    shot && poses
      ? Math.min(poses.frames.length - 1, shot.endFrame + CONTEXT)
      : 0,
  );

  const windowFrames = $derived(
    poses && shot
      ? poses.frames
          .slice(lo, hi + 1)
          .filter((f) => f.landmarks)
          .map((f) => ({ landmarks: f.landmarks! }))
      : [],
  );
  const framing = $derived.by((): Framing | null => {
    if (!poses || stageW <= 0 || stageH <= 0 || windowFrames.length === 0)
      return null;
    return computeShotFraming(
      windowFrames,
      { width: stageW, height: stageH },
      { width: poses.width, height: poses.height },
    );
  });
  const videoBox = $derived(framing ? sourceRect(framing) : null);

  const selectedRow = $derived(
    selected
      ? (table.flatMap((g) => g.rows).find((r) => r.id === selected!.id) ??
          null)
      : null,
  );

  onMount(() => {
    if (enabled) void load();
  });
  onDestroy(() => {
    if (videoUrl && localVideo) URL.revokeObjectURL(videoUrl);
  });

  async function load() {
    try {
      const [p, l, t] = await Promise.all([
        fetch(`${REF}/poses.json`).then((r) => r.json()),
        fetch(`${REF}/labels.json`).then((r) => r.json()),
        fetch("/reference/live-targets.json").then((r) => r.json()),
      ]);
      poses = p as PoseData;
      const computed = computeReferenceShots(
        poses,
        l as ReferenceLabels,
        "right",
      );
      shots = computed;
      table = buildMetricTable(
        computed,
        (t as { metrics: Record<string, TargetEntry> }).metrics,
      );
      selectShot(0);
      status = "ready";
      // Local-only video: served in dev when present; otherwise the picker.
      const manifest = (await fetch(`${REF}/manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as { video?: boolean } | null;
      if (manifest?.video) videoUrl = `${REF}/video`;
    } catch (err) {
      error = String(err);
      status = "error";
    }
  }

  function selectShot(i: number) {
    shotIdx = i;
    frame = shots[i]?.startFrame ?? 0;
  }

  function pickVideo(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (videoUrl && localVideo) URL.revokeObjectURL(videoUrl);
    localVideo = true;
    videoReady = false;
    videoUrl = URL.createObjectURL(file);
  }

  function selectCell(id: string, s: number) {
    selected = { id, shot: s };
    const cell = table.flatMap((g) => g.rows).find((r) => r.id === id)?.cells[
      s
    ];
    if (shotIdx !== s) selectShot(s);
    if (cell?.frames[0] !== undefined) frame = cell.frames[0];
  }

  // Video follows the scrubbed frame (frame i is at i / fps in the source).
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
    const lm = poses?.frames[frame]?.landmarks;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(stageW * dpr);
    c.height = Math.round(stageH * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, stageW, stageH);
    if (!lm || !fr) return;
    drawSkeleton(ctx, lm, stageW, stageH, {
      strokeStyle: "rgb(64 224 120 / 90%)",
      jointStyle: "rgb(255 255 255 / 90%)",
      lineWidth: 3,
      jointRadius: 3,
      project: projectWith(fr),
    });
    c.dataset.frame = String(frame);
  });

  const fmt = (v: number) =>
    Math.abs(v) >= 100
      ? v.toFixed(0)
      : Math.abs(v) >= 1
        ? v.toFixed(1)
        : v.toFixed(3);
</script>

<svelte:head><title>Curry model viewer</title></svelte:head>

{#if !enabled}
  <p>Not available.</p>
{:else}
  <main class="ref" data-testid="reference-viewer">
    <header>
      <a href="/__debug">← Debug tools</a>
      <h1>Curry model viewer</h1>
      <p class="dim">
        The {shots.length || 7} reference shots the live targets are built from, measured
        exactly as <code>targets:build</code> does. Click a cell to jump to where
        it was measured.
      </p>
    </header>

    {#if status === "loading"}
      <p data-testid="reference-loading">Loading reference shots…</p>
    {:else if status === "error"}
      <p class="err" data-testid="reference-error">{error}</p>
    {:else}
      <div class="shot-tabs" role="tablist">
        {#each shots as s, i (s.number)}
          <button
            role="tab"
            aria-selected={i === shotIdx}
            class:active={i === shotIdx}
            data-testid="ref-shot-{i + 1}"
            onclick={() => selectShot(i)}>Shot {s.number}</button
          >
        {/each}
      </div>

      <div class="viewer">
        <div
          class="stage"
          bind:clientWidth={stageW}
          bind:clientHeight={stageH}
          data-testid="ref-stage"
        >
          {#if videoUrl}
            <video
              bind:this={videoEl}
              src={videoUrl}
              muted
              playsinline
              preload="auto"
              data-testid="ref-video"
              style={videoBox
                ? `left:${videoBox.left}px;top:${videoBox.top}px;width:${videoBox.width}px;height:${videoBox.height}px`
                : ""}
              onloadedmetadata={() => (videoReady = true)}
            ></video>
          {/if}
          <canvas bind:this={canvas} data-testid="ref-skeleton"></canvas>
        </div>
        <div class="side">
          <input
            type="range"
            min={lo}
            max={hi}
            bind:value={frame}
            data-testid="ref-scrubber"
            aria-label="Scrub reference shot"
          />
          <p class="meta" data-testid="ref-frame">
            frame {frame} · {(frame / fps).toFixed(2)} s
            {#if shot && (frame < shot.startFrame || frame > shot.endFrame)}
              <span class="dim"
                >(outside labeled shot {shot.startFrame}–{shot.endFrame})</span
              >
            {/if}
          </p>
          {#if !videoUrl}
            <label class="pick">
              Video not found locally — load “Stephen Curry 1.mov”:
              <input
                type="file"
                accept="video/*"
                onchange={pickVideo}
                data-testid="ref-video-pick"
              />
            </label>
          {/if}
          {#if selectedRow && selected}
            {@const c = selectedRow.cells[selected.shot]}
            <div class="sel" data-testid="ref-selected">
              <strong>{selectedRow.label}</strong>
              <code>{selectedRow.id}</code>
              <div>
                Shot {selected.shot + 1}:
                {c ? fmt(c.value) : "unmeasured"}{selectedRow.unit}
                {#if c}at frame {c.frames.join(", ")}{/if}
              </div>
              <div class="dim">
                target {fmt(selectedRow.ideal)} · band {fmt(
                  selectedRow.passMin,
                )}–{fmt(selectedRow.passMax)} · SD {fmt(selectedRow.sd)}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="table-wrap">
        <table data-testid="ref-table">
          <thead>
            <tr>
              <th>Metric</th>
              {#each shots as s (s.number)}<th>S{s.number}</th>{/each}
              <th>Mean</th>
              <th>Band</th>
              <th>SD</th>
            </tr>
          </thead>
          {#each table as g (g.group)}
            <tbody>
              <tr class="group"
                ><th colspan={shots.length + 4}>{g.group}</th></tr
              >
              {#each g.rows as r (r.id)}
                <tr class:unscored={!r.scored} data-testid="ref-row-{r.id}">
                  <th class="label" title={r.id}>{r.label}</th>
                  {#each r.cells as c, i (i)}
                    <td>
                      <button
                        class="cell"
                        class:outlier={r.outlier[i]}
                        class:missing={!c}
                        class:sel={selected?.id === r.id && selected.shot === i}
                        data-testid="cell-{r.id}-{i}"
                        onclick={() => selectCell(r.id, i)}
                        >{c ? fmt(c.value) : "—"}</button
                      >
                    </td>
                  {/each}
                  <td class="num">{fmt(r.ideal)}</td>
                  <td class="num">{fmt(r.passMin)}–{fmt(r.passMax)}</td>
                  <td class="num">{fmt(r.sd)}</td>
                </tr>
              {/each}
            </tbody>
          {/each}
        </table>
        <p class="legend dim">
          <span class="cell outlier">x</span> &gt; 2 SD from the target mean ·
          <span class="cell missing">—</span> unmeasured · faded rows are not scored
        </p>
      </div>
    {/if}
  </main>
{/if}

<style>
  .ref {
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin: 4px 0;
    font-size: 22px;
  }
  .dim {
    color: var(--sc-text-dim);
  }
  .err {
    color: var(--sc-fail);
  }
  .shot-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .shot-tabs button {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: inherit;
    cursor: pointer;
  }
  .shot-tabs .active {
    border-color: var(--sc-primary);
    color: var(--sc-primary);
    font-weight: 700;
  }
  .viewer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  @media (min-width: 800px) {
    .viewer {
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    }
  }
  .stage {
    position: relative;
    aspect-ratio: 4 / 3;
    background: #000;
    border-radius: var(--sc-radius);
    overflow: hidden;
  }
  .stage video {
    position: absolute;
    object-fit: fill;
  }
  .stage canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .side input[type="range"] {
    width: 100%;
  }
  .meta {
    margin: 0;
    font-size: 13px;
  }
  .pick {
    font-size: 13px;
    color: var(--sc-text-dim);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sel {
    padding: 8px 10px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    min-width: 100%;
  }
  th,
  td {
    padding: 2px 6px;
    border-bottom: 1px solid var(--sc-border);
    text-align: right;
    white-space: nowrap;
  }
  th.label,
  thead th:first-child {
    text-align: left;
    position: sticky;
    left: 0;
    background: var(--sc-bg, #0b0f17);
  }
  tr.group th {
    text-align: left;
    padding-top: 10px;
    color: var(--sc-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  tr.unscored {
    opacity: 0.5;
  }
  .cell {
    padding: 1px 4px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .cell.outlier {
    border-color: var(--sc-warn);
    color: var(--sc-warn);
  }
  .cell.missing {
    color: var(--sc-text-dim);
  }
  .cell.sel {
    background: var(--sc-primary);
    color: #0b1220;
  }
  .num {
    color: var(--sc-text-dim);
  }
  .legend {
    font-size: 12px;
  }
</style>
