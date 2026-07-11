<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import type {
    LandmarkFrame,
    LiveAnalysisSession,
  } from "$lib/features/analysis";
  import { Button, ScoreRing } from "$lib/shared/ui";
  import {
    drawSkeleton,
    type SkeletonLandmark,
  } from "$lib/shared/ui/pose-skeleton";
  import { createPresenceTracker, type PresenceState } from "./presence";
  import type { LiveSessionStore } from "./live-session-store.svelte";

  let {
    store,
    session = null,
    focusLabel = null,
    stream = null,
    onend,
  }: {
    store: LiveSessionStore;
    /** Live pose stream; drives the presence indicator + tracking overlay. */
    session?: LiveAnalysisSession | null;
    focusLabel?: string | null;
    stream?: MediaStream | null;
    /** Called with the sessionId once the session is ended + scored. */
    onend: (sessionId: string | null) => void;
  } = $props();

  let drawerOpen = $state(false);
  let ending = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let overlayEl = $state<HTMLCanvasElement | null>(null);

  // Presence comes from the landmark stream itself — NOT the coordinator
  // phase, which stays "ready/active/…" long after the player walks out
  // of frame. Wall-clock decay handles a stalled camera (no frames at all).
  let presence = $state<PresenceState>("none");
  let latestFrame = $state<LandmarkFrame | null>(null);

  $effect(() => {
    if (!session) return;
    const tracker = createPresenceTracker();
    const unsubscribe = session.onFrame((frame) => {
      presence = tracker.update(frame);
      latestFrame = frame;
    });
    const decay = setInterval(() => {
      presence = tracker.evaluate();
    }, 400);
    return () => {
      unsubscribe();
      clearInterval(decay);
    };
  });

  const badgeText = $derived(
    presence === "full"
      ? "Player fully in frame"
      : presence === "partial"
        ? "Player partially in frame"
        : "No player detected",
  );

  /**
   * The preview <video> renders with object-fit: cover; landmarks are
   * normalized to the camera frame, so project them through the same
   * crop. Without a camera (replay), map straight onto the canvas.
   */
  function coverProject(w: number, h: number) {
    const vw = videoEl?.videoWidth ?? 0;
    const vh = videoEl?.videoHeight ?? 0;
    if (!vw || !vh) return undefined;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;
    return (l: SkeletonLandmark) => ({ x: ox + l.x * dw, y: oy + l.y * dh });
  }

  $effect(() => {
    const canvas = overlayEl;
    const frame = latestFrame;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // jsdom / unsupported → overlay stays blank
    const w = (canvas.width = canvas.clientWidth || canvas.width);
    const h = (canvas.height = canvas.clientHeight || canvas.height);
    ctx.clearRect(0, 0, w, h);
    if (!frame?.landmarks) return;
    const project = coverProject(w, h);
    drawSkeleton(ctx, frame.landmarks, w, h, {
      strokeStyle: "rgb(64 224 120 / 90%)",
      jointStyle: "rgb(255 255 255 / 90%)",
      lineWidth: 2,
      jointRadius: 2.5,
      ...(project ? { project } : {}),
    });
  });

  onMount(() => {
    if (videoEl && stream) videoEl.srcObject = stream;
  });

  async function endSession() {
    if (ending) return;
    ending = true;
    const sessionId = await store.end();
    onend(sessionId);
  }
</script>

