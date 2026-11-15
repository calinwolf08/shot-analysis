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
  import type { PoseData } from "basketball-shot-analysis";
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
      shots = analyzeAndScore(
        poses,
        { shootingHand: hand, profile: "pro-form" },
        t,
      );
      shotIndex = 0;
      if (shots.length === 0) error = "No shots detected in this poses file.";
    } catch (err) {
      error = (err as Error).message;
      shots = [];
    }
  }

  const current = $derived(shots[shotIndex] ?? null);
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
    {#if current}
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
