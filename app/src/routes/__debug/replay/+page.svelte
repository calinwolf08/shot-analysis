<script lang="ts">
  /**
   * Dev-only replay harness for the live-first deviation scoring (step 6).
   *
   * Load a `poses.json` (anything from `test-data/`, e.g. the Curry clips) — it's
   * run through the SAME isomorphic core the live pipeline uses (`analyzeAndScore`)
   * against the live targets, then each detected shot is rendered with the
   * deviation ScoreCard plus the terse voice readback the live loop would speak.
   * Lets you validate scoring + targets from recorded clips with no camera.
   *
   * For the FULL live loop (rep detection + earcons + voice) driven from a video
   * instead of the webcam, use the practice route with `?liveVideo=<url>` in dev.
   */
  import {
    EVENT_PAD_AFTER,
    EVENT_PAD_BEFORE,
    computeShotMetricsV3,
    type LiveTargetsV3,
    type PoseData,
    type SignalFrame,
  } from "basketball-shot-analysis";
  import {
    ScoreCardV3,
    feedbackV3,
    loadLiveTargetsV3,
    scoreShotV3,
    type ScorecardV3,
  } from "$lib/features/scoring/v3";
  import {
    ScoreCard,
    loadLiveTargets,
    type LiveTargets,
  } from "$lib/features/scoring";
  import {
    analyzeAndScore,
    buildWorstReadback,
    type ScoredShot,
  } from "$lib/features/live-practice";

  let targets = $state<LiveTargets | null>(null);
  let shots = $state<ScoredShot[]>([]);
  /** v3 scorecard per detected shot (new metrics + 0–10+ scale). */
  let cardsV3 = $state<(ScorecardV3 | null)[]>([]);
  let view = $state<"v3" | "v2">("v3");
  let shotIndex = $state(0);
  let hand = $state<"left" | "right">("right");
  let fileName = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function ensureTargets(): Promise<LiveTargets> {
    if (!targets) targets = await loadLiveTargets();
    return targets;
  }

  async function onFile(e: Event) {
    error = null;
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    fileName = file.name;
    try {
      const poses = JSON.parse(await file.text()) as PoseData;
      const t = await ensureTargets();
      const res = analyzeAndScore(
        poses,
        { shootingHand: hand, profile: "pro-form" },
        t,
      );
      shots = res.shots;
      const t3: LiveTargetsV3 = await loadLiveTargetsV3();
      cardsV3 = res.shots.map((sh) => {
        const { start, end } = sh.analysis.frameRange;
        const posed = poses.frames.filter((f) => f.landmarks);
        const lo = Math.max(0, start - EVENT_PAD_BEFORE);
        const hi = Math.min(posed.length - 1, end + EVENT_PAD_AFTER);
        const m = computeShotMetricsV3(
          posed.slice(lo, hi + 1) as SignalFrame[],
          {
            aspect:
              poses.width > 1 && poses.height > 1
                ? poses.width / poses.height
                : 9 / 16,
            shootingHand: hand,
          },
        );
        return scoreShotV3(m.metrics, t3);
      });
      shotIndex = 0;
      if (shots.length === 0) {
        error =
          res.rejected.length > 0
            ? `No accepted shots: ${res.rejected.length} detected from a camera angle live practice rejects (${[...new Set(res.rejected.map((r) => r.orientation))].join(", ")}).`
            : "No shots detected in this poses file.";
      }
    } catch (err) {
      error = (err as Error).message;
      shots = [];
    }
  }

  const current = $derived(shots[shotIndex] ?? null);
  const cardV3 = $derived(cardsV3[shotIndex] ?? null);
  const fbV3 = $derived(cardV3 ? feedbackV3(cardV3) : null);
  const readback = $derived(
    current
      ? buildWorstReadback(current.worst, {
          durationFrames:
            current.analysis.frameRange.end -
            current.analysis.frameRange.start +
            1,
        })
      : "",
  );
</script>

<div class="page">
  <h1>Live deviation scorecard (replay)</h1>
  <p class="hint">
    Load a <code>poses.json</code> (from <code>test-data/</code>) to score it
    against the live targets — the same path the on-device live pipeline runs.
  </p>

  <div class="controls">
    <label>
      Shooting hand
      <select bind:value={hand}>
        <option value="right">Right</option>
        <option value="left">Left</option>
      </select>
    </label>
    <input type="file" accept="application/json,.json" onchange={onFile} />
    {#if fileName}<span class="file">{fileName}</span>{/if}
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  {#if shots.length > 0}
    <div class="tabs">
      {#each shots as _, i (i)}
        <button class:active={i === shotIndex} onclick={() => (shotIndex = i)}>
          Shot {i + 1}
        </button>
      {/each}
    </div>
    <div class="tabs">
      <button
        class:active={view === "v3"}
        data-testid="replay-view-v3"
        onclick={() => (view = "v3")}>New scoring (v3)</button
      >
      <button
        class:active={view === "v2"}
        data-testid="replay-view-v2"
        onclick={() => (view = "v2")}>Current (v2)</button
      >
    </div>
    {#if view === "v3" && cardV3 && fbV3}
      {#if fbV3.spoken}
        <p class="readback" data-testid="replay-readback-v3">
          🔊 “{fbV3.spoken}”
        </p>
      {:else}
        <p class="readback dim">On target — nothing to call out.</p>
      {/if}
      <ScoreCardV3 card={cardV3} />
    {:else if current}
      {#if readback}
        <p class="readback" data-testid="replay-readback">🔊 “{readback}”</p>
      {:else}
        <p class="readback dim">No metrics off target — nothing to call out.</p>
      {/if}
      <ScoreCard card={current.scorecard} />
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 16px;
    color: #e5e7eb;
    background: #0b1220;
    min-height: 100vh;
  }
  h1 {
    font-size: 1.2rem;
  }
  .hint {
    color: #9ca3af;
    font-size: 0.85rem;
  }
  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 12px 0;
    flex-wrap: wrap;
  }
  .file {
    color: #9ca3af;
    font-size: 0.8rem;
  }
  .error {
    color: #f87171;
  }
  .tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .tabs button {
    background: #1f2937;
    color: #cbd5e1;
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .tabs button.active {
    background: #2563eb;
    color: white;
  }
  .readback {
    font-size: 0.95rem;
    margin: 8px 0 16px;
  }
  .readback.dim {
    color: #9ca3af;
  }
</style>
