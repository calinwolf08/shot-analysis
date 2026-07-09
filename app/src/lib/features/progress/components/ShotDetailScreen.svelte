<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type {
    KeyFramePoses,
    StoredShotAnalysis,
  } from "$lib/features/analysis";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ShotRecord } from "$lib/shared/db/repos";
  import { Button, ScoreRing } from "$lib/shared/ui";
  import SkeletonOverlay from "./SkeletonOverlay.svelte";

  let { shotId }: { shotId: string } = $props();

  const services = useAppServices();

  const PHASES = [
    ["gather", "Gather"],
    ["load", "Dip"],
    ["rise", "Rise"],
    ["setPoint", "Set"],
    ["release", "Release"],
    ["followThrough", "Follow-through"],
  ] as const;

  let shot = $state<ShotRecord | null>(null);
  let formScore = $state<number | null>(null);
  let selectedPhase = $state<keyof KeyFramePoses>("release");
  let highlightFrame = $state<number | null>(null);

  const poses = $derived(
    (shot?.analysis as StoredShotAnalysis | undefined)?.keyFramePoses ?? {},
  );
  const selectedPose = $derived(poses[selectedPhase] ?? null);
  const metricRows = $derived(
    shot
      ? Object.entries(shot.analysis.metrics).sort(([a], [b]) =>
          a.localeCompare(b),
        )
      : [],
  );

  $effect(() => {
    void load(shotId);
  });

  async function load(id: string) {
    shot = await services.repos.shot.get(id);
    formScore =
      (await services.repos.score.latestForRef("shot", id))?.formScore ?? null;
  }

  function selectMetricFrame(frame: number) {
    highlightFrame = frame;
    // Jump the skeleton to the phase containing this frame.
    if (!shot) return;
    for (const [phase] of PHASES) {
      const range = shot.analysis.phases[phase];
      if (range && frame >= range.startFrame && frame <= range.endFrame) {
        selectedPhase = phase;
        return;
      }
    }
  }
</script>

<main class="detail" data-testid="shot-detail">
  <header>
    <Button
      variant="ghost"
      testid="shot-detail-back"
      onclick={() =>
        history.length > 1 ? history.back() : goto(`/${page.url.search}`)}
    >
      ← Back
    </Button>
    {#if shot}
      <h1>Shot {shot.shotIndex + 1}</h1>
      <ScoreRing value={formScore} size={64} testid="shot-detail-score" />
    {/if}
  </header>

  {#if !shot}
    <p>Loading…</p>
  {:else}
    <section class="viewer">
      <SkeletonOverlay pose={selectedPose} />
      <div class="phases" role="group" aria-label="Shot phases">
        {#each PHASES as [phase, label] (phase)}
          <button
            class:active={selectedPhase === phase}
            disabled={!poses[phase]}
            data-testid="phase-chip-{phase}"
            onclick={() => (selectedPhase = phase)}
          >
            {label}
          </button>
        {/each}
      </div>
      <p class="frame-note">
        {#if selectedPose}
          frame {selectedPose.frameIndex}
        {:else}
          no pose captured for this phase
        {/if}
      </p>
    </section>

    <section class="metrics">
      <h2>Metrics</h2>
      <table data-testid="shot-metric-table">
        <thead>
          <tr><th>Metric</th><th>Value</th><th>Frame</th><th>Conf</th></tr>
        </thead>
        <tbody>
          {#each metricRows as [name, mv] (name)}
            <tr
              class:dimmed={mv.confidence < 0.4}
              class:highlight={highlightFrame === mv.frame}
            >
              <td>{name}</td>
              <td class="sc-numeral">
                {typeof mv.value === "number" ? mv.value.toFixed(1) : mv.value}
                {mv.unit === "degrees" ? "°" : ""}
              </td>
              <td>
                <button
                  class="frame-link"
                  onclick={() => selectMetricFrame(mv.frame)}
                >
                  {mv.frame}
                </button>
              </td>
              <td>{Math.round(mv.confidence * 100)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}
</main>

<style>
  .detail {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    flex: 1;
  }
  .viewer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-space-3);
  }
  .phases {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-space-2);
    justify-content: center;
  }
  .phases button {
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: var(--sc-text-dim);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .phases button.active {
    border-color: var(--sc-primary);
    color: var(--sc-primary);
  }
  .phases button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .frame-note {
    color: var(--sc-text-dim);
    font-size: 12px;
    margin: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    color: var(--sc-text-dim);
    font-weight: 600;
    padding: 6px 8px;
    border-bottom: 1px solid var(--sc-border);
  }
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--sc-border);
  }
  tr.dimmed {
    opacity: 0.5;
  }
  tr.highlight td {
    background: rgb(255 122 41 / 8%);
  }
  .frame-link {
    background: none;
    border: none;
    color: var(--sc-primary);
    cursor: pointer;
    padding: 0;
    font-size: 13px;
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
</style>
