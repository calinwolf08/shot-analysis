<script lang="ts">
  import type { ShotRecord } from "$lib/shared/db/repos";
  import { Button, Card, MetricChip } from "$lib/shared/ui";
  import {
    formatVideoTime,
    type ShotFrameInfo,
  } from "../services/frame-thumbnails";

  let {
    shots,
    frameInfo = {},
    isExcluded,
    ontoggle,
    onfinish,
    finishing = false,
  }: {
    shots: ShotRecord[];
    /** Start/end stills + times per shot id (absent for fixture inputs). */
    frameInfo?: Record<string, ShotFrameInfo>;
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
        {@const info = frameInfo[shot.id]}
        {#if info?.startThumb || info?.endThumb}
          <div class="thumbs" data-testid="review-thumbs-{shot.shotIndex}">
            <figure>
              {#if info.startThumb}
                <img
                  src={info.startThumb}
                  alt="Shot {shot.shotIndex + 1} start frame"
                  data-testid="review-thumb-start-{shot.shotIndex}"
                />
              {/if}
              <figcaption>Start · {formatVideoTime(info.startSec)}</figcaption>
            </figure>
            <figure>
              {#if info.endThumb}
                <img
                  src={info.endThumb}
                  alt="Shot {shot.shotIndex + 1} end frame"
                  data-testid="review-thumb-end-{shot.shotIndex}"
                />
              {/if}
              <figcaption>End · {formatVideoTime(info.endSec)}</figcaption>
            </figure>
          </div>
        {/if}
        <div class="row">
          <div>
            <strong>Shot {shot.shotIndex + 1}</strong>
            <div class="meta">
              frames {shot.startFrame}–{shot.endFrame}
              {#if info}
                ({formatVideoTime(info.startSec)}–{formatVideoTime(
                  info.endSec,
                )})
              {/if}
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
  .thumbs {
    display: flex;
    gap: var(--sc-space-3);
    margin-bottom: var(--sc-space-3);
  }
  .thumbs figure {
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .thumbs img {
    display: block;
    width: 100%;
    border-radius: var(--sc-radius);
    background: #000;
  }
  .thumbs figcaption {
    color: var(--sc-text-dim);
    font-size: 12px;
    margin-top: 4px;
    text-align: center;
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
