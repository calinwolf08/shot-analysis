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
    asV3Shots,
    buildMetricTable,
    computeReferenceShots,
    v3StatsTargets,
    type MetricGroup,
    type ReferenceLabels,
    type ReferenceShot,
    type TargetEntry,
  } from "$lib/features/reference/curry-model";
  import PoseStage from "$lib/features/reference/PoseStage.svelte";
  import {
    geometryFor,
    type GeometrySides,
  } from "$lib/features/reference/metric-geometry";
  import {
    ALIGN_BOUNDARIES,
    ALIGN_SPAN,
    frameAtPhaseTime,
    metricsForStoredShot,
    phaseTimeAtFrame,
    phaseLabel,
    type PhaseAnchors,
  } from "$lib/features/reference/phase-align";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ShotRecord, ShotReviewPoses } from "$lib/shared/db/repos";
  import {
    dayLabel,
    timeLabel,
  } from "$lib/features/live-practice/review/shot-list";
  import type { ShotMetricsV3 } from "basketball-shot-analysis";

  const enabled = import.meta.env.DEV || import.meta.env.VITE_E2E === "1";
  const services = useAppServices();
  const REF = "/fixtures/reference/stephen-curry-1";
  /** Frames of context shown around each labeled shot window. */
  const CONTEXT = 8;

  let status = $state<"loading" | "ready" | "error">("loading");
  let error = $state<string | null>(null);
  let poses = $state.raw<PoseData | null>(null);
  let shots = $state.raw<ReferenceShot[]>([]);
  let tableV2 = $state.raw<MetricGroup[]>([]);
  let tableV3 = $state.raw<MetricGroup[]>([]);
  /** Which catalog the table shows: v2 (today's targets) or v3 (new). */
  let catalog = $state<"v2" | "v3">("v3");
  const table = $derived(catalog === "v3" ? tableV3 : tableV2);
  let shotIdx = $state(0);
  let frame = $state(0);
  let selected = $state<{ id: string; shot: number } | null>(null);
  let showLabels = $state(true);

  /** Percent position of a frame on the scrubber track. */
  const markerPct = (f: number) => ((f - lo) / Math.max(1, hi - lo)) * 100;
  const EVENT_NAMES: Record<string, string> = {
    hipDropStart: "Hips start dropping",
    ballLowest: "Ball lowest",
    ballRiseStart: "Ball starts rising",
    hipLowest: "Hips lowest",
    kneesDeepest: "Knees deepest",
    kneesStartStraightening: "Knees start straightening",
    setPoint: "Set point",
    kneesStraight: "Knees straight",
    armExtended: "Arm extended",
  };

  let videoUrl = $state<string | null>(null);
  let localVideo = false;
  /** Inspect Curry's shots, or compare one with one of mine. */
  let mode = $state<"inspect" | "compare">("inspect");

  const shot = $derived(shots[shotIdx] ?? null);
  const fps = $derived(poses?.fps ?? 30);
  const lo = $derived(shot ? Math.max(0, shot.startFrame - CONTEXT) : 0);
  const hi = $derived(
    shot && poses
      ? Math.min(poses.frames.length - 1, shot.endFrame + CONTEXT)
      : 0,
  );

  /** Stored frames of a source-frame range (landmarks only). */
  const framesOf = (a: number, b: number) =>
    poses
      ? poses.frames
          .slice(Math.max(0, a), Math.min(poses.frames.length - 1, b) + 1)
          .filter((f) => f.landmarks)
          .map((f) => ({ frameIndex: f.frameIndex, landmarks: f.landmarks! }))
      : [];
  const windowFrames = $derived(shot ? framesOf(lo, hi) : []);
  const source = $derived(
    poses
      ? { width: poses.width, height: poses.height }
      : { width: 16, height: 9 },
  );
  const refSides = $derived<GeometrySides>({
    shootingHand: "right",
    nearSide: shot?.nearSide ?? "right",
  });

  const selectedRow = $derived(
    selected
      ? (table.flatMap((g) => g.rows).find((r) => r.id === selected!.id) ??
          null)
      : null,
  );
  /** Frames the selected cell was measured at (only on its own shot). */
  const selFrames = $derived(
    selected && selectedRow && selected.shot === shotIdx
      ? (selectedRow.cells[selected.shot]?.frames ?? [])
      : [],
  );
  const selSpan = $derived<readonly [number, number] | null>(
    selFrames.length > 0
      ? [Math.min(...selFrames), Math.max(...selFrames)]
      : null,
  );
  /** Geometry of the selected v3 metric (none for v2 ids). */
  const selGeometry = $derived(
    selected && catalog === "v3" && selSpan
      ? { items: geometryFor(selected.id), sides: refSides, span: selSpan }
      : null,
  );

  // ---- Compare: one of my shots vs a Curry shot, phase-time aligned -------
  interface MyShot {
    readonly record: ShotRecord;
    readonly poses: ShotReviewPoses;
    readonly v3: ShotMetricsV3;
    readonly aspect: number;
    readonly anchors: PhaseAnchors | null;
    readonly hand: "left" | "right";
  }
  let myShots = $state.raw<ShotRecord[]>([]);
  let myHand = $state<"left" | "right">("right");
  let myShotsLoaded = $state(false);
  let mine = $state.raw<MyShot | null>(null);
  let mineError = $state<string | null>(null);
  /** Shared phase clock (0 … ALIGN_SPAN). */
  let u = $state(1);
  let playing = $state(false);
  let raf = 0;

  const refAnchors = $derived(shot?.anchors ?? null);
  const refFrameAt = $derived(
    refAnchors ? Math.round(frameAtPhaseTime(refAnchors, u)) : frame,
  );
  const mineFrameAt = $derived(
    mine?.anchors ? Math.round(frameAtPhaseTime(mine.anchors, u)) : 0,
  );
  const cmpRefFrames = $derived(
    refAnchors
      ? framesOf(
          Math.floor(frameAtPhaseTime(refAnchors, 0)),
          Math.ceil(frameAtPhaseTime(refAnchors, ALIGN_SPAN)),
        )
      : [],
  );
  const mineFrames = $derived(
    mine
      ? mine.poses.frames.map((f) => ({
          frameIndex: f.frameIndex,
          landmarks: f.landmarks,
        }))
      : [],
  );
  const mineSource = $derived(
    mine
      ? mine.poses.width && mine.poses.height
        ? { width: mine.poses.width, height: mine.poses.height }
        : { width: mine.aspect * 1000, height: 1000 }
      : { width: 16, height: 9 },
  );
  const mineValues = $derived(
    mine
      ? new Map(
          Object.entries(mine.v3.metrics)
            .filter(([, m]) => m.reliable && Number.isFinite(m.value))
            .map(([id, m]) => [id, m.value]),
        )
      : null,
  );

  async function loadMyShots() {
    if (myShotsLoaded) return;
    myShotsLoaded = true;
    try {
      const player = await services.repos.player.getFirst();
      if (!player) return;
      myHand = player.shootingHand === "left" ? "left" : "right";
      myShots = await services.repos.shot.listByPlayer(player.id, {
        limit: 50,
      });
    } catch {
      myShots = [];
    }
  }

  async function pickMine(id: string) {
    mine = null;
    mineError = null;
    const record = myShots.find((s) => s.id === id);
    if (!record) return;
    const p = await services.repos.shot.getPoses(id).catch(() => null);
    if (!p || p.frames.length === 0) {
      mineError = "This shot has no stored pose track.";
      return;
    }
    const { metrics, aspect } = metricsForStoredShot(p, myHand);
    const anchors =
      metrics.phases.load && metrics.phases.rise && metrics.phases.release
        ? {
            loadStart: metrics.phases.load.start,
            loadEnd: metrics.phases.load.end,
            setPoint: metrics.phases.rise.end,
            armExtended: metrics.phases.release.end,
          }
        : null;
    if (!anchors) mineError = "Couldn't find all phases in this shot.";
    mine = { record, poses: p, v3: metrics, aspect, anchors, hand: myHand };
    u = 1;
  }

  function setMode(m: "inspect" | "compare") {
    mode = m;
    stop();
    if (m === "compare") {
      catalog = "v3";
      void loadMyShots();
    }
  }

  /** Each phase plays in 0.6 s on the shared clock. */
  const SEGMENT_MS = 600;
  function play() {
    if (playing) return stop();
    if (u >= ALIGN_SPAN) u = 0;
    playing = true;
    let last = performance.now();
    const step = (now: number) => {
      u = Math.min(ALIGN_SPAN, u + (now - last) / SEGMENT_MS);
      last = now;
      if (u >= ALIGN_SPAN) return stop();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
  }

  onMount(() => {
    if (enabled) void load();
  });
  onDestroy(() => {
    stop();
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
      tableV2 = buildMetricTable(
        computed,
        (t as { metrics: Record<string, TargetEntry> }).metrics,
      );
      tableV3 = buildMetricTable(asV3Shots(computed), v3StatsTargets(computed));
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
    videoUrl = URL.createObjectURL(file);
  }

  function selectCell(id: string, s: number) {
    selected = { id, shot: s };
    const cell = table.flatMap((g) => g.rows).find((r) => r.id === id)?.cells[
      s
    ];
    if (shotIdx !== s) selectShot(s);
    if (cell?.frames[0] !== undefined) {
      frame = cell.frames[0];
      if (mode === "compare" && shots[s]?.anchors)
        u = phaseTimeAtFrame(shots[s].anchors!, cell.frames[0]);
    }
  }

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
      <div class="catalog" role="tablist" aria-label="Viewer mode">
        <button
          role="tab"
          aria-selected={mode === "inspect"}
          class:active={mode === "inspect"}
          data-testid="mode-inspect"
          onclick={() => setMode("inspect")}>Inspect</button
        >
        <button
          role="tab"
          aria-selected={mode === "compare"}
          class:active={mode === "compare"}
          data-testid="mode-compare"
          onclick={() => setMode("compare")}>Compare with my shot</button
        >
      </div>
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

      {#if mode === "compare"}
        <section class="compare" data-testid="compare">
          <label class="pick-mine">
            My shot:
            <select
              data-testid="cmp-pick"
              onchange={(e) => void pickMine(e.currentTarget.value)}
            >
              <option value="">— choose —</option>
              {#each myShots as m (m.id)}
                <option value={m.id}
                  >{dayLabel(m.createdAt, Date.now())} · {timeLabel(
                    m.createdAt,
                  )}</option
                >
              {/each}
            </select>
            {#if myShotsLoaded && myShots.length === 0}
              <span class="dim" data-testid="cmp-none"
                >No shots yet — record one in Practice.</span
              >
            {/if}
          </label>
          {#if mineError}<p class="err" data-testid="cmp-error">
              {mineError}
            </p>{/if}
          <div class="pair">
            <div class="col">
              <PoseStage
                frames={cmpRefFrames}
                {source}
                frame={refFrameAt}
                {fps}
                {videoUrl}
                geometry={selected && selected.shot === shotIdx
                  ? {
                      items: geometryFor(selected.id),
                      sides: refSides,
                      span: selSpan ?? [refFrameAt, refFrameAt],
                    }
                  : null}
                testid="cmp-ref"
                label="Curry · shot {shot?.number ?? ''}"
              />
              <p
                class="meta"
                data-testid="cmp-ref-phase"
                data-u={refAnchors
                  ? phaseTimeAtFrame(refAnchors, refFrameAt).toFixed(2)
                  : ""}
              >
                {phaseLabel(u)} · frame {refFrameAt}
              </p>
            </div>
            <div class="col">
              {#if mine?.anchors}
                <PoseStage
                  frames={mineFrames}
                  source={mineSource}
                  frame={mineFrameAt}
                  fps={mine.poses.fps || 30}
                  geometry={selected
                    ? {
                        items: geometryFor(selected.id),
                        sides: {
                          shootingHand: mine.hand,
                          nearSide: mine.v3.nearSide,
                        },
                        span: [mineFrameAt, mineFrameAt],
                      }
                    : null}
                  testid="cmp-mine"
                  label="Me"
                />
                <p
                  class="meta"
                  data-testid="cmp-mine-phase"
                  data-u={phaseTimeAtFrame(mine.anchors, mineFrameAt).toFixed(
                    2,
                  )}
                >
                  {phaseLabel(u)} · frame {mineFrameAt}
                </p>
              {:else}
                <div class="placeholder">Pick one of your shots</div>
              {/if}
            </div>
          </div>
          <div class="cmp-track">
            {#each ALIGN_BOUNDARIES as b, i (b)}
              <span class="bound" style="left:{((i + 1) / ALIGN_SPAN) * 100}%"
                >{b}</span
              >
            {/each}
          </div>
          <div class="cmp-controls">
            <button
              data-testid="cmp-play"
              disabled={!mine?.anchors || !refAnchors}
              onclick={play}>{playing ? "❚❚" : "▶"}</button
            >
            <input
              type="range"
              min="0"
              max={ALIGN_SPAN}
              step="0.01"
              bind:value={u}
              data-testid="cmp-scrubber"
              aria-label="Phase-aligned time"
            />
          </div>
          <p class="dim small">
            Phase-aligned: each phase is stretched to the same length on both
            sides, so the boundaries line up however fast each shot was.
          </p>
        </section>
      {/if}

      <div class="viewer" class:hidden={mode === "compare"}>
        <PoseStage
          frames={windowFrames}
          {source}
          {frame}
          {fps}
          {videoUrl}
          geometry={selGeometry}
          testid="ref"
        />
        <div class="side">
          <div class="track" data-testid="ref-markers">
            {#if shot}
              {#each shot.events as e (e.event)}
                {#if e.detected !== null}
                  <span
                    class="mk det"
                    style="left:{markerPct(e.detected)}%"
                    title="detected: {EVENT_NAMES[e.event]}"
                    data-testid="mk-det-{e.event}"
                  ></span>
                {/if}
                {#if showLabels && e.labeled !== null}
                  <span
                    class="mk lab"
                    style="left:{markerPct(e.labeled)}%"
                    title="labeled: {e.labelKey}"
                    data-testid="mk-lab-{e.event}"
                  ></span>
                {/if}
              {/each}
              {#each selFrames as f, k (k)}
                <span
                  class="mk selmk"
                  style="left:{markerPct(f)}%"
                  data-testid="mk-sel-{k}"
                ></span>
              {/each}
            {/if}
          </div>
          <input
            type="range"
            min={lo}
            max={hi}
            bind:value={frame}
            data-testid="ref-scrubber"
            aria-label="Scrub reference shot"
          />
          <label class="toggle">
            <input
              type="checkbox"
              bind:checked={showLabels}
              data-testid="ref-show-labels"
            />
            Show human labels
            <span class="key det"></span> detected (v3)
            <span class="key lab"></span> labeled
          </label>
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
          {#if shot}
            <table class="events" data-testid="ref-events">
              <thead>
                <tr
                  ><th>Event</th><th>Labeled</th><th>Detected</th><th>Δ</th></tr
                >
              </thead>
              <tbody>
                {#each shot.events as e (e.event)}
                  {@const d =
                    e.labeled !== null && e.detected !== null && !e.clipped
                      ? e.detected - e.labeled
                      : null}
                  <tr
                    class:warn={d !== null && Math.abs(d) > 1}
                    class:bad={d !== null && Math.abs(d) > 2}
                    data-testid="ev-{e.event}"
                    onclick={() => {
                      if (e.detected !== null) frame = Math.round(e.detected);
                    }}
                  >
                    <th>{EVENT_NAMES[e.event]}</th>
                    <td>{e.labeled ?? "—"}{e.clipped ? " (clipped)" : ""}</td>
                    <td>{e.detected === null ? "—" : e.detected.toFixed(1)}</td>
                    <td
                      >{d === null ? "" : (d > 0 ? "+" : "") + d.toFixed(1)}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
          {#if selectedRow && selected}
            {@const c = selectedRow.cells[selected.shot]}
            <div class="sel" data-testid="ref-selected">
              <strong>{selectedRow.label}</strong>
              <code>{selectedRow.id}</code>
              <div>
                Shot {selected.shot + 1}:
                {c ? fmt(c.value) : "unmeasured"}{selectedRow.unit}
                {#if c}
                  at
                  {#each c.frames as f, k (k)}
                    <button
                      class="seek"
                      data-testid="sel-frame-{k}"
                      onclick={() => (frame = f)}>frame {f}</button
                    >
                  {/each}
                {/if}
              </div>
              {#if catalog === "v3"}
                <div class="dim" data-testid="sel-geometry">
                  Drawn: {geometryFor(selectedRow.id)
                    .map((g) => g.kind)
                    .join(" + ") || "—"}
                </div>
              {/if}
              <div class="dim">
                target {fmt(selectedRow.ideal)} · band {fmt(
                  selectedRow.passMin,
                )}–{fmt(selectedRow.passMax)} · SD {fmt(selectedRow.sd)}
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="catalog" role="tablist" aria-label="Metric catalog">
        <button
          role="tab"
          aria-selected={catalog === "v3"}
          class:active={catalog === "v3"}
          data-testid="catalog-v3"
          onclick={() => (catalog = "v3")}>New metrics (v3)</button
        >
        <button
          role="tab"
          aria-selected={catalog === "v2"}
          class:active={catalog === "v2"}
          data-testid="catalog-v2"
          onclick={() => (catalog = "v2")}>Current targets (v2)</button
        >
        <span class="dim">
          {catalog === "v3"
            ? "Aspect-correct angles, limb-length distances, timing as % of each phase. Mean / band / SD are from these 7 shots."
            : "What live scoring uses today (live-targets.json)."}
        </span>
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
              {#if mineValues && catalog === "v3"}<th>Mine</th>{/if}
            </tr>
          </thead>
          {#each table as g (g.group)}
            <tbody>
              <tr class="group"
                ><th
                  colspan={shots.length +
                    (mineValues && catalog === "v3" ? 5 : 4)}>{g.group}</th
                ></tr
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
                  {#if mineValues && catalog === "v3"}
                    {@const v = mineValues.get(r.id)}
                    <td
                      class="mine"
                      class:outside={v !== undefined &&
                        (v < r.passMin || v > r.passMax)}
                      data-testid="mine-{r.id}"
                      >{v === undefined ? "—" : fmt(v)}</td
                    >
                  {/if}
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
  .viewer.hidden > :global(.stage) {
    display: none;
  }
  .compare {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pick-mine {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .placeholder {
    aspect-ratio: 4 / 3;
    display: grid;
    place-items: center;
    border: 1px dashed var(--sc-border);
    border-radius: var(--sc-radius);
    color: var(--sc-text-dim);
    font-size: 13px;
  }
  .cmp-track {
    position: relative;
    height: 16px;
    margin: 0 36px 0 44px;
    font-size: 10px;
    color: var(--sc-text-dim);
  }
  .bound {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .cmp-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .cmp-controls input {
    flex: 1;
  }
  .cmp-controls button,
  .seek {
    border: 1px solid var(--sc-border);
    border-radius: 6px;
    background: var(--sc-card);
    color: inherit;
    cursor: pointer;
  }
  .cmp-controls button {
    width: 36px;
    height: 30px;
  }
  .seek {
    font-size: 12px;
    padding: 0 6px;
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .mk.selmk {
    top: 0;
    height: 16px;
    width: 4px;
    background: #fbbf24;
  }
  td.mine {
    font-weight: 700;
  }
  td.mine.outside {
    color: var(--sc-warn);
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
  .track {
    position: relative;
    height: 16px;
  }
  .mk {
    position: absolute;
    width: 3px;
    margin-left: -1px;
    border-radius: 2px;
  }
  .mk.det {
    top: 0;
    height: 8px;
    background: var(--sc-primary);
  }
  .mk.lab {
    top: 8px;
    height: 8px;
    background: #e5e7eb;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--sc-text-dim);
  }
  .key {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
  .key.det {
    background: var(--sc-primary);
  }
  .key.lab {
    background: #e5e7eb;
  }
  .events {
    font-size: 12px;
  }
  .events th:first-child {
    text-align: left;
  }
  .events tbody tr {
    cursor: pointer;
  }
  .events tr.warn td {
    color: var(--sc-warn);
  }
  .events tr.bad td {
    color: var(--sc-fail);
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
  .catalog {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .catalog button {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: inherit;
    cursor: pointer;
  }
  .catalog .active {
    border-color: var(--sc-primary);
    color: var(--sc-primary);
    font-weight: 700;
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
