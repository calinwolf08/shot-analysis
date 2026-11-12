<script lang="ts">
  /**
   * Shot review (live redesign — step 7): scrub a past shot and watch the pose
   * play back with keyframe markers, while the deviation scorecard highlights
   * the phase the scrubber is in. Pose comes from the server-stored skeleton
   * track (works for every shot, every device); a retained on-device clip is a
   * later enhancement that would render behind this same overlay.
   */
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ShotRecord, ShotReviewPoses } from "$lib/shared/db/repos";
  import type { StoredShotAnalysis } from "$lib/features/analysis";
  import { scorecardForShot } from "$lib/features/live-practice";
  import {
    ScoreCard,
    loadLiveTargets,
    type ShotScorecard,
  } from "$lib/features/scoring";
  import { Button } from "$lib/shared/ui";
  import { drawSkeleton } from "$lib/shared/ui/pose-skeleton";

  let { shotId }: { shotId: string } = $props();

  const services = useAppServices();

  let shot = $state<ShotRecord | null>(null);
  let poses = $state<ShotReviewPoses | null>(null);
  let card = $state<ShotScorecard | null>(null);
  let current = $state(0);
  let notFound = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);

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

  $effect(() => {
    void load(shotId);
  });

  async function load(id: string) {
    const [s, p, targets] = await Promise.all([
      services.repos.shot.get(id),
      services.repos.shot.getPoses(id),
      loadLiveTargets(),
    ]);
    if (!s) {
      notFound = true;
      return;
    }
    shot = s;
    poses = p;
    card = scorecardForShot(s.analysis, targets);
    current = s.analysis.frameRange.start;
  }

  function markerLeft(startFrame: number): number {
    const span = Math.max(end - start, 1);
    return ((startFrame - start) / span) * 100;
  }

  $effect(() => {
    const c = canvas;
    const f = frame;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = (c.width = c.clientWidth || c.width);
    const h = (c.height = c.clientHeight || c.height);
    ctx.clearRect(0, 0, w, h);
    if (!f) return;
    drawSkeleton(ctx, f.landmarks, w, h, {
      strokeStyle: "rgb(64 224 120 / 90%)",
      jointStyle: "rgb(255 255 255 / 90%)",
      lineWidth: 2,
      jointRadius: 3,
    });
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
      {#if poses && poses.frames.length > 0}
        <canvas
          bind:this={canvas}
          class="skeleton"
          data-testid="review-skeleton"
        ></canvas>
      {:else}
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

    <ScoreCard {card} highlightPhase={currentPhase} />
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
  .skeleton {
    width: 100%;
    height: 100%;
  }
  .no-poses {
    padding: var(--sc-space-4);
    text-align: center;
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
