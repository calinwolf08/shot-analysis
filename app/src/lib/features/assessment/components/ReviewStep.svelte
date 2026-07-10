<script lang="ts">
  import type { ShotRecord } from "$lib/shared/db/repos";
  import { Button, Card, MetricChip } from "$lib/shared/ui";

  let {
    shots,
    isExcluded,
    ontoggle,
    onfinish,
    finishing = false,
  }: {
    shots: ShotRecord[];
    isExcluded: (shot: ShotRecord) => boolean;
    ontoggle: (shot: ShotRecord) => void;
    onfinish: () => void;
    finishing?: boolean;
  } = $props();

  const includedCount = $derived(shots.filter((s) => !isExcluded(s)).length);
</script>

<section class="review" data-testid="assess-review">
  <h2>Review detections</h2>
  <p class="hint">
    Not a real shot (a pass, a dribble)? Exclude it so it doesn't affect your
    score.
  </p>

  <div class="shots">
    {#each shots as shot (shot.id)}
      <Card testid="review-shot-{shot.shotIndex}">
        <div class="row">
          <div>
            <strong>Shot {shot.shotIndex + 1}</strong>
            <div class="meta">
              frames {shot.startFrame}–{shot.endFrame}
              {#if shot.orientation && shot.orientation !== "unknown"}
                · {shot.orientation}
              {/if}
            </div>
            <MetricChip
              status={(shot.overallConfidence ?? 0) >= 0.5
                ? "pass"
                : "low-confidence"}
              label="confidence {Math.round(
                (shot.overallConfidence ?? 0) * 100,
              )}%"
            />
          </div>
          <label class="exclude">
            <input
              type="checkbox"
              data-testid="review-exclude-{shot.shotIndex}"
              checked={isExcluded(shot)}
              onchange={() => ontoggle(shot)}
            />
            Exclude
          </label>
        </div>
      </Card>
    {/each}
  </div>

  <Button
    size="lg"
    testid="assess-finish-review"
    disabled={finishing || includedCount === 0}
    onclick={onfinish}
  >
    {finishing
      ? "Scoring…"
      : `See my results (${includedCount} shot${includedCount === 1 ? "" : "s"})`}
  </Button>
</section>

<style>
  .review {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  h2 {
    margin: 0;
  }
  .hint {
    color: var(--sc-text-dim);
    margin: 0;
    font-size: 14px;
  }
  .shots {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sc-space-3);
  }
  .meta {
    color: var(--sc-text-dim);
    font-size: 13px;
    margin: 4px 0 8px;
  }
  .exclude {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--sc-text-dim);
    font-size: 14px;
  }
</style>