<main class="loop" data-testid="practice-loop">
  <header>
    {#if focusLabel}
      <span class="focus" data-testid="loop-focus">Focus: {focusLabel}</span>
    {:else}
      <span class="focus dim">Free shooting</span>
    {/if}
    <div class="controls">
      <button
        class="ctl"
        data-testid="practice-mute"
        aria-pressed={store.muted}
        onclick={() => store.toggleMute()}
      >
        {store.muted ? "🔇" : "🔊"}
      </button>
      {#if store.phase === "paused"}
        <button
          class="ctl"
          data-testid="practice-resume"
          onclick={() => store.resume()}
        >
          ▶
        </button>
      {:else}
        <button
          class="ctl"
          data-testid="practice-pause"
          onclick={() => store.pause()}
        >
          ⏸
        </button>
      {/if}
      <Button
        variant="secondary"
        size="sm"
        testid="practice-end"
        disabled={ending}
        onclick={endSession}
      >
        End
      </Button>
    </div>
  </header>

  <div
    class="preview"
    class:full={presence === "full"}
    class:partial={presence === "partial"}
    data-testid="pose-indicator"
    data-state={presence}
  >
    {#if stream}
      <video
        bind:this={videoEl}
        autoplay
        muted
        playsinline
        data-testid="loop-preview"
      ></video>
    {/if}
    <canvas
      bind:this={overlayEl}
      class="overlay"
      data-testid="live-pose-overlay"
      data-frame={latestFrame?.frameIndex ?? -1}
      aria-hidden="true"
    ></canvas>
    <div class="pose-badge">
      <span class="indicator-dot"></span>
      {badgeText}
    </div>
  </div>

  <section class="stage">
    {#if store.feedback}
      {@const fb = store.feedback}
      <div class="feedback" data-testid="rep-feedback">
        <p class="big-score sc-numeral" data-testid="rep-feedback-score">
          {fb.score === null ? "–" : Math.round(fb.score)}
        </p>
        {#if fb.delta !== null}
          <p
            class="delta"
            class:up={fb.delta >= 0}
            data-testid="rep-feedback-delta"
          >
            {fb.delta >= 0 ? "▲" : "▼"}
            {Math.abs(Math.round(fb.delta))}
          </p>
        {/if}
        {#if fb.cues.primary}
          <p class="cue" data-testid="rep-feedback-cue">
            {fb.cues.primary.text}
          </p>
        {/if}
        {#if fb.cues.secondary.length > 0}
          <div class="chips">
            {#each fb.cues.secondary.slice(0, 2) as cue (cue.metric)}
              <span class="chip">{cue.text}</span>
            {/each}
          </div>
        {/if}
        <button
          class="not-a-shot"
          data-testid="rep-not-a-shot"
          onclick={() => store.excludeRep(fb.repIndex)}
        >
          Not a shot?
        </button>
      </div>
    {:else if store.phase === "analyzing"}
      <div class="analyzing" data-testid="practice-analyzing">
        <span class="pulse"></span>
        Analyzing…
      </div>
    {:else if store.phase === "paused"}
      <p class="banner dim" data-testid="practice-paused">Paused</p>
    {:else}
      <p class="banner" data-testid="practice-idle">Take your shot</p>
      {#if store.noShotFlash}
        <p class="no-shot" data-testid="practice-no-shot">
          No shot detected — keep going
        </p>
      {/if}
    {/if}
  </section>

  <footer>
    <span class="rep-counter sc-numeral" data-testid="rep-counter">
      Rep {store.repCount + 1}
    </span>
    <button
      class="drawer-toggle"
      data-testid="rep-drawer-toggle"
      onclick={() => (drawerOpen = !drawerOpen)}
    >
      Reps ▴
    </button>
    <ScoreRing value={store.average} size={64} testid="session-average" />
  </footer>

  {#if drawerOpen}
    <section class="drawer" data-testid="rep-drawer">
      {#if store.reps.length === 0}
        <p class="dim">No reps yet.</p>
      {:else}
        <ul>
          {#each store.reps as rep (rep.repIndex)}
            <li
              class:excluded={rep.excluded}
              data-testid="rep-row-{rep.repIndex}"
            >
              <span>Rep {rep.repIndex}</span>
              <span class="sc-numeral">
                {rep.score === null ? "–" : Math.round(rep.score)}
              </span>
              <a href="/progress/shot/{rep.shotId}{page.url.search}">detail</a>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</main>

<style>
  .loop {
    min-height: 100dvh;
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-space-3);
  }
  .preview {
    position: relative;
    aspect-ratio: 3 / 4;
    border-radius: var(--sc-radius);
    border: 3px solid var(--sc-fail);
    background: #000;
    overflow: hidden;
    transition: border-color 0.3s;
  }
  .preview.partial {
    border-color: var(--sc-warn);
  }
  .preview.full {
    border-color: var(--sc-success);
  }
  .preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .preview .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .pose-badge {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgb(0 0 0 / 60%);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sc-fail);
    transition: background 0.3s;
  }
  .preview.partial .indicator-dot {
    background: var(--sc-warn);
  }
  .preview.full .indicator-dot {
    background: var(--sc-success);
  }
  .focus {
    color: var(--sc-primary);
    font-size: 13px;
    font-weight: 600;
  }
  .dim {
    color: var(--sc-text-dim);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--sc-space-2);
  }
  .ctl {
    background: var(--sc-card);
    border: 1px solid var(--sc-border);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    cursor: pointer;
    font-size: 14px;
  }
  .stage {
    flex: 1;
    display: grid;
    place-content: center;
    text-align: center;
    gap: var(--sc-space-3);
  }
  .banner {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
  }
  .no-shot {
    color: var(--sc-warn);
    margin: 0;
  }
  .analyzing {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
    font-size: 22px;
    font-weight: 600;
  }
  .pulse {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--sc-primary);
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-space-2);
  }
  .big-score {
    font-size: 96px;
    font-weight: 800;
    margin: 0;
    line-height: 1;
  }
  .delta {
    margin: 0;
    font-weight: 700;
    color: var(--sc-fail);
  }
  .delta.up {
    color: var(--sc-success);
  }
  .cue {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }
  .chips {
    display: flex;
    gap: var(--sc-space-2);
    flex-wrap: wrap;
    justify-content: center;
  }
  .chip {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-border);
    font-size: 12px;
    font-weight: 600;
  }
  .not-a-shot {
    background: none;
    border: none;
    color: var(--sc-text-dim);
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-space-3);
  }
  .rep-counter {
    font-size: 20px;
    font-weight: 700;
  }
  .drawer-toggle {
    background: none;
    border: none;
    color: var(--sc-text-dim);
    cursor: pointer;
    font-size: 13px;
  }
  .drawer ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
    max-height: 30dvh;
    overflow-y: auto;
  }
  .drawer li {
    display: flex;
    justify-content: space-between;
    gap: var(--sc-space-3);
    padding: 8px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
    font-size: 14px;
  }
  .drawer li.excluded {
    opacity: 0.5;
    text-decoration: line-through;
  }
  .drawer a {
    color: var(--sc-primary);
  }
</style>
