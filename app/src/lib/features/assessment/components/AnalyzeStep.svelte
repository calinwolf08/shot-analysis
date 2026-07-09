<script lang="ts">
  import { ProgressBar } from "$lib/shared/ui";
  import Button from "$lib/shared/ui/Button.svelte";
  import type { AssessmentProgress } from "../services/assessment-service";

  let {
    progress,
    oncancel,
  }: {
    progress: AssessmentProgress | null;
    oncancel: () => void;
  } = $props();

  const phaseLabel = $derived.by(() => {
    const phase = progress?.analysis?.phase;
    if (phase === "loading") return "Loading video…";
    if (phase === "detecting") return "Detecting pose…";
    if (phase === "extracting") return "Measuring your form…";
    return "Preparing…";
  });

  const fraction = $derived.by(() => {
    const a = progress?.analysis;
    if (!a?.totalFrames) return 0;
    return a.framesProcessed / a.totalFrames;
  });
</script>

<section class="analyze" data-testid="assess-analyze">
  <h2>Analyzing</h2>
  {#if progress}
    <p class="video" data-testid="assess-analyze-video">
      Video {progress.videoIndex + 1} of {progress.videoCount} —
      {progress.videoName}
    </p>
  {/if}
  <ProgressBar value={fraction} label="Analysis progress" />
  <p class="phase" data-testid="assess-analyze-phase">
    {phaseLabel}
    {#if progress?.analysis?.totalFrames}
      {Math.round(fraction * 100)}%
    {/if}
  </p>
  <p class="ticker" data-testid="assess-shots-ticker">
    Shots detected: {progress?.totalShotsDetected ?? 0}
  </p>
  <Button variant="ghost" testid="assess-cancel" onclick={oncancel}>
    Cancel
  </Button>
</section>

<style>
  .analyze {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
    text-align: center;
    padding-top: 20dvh;
  }
  h2 {
    margin: 0;
  }
  .video,
  .phase {
    color: var(--sc-text-dim);
    margin: 0;
    font-size: 14px;
  }
  .ticker {
    font-weight: 700;
    margin: 0;
  }
</style>
