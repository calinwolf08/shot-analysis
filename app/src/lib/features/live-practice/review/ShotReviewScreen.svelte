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
  let videoEl = $state<HTMLVideoElement | null>(null);
  let videoReady = $state(false);

  /**
   * Median per-frame body height (normalized) → a CONSTANT zoom scale so the
   * figure fills the view without rescaling frame to frame. Each frame is then
   * centered on its own bbox, so the pose stays large and centered while
   * following the motion.
   */
  let bodyHeight = $state<number | null>(null);

  const MIN_VIS = 0.3;
  const FILL = 0.82; // figure fills ~82% of the stage height

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
    bodyHeight = computeBodyHeight(p);
    void loadReferencePoses();
    void loadClip(id);
  }

  async function loadClip(id: string) {
    revokeClip();
    videoReady = false;
    const blob = await clipStore.get(id).catch(() => null);
    if (blob) clipUrl = URL.createObjectURL(blob);
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

  /** Visible-landmark bounding box of one frame (normalized), or null. */
  function frameBounds(
    landmarks: { x: number; y: number; visibility: number }[],
  ) {
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0,
      seen = false;
    for (const l of landmarks) {
      if (l.visibility < MIN_VIS) continue;
      seen = true;
      if (l.x < minX) minX = l.x;
      if (l.y < minY) minY = l.y;
      if (l.x > maxX) maxX = l.x;
      if (l.y > maxY) maxY = l.y;
    }
    return seen ? { minX, minY, maxX, maxY } : null;
  }

  /** Median per-frame vertical extent → a stable scale that doesn't breathe. */
  function computeBodyHeight(p: ShotReviewPoses | null): number | null {
    if (!p || p.frames.length === 0) return null;
    const heights: number[] = [];
    for (const f of p.frames) {
      const b = frameBounds(f.landmarks);
      if (b) heights.push(b.maxY - b.minY);
    }
    if (heights.length === 0) return null;
    heights.sort((a, b) => a - b);
    return heights[Math.floor(heights.length / 2)]!;
  }

  /**
   * Zoom-to-fill projection: a CONSTANT scale (from the median body height) so
   * the figure fills ~FILL of the stage, centered on the CURRENT frame's bbox
   * so it stays big and centered as the player moves through the shot.
   */
  function makeProject(
    frameLandmarks: { x: number; y: number; visibility: number }[],
    w: number,
    h: number,
  ): (l: Pt) => { x: number; y: number } {
    const bh = bodyHeight;
    const b = frameBounds(frameLandmarks);
    if (!bh || bh < 0.02 || !b) return (l) => ({ x: l.x * w, y: l.y * h });
    // px scale that makes a median-height figure fill FILL·h; capped so a
    // near-degenerate frame can't blow up.
    const scale = Math.min((FILL * h) / (bh * h), 6);
    const cx = ((b.minX + b.maxX) / 2) * w;
    const cy = ((b.minY + b.maxY) / 2) * h;
    return (l) => ({
      x: (l.x * w - cx) * scale + w / 2,
      y: (l.y * h - cy) * scale + h / 2,
    });
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
   * object-fit:cover mapping matching the clip <video>, so the overlay stays
   * registered with the footage. Used only when a clip is present; without one
   * the skeleton uses the zoom-to-fill projection.
   */
  function coverProject(
    w: number,
    h: number,
  ): ((l: Pt) => { x: number; y: number }) | null {
    const vw = videoEl?.videoWidth ?? 0;
    const vh = videoEl?.videoHeight ?? 0;
    if (!vw || !vh) return null;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;
    return (l) => ({ x: ox + l.x * dw, y: oy + l.y * dh });
  }

  // Keep the clip scrubbed in step with the pose: map the frame range across
  // the whole clip (the clip ~spans the shot, so this is approximate).
  $effect(() => {
    const v = videoEl;
    const c = current;
    if (!v || !videoReady || !v.duration || !isFinite(v.duration)) return;
    const span = Math.max(end - start, 1);
    const frac = Math.min(1, Math.max(0, (c - start) / span));
    try {
      v.currentTime = frac * v.duration;
    } catch {
      /* seeking not ready */
    }
  });

  $effect(() => {
    const c = canvas;
    const f = frame;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Measure the real displayed size (the canvas fills the stage via CSS) and
    // back it with a DPR-scaled bitmap so the pose is crisp, not a stretched
    // 300×150 default.
    const rect = c.getBoundingClientRect();
    const w = rect.width || 300;
    const h = rect.height || 400;
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (!f) return;

    const lm = f.landmarks;
    // With a clip, align the overlay to the footage; otherwise zoom to fill.
    const cover = clipUrl && videoReady ? coverProject(w, h) : null;
    const project = cover ?? makeProject(lm, w, h);

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
    <div class="stage">
      {#if clipUrl}
        <video
          bind:this={videoEl}
          class="clip"
          src={clipUrl}
          muted
          playsinline
          preload="auto"
          data-testid="review-video"
          onloadedmetadata={() => (videoReady = true)}
        ></video>
      {/if}
      {#if poses && poses.frames.length > 0}
        <canvas
          bind:this={canvas}
          class="skeleton"
          data-testid="review-skeleton"
        ></canvas>
        {#if phaseIssues.length > 0}
          <div class="phase-overlay" data-testid="review-phase-metrics">
            <span class="po-head">
              {currentPhase} · off target
            </span>
            <div class="po-chips">
              {#each phaseIssues.slice(0, 4) as m (m.id)}
                <span class="po-chip" class:bad={m.score > 4}>
                  {m.label}{#if m.direction}
                    <em>{m.direction} by {m.magnitude}</em>{/if}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      {:else if !clipUrl}
        <p class="dim no-poses" data-testid="review-no-poses">
          No pose data stored for this shot.
        </p>
      {/if}
    </div>

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
        <input
          type="range"
          min={start}
          max={end}
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
  .clip {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: #000;
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
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 8px 10px;
    background: linear-gradient(transparent, rgb(0 0 0 / 70%));
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
  .po-chip em {
    font-style: normal;
    opacity: 0.85;
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
