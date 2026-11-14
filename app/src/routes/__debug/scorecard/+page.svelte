<script lang="ts">
  /**
   * Debug demo for the v2 Sequencing/Structure scorecard (metrics overhaul
   * Step 9). Load a poses.json (e.g. anything from test-data/) — it's extracted
   * and scored against the placeholder reference thresholds, then rendered with
   * the Scorecard component. This is the integration surface; wiring it into the
   * real assessment results screen is the same call: scoreShots(poses, thresholds).
   */
  import type {
    PoseData,
    ShotScore,
    Thresholds,
  } from "basketball-shot-analysis";
  import Scorecard from "$lib/features/scoring/v2/Scorecard.svelte";
  import { loadThresholds, scoreShots } from "$lib/features/scoring/v2/service";

  let thresholds = $state<Thresholds | null>(null);
  let scores = $state<ShotScore[]>([]);
  let shotIndex = $state(0);
  let hand = $state<"left" | "right">("right");
  let error = $state<string | null>(null);
  let fileName = $state<string | null>(null);

  async function ensureThresholds(): Promise<Thresholds> {
    if (!thresholds) thresholds = await loadThresholds();
    return thresholds;
  }

  async function onFile(e: Event) {
    error = null;
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    fileName = file.name;
    try {
      const poses = JSON.parse(await file.text()) as PoseData;
      const th = await ensureThresholds();
      scores = scoreShots(poses, th, { shootingHand: hand });
      shotIndex = 0;
      if (scores.length === 0) error = "No shots detected in this poses file.";
    } catch (err) {
      error = (err as Error).message;
      scores = [];
    }
  }
</script>

<div class="page">
  <h1>Sequencing / Structure scorecard (debug)</h1>
  <p class="hint">
    Load a <code>poses.json</code> (from <code>test-data/</code>) to score it
    against the placeholder reference thresholds.
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

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if scores.length > 0}
    <div class="tabs">
      {#each scores as _, i (i)}
        <button class:active={i === shotIndex} onclick={() => (shotIndex = i)}>
          Shot {i + 1}
        </button>
      {/each}
    </div>
    {#if scores[shotIndex]}
      <Scorecard score={scores[shotIndex]!} />
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
</style>
