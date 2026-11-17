<script lang="ts">
  /**
   * Shot review: scrub a past shot and watch the pose play back, zoomed to fill
   * the frame so form detail is legible. The deviation scorecard highlights the
   * phase the scrubber is in; the current phase's off-target joints are lit up
   * on the pose with a "where it should be" target dot (aligned from the
   * reference pose). Clicking a metric seeks to its phase.
   *
   * Pose comes from the server-stored skeleton track (works for every shot,
   * every device). A retained on-device clip renders behind this same overlay
   * once per-shot video capture lands.
   */
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { getShotClipStore } from "$lib/shared/media/shot-clip-store";
  import type { ShotRecord, ShotReviewPoses } from "$lib/shared/db/repos";
  import type { StoredShotAnalysis } from "$lib/features/analysis";
  import { scorecardForShot } from "$lib/features/live-practice";
  import {
    ScoreCard,
    loadLiveTargets,
    metricMatchesAreas,
    normalizeAreas,
    type MetricDeviation,
    type ShotScorecard,
  } from "$lib/features/scoring";
  import { Button } from "$lib/shared/ui";
  import {
    drawSkeleton,
    type SkeletonLandmark,
  } from "$lib/shared/ui/pose-skeleton";
  import {
    PHASE_KEYFRAME,
    alignReferenceToPlayer,
    landmarksForMetric,
    type Hand,
    type Pt,
  } from "./joint-map";
  import {
    MIN_VIS,
    computeShotFraming,
    projectWith,
    sourceRect,
    type Framing,
  } from "./framing";
  import { phraseFor } from "../loop/readback";

  let { shotId }: { shotId: string } = $props();

  const services = useAppServices();
  const clipStore = getShotClipStore();

  interface ReferencePoses {
    byKeyframe: Record<string, { landmarks: Pt[] }>;
  }

  let shot = $state<ShotRecord | null>(null);
  let poses = $state<ShotReviewPoses | null>(null);
  let card = $state<ShotScorecard | null>(null);
  let referencePoses = $state<ReferencePoses | null>(null);
  let current = $state(0);
  let notFound = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let hand = $state<Hand>("right");

  // Coaching focus (from settings): emphasize these areas in the overlay.
  let focusAreas = $state<string[]>([]);

  // Recorded clip of the actual shot (on-device only; absent on other devices).
  let clipUrl = $state<string | null>(null);
  /** The clip's first frame on the pose-frame clock (null: older clip). */
  let clipStartFrameTs = $state<number | null>(null);
  /** Video is playing and driving the scrubber. */
  let playing = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let videoReady = $state(false);
  let videoSize = $state<{ width: number; height: number } | null>(null);

  // Stage size (CSS px), measured from the layout.
  let stageW = $state(0);
  let stageH = $state(0);

  /**
   * One fixed transform for the whole shot (see ./framing): true proportions,
   * zoomed so the highest and lowest points of the movement are just inside.
   * The source size comes from the clip when there is one, else from the
   * stored pose track, else it's estimated (older shots).
   */
  const framing = $derived.by((): Framing | null => {
    if (!poses || poses.frames.length === 0 || stageW <= 0 || stageH <= 0) {
      return null;
    }
    const source =
      clipUrl && videoReady && videoSize
        ? videoSize
        : poses.width && poses.height
          ? { width: poses.width, height: poses.height }
          : null;
    return computeShotFraming(
      poses.frames,
      { width: stageW, height: stageH },
      source,
    );
  });
  const videoBox = $derived(framing ? sourceRect(framing) : null);

  const analysis = $derived(
    shot ? (shot.analysis as StoredShotAnalysis) : null,
  );
  const start = $derived(analysis?.frameRange.start ?? 0);
  const end = $derived(analysis?.frameRange.end ?? 0);

  /** Phase starts (ordered) for keyframe markers + current-phase highlight. */
  const PHASE_ORDER = [
    "gather",
    "load",
    "rise",
    "setPoint",
    "release",
    "followThrough",
  ];
  const phaseStarts = $derived(
    analysis
      ? PHASE_ORDER.map((phase) => ({
          phase,
          startFrame: (
            analysis.phases as Record<string, { startFrame?: number }>
          )[phase]?.startFrame,
        })).filter(
          (p): p is { phase: string; startFrame: number } =>
            typeof p.startFrame === "number",
        )
      : [],
  );
  const currentPhase = $derived(
    phaseStarts.filter((p) => p.startFrame <= current).at(-1)?.phase ?? null,
  );

  const frame = $derived(
    poses?.frames.find((f) => f.frameIndex === current) ?? null,
  );

  /**
   * Off-target scored metrics in the current phase, worst first. When a focus
   * is set, the overlay emphasizes only those areas (the full scorecard below
   * still shows everything).
   */
  const phaseIssues = $derived<MetricDeviation[]>(
    card && currentPhase
      ? card.all
          .filter(
            (m) =>
              m.phase === currentPhase &&
              m.scored &&
              !m.inBand &&
              (focusAreas.length === 0 || metricMatchesAreas(m.id, focusAreas)),
          )
          .slice()
          .sort((a, b) => b.score - a.score)
      : [],
  );

  /** Landmark indices to light up as off-target in the current phase. */
  const offJoints = $derived<Set<number>>(
    new Set(phaseIssues.flatMap((m) => landmarksForMetric(m.id, hand))),
  );

  $effect(() => {
    void load(shotId);
  });

  async function load(id: string) {
    const [s, p, targets, player] = await Promise.all([
      services.repos.shot.get(id),
      services.repos.shot.getPoses(id),
      loadLiveTargets(),
      services.repos.player.getFirst(),
    ]);
    if (!s) {
      notFound = true;
      return;
    }
    shot = s;
    poses = p;
    card = scorecardForShot(s.analysis, targets);
    current = s.analysis.frameRange.start;
    if (player) hand = player.shootingHand;
    focusAreas = normalizeAreas(
      await services.repos.settings.get("liveFocusAreas"),
    );
    void loadReferencePoses();
    void loadClip(id);
  }

  async function loadClip(id: string) {
    revokeClip();
    videoReady = false;
    const clip = await clipStore.get(id).catch(() => null);
    if (clip) {
      clipStartFrameTs = clip.startFrameTs;
      clipUrl = URL.createObjectURL(clip.blob);
    }
  }

  function revokeClip() {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = null;
  }

  onDestroy(revokeClip);

  async function loadReferencePoses() {
    if (referencePoses) return;
    try {
      // Served from static/ at the app root.
      const res = await fetch("/reference/reference-poses.json");
      if (res.ok) referencePoses = (await res.json()) as ReferencePoses;
    } catch {
      referencePoses = null; // target dots are optional; highlights still show
    }
  }

  function markerLeft(startFrame: number): number {
    const span = Math.max(end - start, 1);
    return ((startFrame - start) / span) * 100;
  }
  function seekToPhase(phase: string) {
    const kf = phaseStarts.find((p) => p.phase === phase);
    if (kf) current = kf.startFrame;
  }

  /**
   * Video time (s) for a pose frame. Exact when the clip's start and the
   * frame's capture time are both known (same clock); older clips fall back
   * to spreading the shot across the clip.
   */
  function videoTimeFor(frameIndex: number): number | null {
    const f = poses?.frames.find((p) => p.frameIndex === frameIndex);
    if (clipStartFrameTs !== null && typeof f?.t === "number") {
      return Math.max(0, (f.t - clipStartFrameTs) / 1000);
    }
    const v = videoEl;
    if (!v || !v.duration || !isFinite(v.duration)) return null;
    const span = Math.max(end - start, 1);
    return Math.min(1, Math.max(0, (frameIndex - start) / span)) * v.duration;
  }

  /** The pose frame shown at a video time (inverse of videoTimeFor). */
  function frameAtTime(seconds: number): number {
    if (!poses) return start;
    let best = start;
    let bestErr = Infinity;
    for (const f of poses.frames) {
      const vt = videoTimeFor(f.frameIndex);
      if (vt === null) continue;
      const err = Math.abs(vt - seconds);
      if (err < bestErr) {
        bestErr = err;
        best = f.frameIndex;
      }
    }
    return best;
  }

  const exactSync = $derived(
    clipStartFrameTs !== null &&
      !!poses?.frames.some((f) => typeof f.t === "number"),
  );

  // Scrubbing seeks the clip to the shown pose frame (unless the video is
  // playing — then the video drives the scrubber).
  $effect(() => {
    const v = videoEl;
    const c = current;
    if (!v || !videoReady || playing) return;
    const t = videoTimeFor(c);
    if (t === null) return;
    try {
      v.currentTime = t;
    } catch {
      /* seeking not ready */
    }
  });

  async function togglePlay() {
    const v = videoEl;
    if (!v) return;
    if (playing) {
      v.pause();
      playing = false;
      return;
    }
    if (current >= end) current = start;
    const t = videoTimeFor(current);
    if (t !== null) v.currentTime = t;
    playing = true;
    try {
      await v.play();
    } catch {
      playing = false;
      return;
    }
    const tick = () => {
      if (!playing || !videoEl) return;
      current = frameAtTime(videoEl.currentTime);
      if (videoEl.ended || current >= end) {
        videoEl.pause();
        playing = false;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  $effect(() => {
    const c = canvas;
    const f = frame;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Back the canvas with a DPR-scaled bitmap of the stage size so the pose
    // is crisp, not a stretched 300×150 default.
    const fr = framing;
    const w = stageW || 300;
    const h = stageH || 400;
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (!f || !fr) return;

    const lm = f.landmarks;
    const project = projectWith(fr);
    // Test/debug hook: where this frame's visible joints landed on the stage.
    const pts = lm.filter((l) => l.visibility >= MIN_VIS).map(project);
    if (pts.length > 0) {
      c.dataset.frameBox = JSON.stringify({
        top: Math.min(...pts.map((q) => q.y)),
        bottom: Math.max(...pts.map((q) => q.y)),
        left: Math.min(...pts.map((q) => q.x)),
        right: Math.max(...pts.map((q) => q.x)),
      });
    }

    // Base skeleton.
    drawSkeleton(ctx, lm, w, h, {
      strokeStyle: "rgb(64 224 120 / 85%)",
      jointStyle: "rgb(255 255 255 / 85%)",
      lineWidth: 3,
      jointRadius: 3,
      project,
    });

    // Reference target transform for the current phase (best-effort).
    const joints = offJoints;
    if (joints.size === 0) return;
    const keyframe = currentPhase ? PHASE_KEYFRAME[currentPhase] : undefined;
    const ref =
      keyframe && referencePoses
        ? referencePoses.byKeyframe[keyframe]?.landmarks
        : undefined;
    const toPlayer = ref ? alignReferenceToPlayer(ref, lm) : null;

    for (const j of joints) {
      const pl = lm[j] as SkeletonLandmark | undefined;
      if (!pl || pl.visibility < MIN_VIS) continue;
      const pp = project(pl);

      // Target dot + connector (where the joint should be).
      if (toPlayer && ref && ref[j]) {
        const tp = project(toPlayer(ref[j]));
        ctx.strokeStyle = "rgb(255 255 255 / 55%)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pp.x, pp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgb(96 165 250 / 95%)"; // target: blue dot
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgb(255 255 255 / 90%)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Off-target joint: red ring over the player's actual joint.
      ctx.strokeStyle = "rgb(248 113 113 / 95%)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
</script>

<main class="review" data-testid="shot-review">
  <header>
    <Button
      variant="ghost"
      testid="shot-review-back"
      onclick={() =>
        history.length > 1 ? history.back() : goto(`/shots${page.url.search}`)}
    >
      ← Back
    </Button>
    <h1>Shot review</h1>
  </header>

  {#if notFound}
    <p class="dim" data-testid="shot-review-missing">Shot not found.</p>
  {:else if shot && card}
    <div
      class="stage"
      bind:clientWidth={stageW}
      bind:clientHeight={stageH}
      data-testid="review-stage"
    >
      {#if clipUrl}
        <video
          bind:this={videoEl}
          class="clip"
          src={clipUrl}
          muted
          playsinline
          preload="auto"
          data-testid="review-video"
          data-start-frame-ts={clipStartFrameTs ?? ""}
          data-exact-sync={exactSync}
          style={videoBox
            ? `left:${videoBox.left}px;top:${videoBox.top}px;width:${videoBox.width}px;height:${videoBox.height}px`
            : ""}
          onloadedmetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) {
              videoSize = { width: v.videoWidth, height: v.videoHeight };
            }
            videoReady = true;
          }}
        ></video>
      {/if}
      {#if poses && poses.frames.length > 0}
        <canvas
          bind:this={canvas}
          class="skeleton"
          data-testid="review-skeleton"
          data-framing={framing
            ? JSON.stringify({
                scale: framing.scale,
                offsetX: framing.offsetX,
                offsetY: framing.offsetY,
                aspect: framing.aspect,
              })
            : ""}
          data-approximate={framing?.approximate ?? false}
          data-frame-t={frame?.t ?? ""}
        ></canvas>
        {#if framing?.approximate}
          <span class="approx" data-testid="review-approx-framing"
            >Approximate framing (older shot)</span
          >
        {/if}
      {:else if !clipUrl}
        <p class="dim no-poses" data-testid="review-no-poses">
          No pose data stored for this shot.
        </p>
      {/if}
    </div>
    <!-- Below the stage (not over it) so the chips never hide the feet. -->
    {#if poses && poses.frames.length > 0 && phaseIssues.length > 0}
      <div class="phase-overlay" data-testid="review-phase-metrics">
        <span class="po-head">{currentPhase} · off target</span>
        <div class="po-chips">
          {#each phaseIssues.slice(0, 4) as m (m.id)}
            <span class="po-chip" class:bad={m.score > 4}>{phraseFor(m)}</span>
          {/each}
        </div>
      </div>
    {/if}

    {#if poses && poses.frames.length > 0}
      <div class="scrubber">
        <div class="track">
          {#each phaseStarts as kf (kf.phase)}
            <span
              class="marker"
              style="left:{markerLeft(kf.startFrame)}%"
              title={kf.phase}
            ></span>
          {/each}
        </div>
        {#if clipUrl}
          <button
            class="play"
            data-testid="review-play"
            aria-label={playing ? "Pause video" : "Play video"}
            disabled={!videoReady}
            onclick={() => void togglePlay()}
          >
            {playing ? "⏸" : "▶"}
          </button>
        {/if}
        <input
          type="range"
          min={start}
          max={end}
          oninput={() => {
            if (playing) {
              videoEl?.pause();
              playing = false;
            }
          }}
          bind:value={current}
          data-testid="review-scrubber"
          aria-label="Scrub shot"
        />
        <div class="scrub-meta">
          <span>frame {current - start + 1} / {end - start + 1}</span>
          {#if currentPhase}<span class="phase-tag" data-testid="review-phase"
              >{currentPhase}</span
            >{/if}
        </div>
      </div>
    {/if}

    <ScoreCard
      {card}
      highlightPhase={currentPhase}
      onmetric={(m) => seekToPhase(m.phase)}
    />
  {:else}
    <p class="dim">Loading…</p>
  {/if}
</main>

<style>
  .review {
    min-height: 100dvh;
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 18px;
  }
  .stage {
    position: relative;
    aspect-ratio: 3 / 4;
    background: #000;
    border-radius: var(--sc-radius);
    overflow: hidden;
    display: grid;
    place-content: center;
  }
  /* Positioned + sized by the shot framing (same transform as the pose). */
  .clip {
    position: absolute;
    object-fit: fill;
    background: #000;
  }
  .play {
    width: 40px;
    height: 32px;
    margin-right: 8px;
    border: 1px solid var(--sc-border);
    border-radius: 8px;
    background: var(--sc-card);
    color: var(--sc-text);
    cursor: pointer;
  }
  .approx {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgb(0 0 0 / 60%);
    color: #cbd5e1;
    font-size: 10px;
  }
  .skeleton {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .no-poses {
    padding: var(--sc-space-4);
    text-align: center;
  }
  .phase-overlay {
    padding: 6px 2px 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
  }
  .po-head {
    font-size: 0.68rem;
    text-transform: capitalize;
    letter-spacing: 0.03em;
    color: #cbd5e1;
  }
  .po-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .po-chip {
    font-size: 0.72rem;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgb(251 191 36 / 18%);
    border: 1px solid rgb(251 191 36 / 70%);
    color: #fde68a;
  }
  .po-chip.bad {
    background: rgb(248 113 113 / 18%);
    border-color: rgb(248 113 113 / 70%);
    color: #fecaca;
  }
  .scrubber {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .track {
    position: relative;
    height: 6px;
  }
  .marker {
    position: absolute;
    top: 0;
    width: 2px;
    height: 6px;
    background: var(--sc-primary);
    transform: translateX(-1px);
  }
  .scrubber input {
    width: 100%;
  }
  .scrub-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--sc-text-dim);
  }
  .phase-tag {
    text-transform: capitalize;
    color: var(--sc-primary);
    font-weight: 600;
  }
  .dim {
    color: var(--sc-text-dim);
  }
</style>
