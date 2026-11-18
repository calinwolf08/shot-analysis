<script lang="ts">
  /**
   * Continuous, session-less practice loop (live redesign — step 6). Renders a
   * LivePracticeStore: live preview + skeleton overlay, per-shot feedback (the
   * overall deviation score, the worst metrics, and the full ScoreCard on
   * demand), and a running history. No "End / summary" — you practice until you
   * leave, and every shot is already persisted.
   */
  import { onMount, untrack } from "svelte";
  import type {
    LandmarkFrame,
    LiveAnalysisSession,
  } from "$lib/features/analysis";
  import {
    createLiveFrameCapture,
    type FrameCaptureHandle,
  } from "$lib/shared/media/frame-capture";
  import type { AudioFeedbackService } from "$lib/shared/audio";
  import type { ShotClipStore } from "$lib/shared/media/shot-clip-store";
  import {
    createShotClipRecorder,
    type ShotClipRecorder,
  } from "$lib/shared/media/shot-clip-recorder";
  import { Sheet } from "$lib/shared/ui";
  import {
    drawSkeleton,
    type SkeletonLandmark,
  } from "$lib/shared/ui/pose-skeleton";
  import { FocusSheet, ScoreCard, focusSummary } from "$lib/features/scoring";
  import type { SideOrientation } from "../setup/angle-gate";
  import { createPresenceTracker, type PresenceState } from "./presence";
  import { phaseName, phraseFor } from "./readback";
  import {
    CUE_TEXT,
    READY_TEXT,
    createReadinessGate,
    type ReadinessCue,
    type ReadinessState,
  } from "./readiness";
  import {
    createCuePacer,
    type CuePacer,
    type PacerSnapshot,
  } from "./cue-pacer";
  import { DEFAULT_LIVE_TUNING, type LiveTuning } from "../tuning";
  import type { LivePracticeStore } from "./live-practice-store.svelte";

  let {
    store,
    session = null,
    stream = null,
    audio = null,
    requiredOrientation = null,
    clipStore = null,
    onfocuschange = null,
    tuning = DEFAULT_LIVE_TUNING,
    debug = false,
    needsStart = false,
    onstart = () => {},
  }: {
    store: LivePracticeStore;
    session?: LiveAnalysisSession | null;
    stream?: MediaStream | null;
    /** For spoken positioning cues (null in replay/e2e). */
    audio?: AudioFeedbackService | null;
    /** Required side-on orientation; enables the in-loop positioning gate. */
    requiredOrientation?: SideOrientation | null;
    /** Where per-shot clips are stored (null disables recording). */
    clipStore?: ShotClipStore | null;
    /** Persist a focus change made from the in-loop picker. */
    onfocuschange?: ((ids: string[]) => void) | null;
    /** Cue pacing + readiness thresholds (static/config/live-tuning.json). */
    tuning?: LiveTuning;
    /** Show the readiness/cue debug panel (dev/E2E only). */
    debug?: boolean;
    /** Show the one-time "Tap to start" overlay (audio unlock). */
    needsStart?: boolean;
    onstart?: () => void;
  } = $props();

  let focusOpen = $state(false);

  function changeFocus(ids: string[]) {
    store.setFocusAreas(ids);
    onfocuschange?.(ids);
  }

  /** The in-loop positioning gate is active only with a real camera. */
  const gateActive = $derived(!!stream && !!requiredOrientation);

  let drawerOpen = $state(false);
  let breakdownOpen = $state(false);
  let videoEl = $state<HTMLVideoElement | null>(null);
  let overlayEl = $state<HTMLCanvasElement | null>(null);
  let frameCapture: FrameCaptureHandle | null = null;

  let presence = $state<PresenceState>("none");
  let latestFrame = $state<LandmarkFrame | null>(null);

  // In-loop positioning gate state (only meaningful when gateActive).
  let positioned = $state(false);
  let cue = $state<ReadinessCue>("full-body");
  let readiness = $state<ReadinessState | null>(null);
  let pacerSnap = $state<PacerSnapshot | null>(null);
  // Wall-clock pacing: what matters is how long the PLAYER has had to react.
  // (Re)created with the gate, from the tuning in effect for this session.
  let pacer: CuePacer | null = null;

  // Per-shot clip recording.
  let recorder = $state.raw<ShotClipRecorder | null>(null);
  // Shots already in the store at mount (today's history) have no clip to take.
  let savedShots = untrack(() => store.shots.length);
  /** Pre-roll kept before the rep start (matches the coordinator's window). */
  const CLIP_PRE_ROLL_MS = 1500;

  $effect(() => {
    if (!session) return;
    const tracker = createPresenceTracker();
    const gate = gateActive
      ? createReadinessGate({
          requiredOrientation: requiredOrientation!,
          tuning: tuning.readiness,
        })
      : null;
    pacer = gate ? createCuePacer(tuning.cues) : null;
    const unsubscribe = session.onFrame((frame) => {
      presence = tracker.update(frame);
      latestFrame = frame;
      if (gate) handleReadiness(gate.update(frame));
    });
    const decay = setInterval(() => (presence = tracker.evaluate()), 400);
    return () => {
      unsubscribe();
      clearInterval(decay);
    };
  });

  /**
   * Spoken + visual positioning coaching, only between shots. The visual
   * banner follows the gate live; speech is paced (hold → cooldown → repeat
   * limit) so the player has time to move before hearing the next cue.
   */
  function handleReadiness(s: ReadinessState): void {
    positioned = s.positioned;
    cue = s.cue;
    if (debug) readiness = s;
    // Only coach between shots (never over the shot announcements).
    const coachable =
      store.running &&
      store.cycle === "tracking" &&
      store.phase !== "analyzing" &&
      store.phase !== "paused" &&
      !store.muted;
    const out = pacer?.update(s.cue, coachable) ?? null;
    if (out?.kind === "ready") {
      // Tone first, then the words (sequenced, never overlapping).
      void audio?.playEarcon("ready").then(() => audio?.speak(READY_TEXT));
    } else if (out?.kind === "cue") {
      void audio?.speak(CUE_TEXT[out.cue as keyof typeof CUE_TEXT]);
    }
    if (debug && pacer) pacerSnap = pacer.snapshot();
  }

  // Shot detection only starts while positioned (no gate → always armed).
  $effect(() => {
    store.setArmed(gateActive ? positioned : true);
  });

  // Keep a clip rolling while the player is positioned and between shots, so a
  // detected shot is captured. Positioning flickers as the shooting motion
  // starts, so only discard after the player has really left (segments are
  // capped at 10 s, so rolling a little longer costs nothing).
  const CLIP_DISCARD_AFTER_MS = 3000;
  let discardTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (!clipStore || !recorder || !gateActive) return;
    const idle =
      store.running &&
      store.phase !== "analyzing" &&
      store.cycle === "tracking";
    if (positioned) {
      if (discardTimer) clearTimeout(discardTimer);
      discardTimer = null;
      if (idle && !recorder.recording) recorder.start();
    } else if (idle && recorder.recording && !discardTimer) {
      const r = recorder;
      discardTimer = setTimeout(() => {
        discardTimer = null;
        if (!positioned && store.cycle === "tracking") r.discard();
      }, CLIP_DISCARD_AFTER_MS);
    }
  });

  // When a new shot is persisted, take the rolling clip and store it by shotId.
  $effect(() => {
    const n = store.shots.length;
    if (n > savedShots) {
      const entry = store.shots[n - 1];
      savedShots = n;
      if (entry) void saveClip(entry);
    }
  });

  /**
   * Keeps the segment covering this shot (from its pre-roll) and stores it
   * with its start on the pose-frame clock, so review seeks frame-exactly.
   */
  async function saveClip(entry: (typeof store.shots)[number]): Promise<void> {
    if (!clipStore || !recorder || !recorder.recording) return;
    const cap = entry.capture;
    const fromWall = cap
      ? cap.repStartTs + cap.frameToWall - CLIP_PRE_ROLL_MS
      : Number.NEGATIVE_INFINITY;
    const take = await recorder.takeCovering(fromWall);
    // Roll again straight away (during the feedback), so a quick next shot
    // still has its lead-in on video. Positioning often flickers through the
    // shot itself, so don't wait for it; the discard timer handles leaving.
    if (gateActive && store.running) recorder.start();
    if (!take) return;
    try {
      await clipStore.save(entry.shotId, {
        blob: take.blob,
        mime: take.mime,
        startFrameTs: cap ? take.startTs - cap.frameToWall : null,
      });
    } catch {
      /* local storage best-effort */
    }
  }

  const badgeText = $derived(
    presence === "full"
      ? "Player fully in frame"
      : presence === "partial"
        ? "Player partially in frame"
        : "No player detected",
  );

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
    if (!ctx) return;
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
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.onloadedmetadata = () => {
        if (session && videoEl && !frameCapture) {
          frameCapture = createLiveFrameCapture(videoEl, session);
        }
      };
      // Cap 0 ("keep video for 0 shots") = don't record at all.
      if (clipStore && clipStore.cap > 0 && !recorder) {
        recorder = createShotClipRecorder(stream);
      }
    }
    return () => {
      frameCapture?.stop();
      if (discardTimer) clearTimeout(discardTimer);
      recorder?.discard();
    };
  });

  const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(1));

  /**
   * One glanceable line mirroring what the player hears — for a spotter
   * watching the screen with the sound off.
   */
  const status = $derived.by(
    (): {
      state:
        | "paused"
        | "captured"
        | "analyzing"
        | "readback"
        | "ready"
        | "notready";
      text: string;
    } => {
      if (store.phase === "paused") return { state: "paused", text: "Paused" };
      if (store.cycle === "captured")
        return { state: "captured", text: "Shot captured" };
      if (store.cycle === "analyzing" || store.phase === "analyzing")
        return { state: "analyzing", text: "Analyzing…" };
      if (store.cycle === "readback")
        return {
          state: "readback",
          text: `Shot ${store.feedback?.index ?? ""} · ${fmt(store.feedback?.overall ?? null)}`,
        };
      if (gateActive && !positioned)
        return { state: "notready", text: "Get in position" };
      return { state: "ready", text: "Ready — take your shot" };
    },
  );
</script>

<main class="loop" data-testid="practice-loop">
  <div
    class="preview"
    class:full={!gateActive && presence === "full"}
    class:partial={!gateActive && presence === "partial"}
    class:ready={gateActive && positioned}
    class:notready={gateActive && !positioned}
    data-testid="pose-indicator"
    data-state={gateActive ? (positioned ? "ready" : "notready") : presence}
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
    {#if gateActive}
      <div
        class="readiness"
        class:ok={positioned}
        data-testid="readiness"
        data-positioned={positioned}
      >
        {#if positioned}
          <span class="r-text" data-testid="readiness-ready">✓ In position</span
          >
        {:else}
          <span class="r-text" data-testid="readiness-cue"
            >{cue ? CUE_TEXT[cue] : "Getting ready…"}</span
          >
        {/if}
      </div>
      {#if debug && readiness}
        <dl class="ready-debug" data-testid="readiness-debug">
          <dt>body</dt>
          <dd data-testid="rd-body">{readiness.fullBodyOk ? "ok" : "no"}</dd>
          <dt>side</dt>
          <dd data-testid="rd-side">
            {readiness.detected} ({Math.round(readiness.agreement * 100)}% req)
          </dd>
          <dt>cue</dt>
          <dd data-testid="rd-cue">{readiness.cue ?? "ready"}</dd>
          {#if pacerSnap}
            <dt>held</dt>
            <dd>{(pacerSnap.heldMs / 1000).toFixed(1)}s</dd>
            <dt>cooldown</dt>
            <dd>{(pacerSnap.cooldownLeftMs / 1000).toFixed(1)}s</dd>
            <dt>last said</dt>
            <dd>{pacerSnap.lastSpoken ?? "–"}</dd>
          {/if}
        </dl>
      {/if}
    {:else}
      <div class="pose-badge">
        <span class="indicator-dot"></span>{badgeText}
      </div>
    {/if}
    <div class="hud-top">
      <button
        class="chip-btn focus-chip"
        data-testid="focus-chip"
        aria-label="Change focus"
        onclick={() => (focusOpen = true)}
      >
        🎯 <span class="focus-text">{focusSummary(store.focusAreas)}</span>
      </button>
      <div class="controls">
        <button
          class="ctl"
          data-testid="practice-mute"
          aria-pressed={store.muted}
          aria-label={store.muted ? "Unmute" : "Mute"}
          onclick={() => store.toggleMute()}
        >
          {store.muted ? "🔇" : "🔊"}
        </button>
        {#if store.phase === "paused"}
          <button
            class="ctl"
            data-testid="practice-resume"
            aria-label="Resume"
            onclick={() => store.resume()}>▶</button
          >
        {:else}
          <button
            class="ctl"
            data-testid="practice-pause"
            aria-label="Pause"
            disabled={!store.running}
            onclick={() => store.pause()}>⏸</button
          >
        {/if}
      </div>
    </div>
    {#if needsStart}
      <div class="start-overlay">
        <button
          class="start-btn"
          data-testid="practice-start"
          onclick={onstart}
        >
          Tap to start
        </button>
        <p class="start-hint">
          Turns on voice feedback. Stand side-on, shooting arm toward the
          camera.
        </p>
      </div>
    {/if}
  </div>

  <section class="stage">
    <div
      class="status"
      data-testid="status-strip"
      data-state={status.state}
      role="status"
      aria-live="polite"
    >
      {#if status.state === "analyzing"}<span class="pulse"></span>{/if}
      {status.text}
    </div>
    {#if store.wrongAngleFlash}
      <p class="flash" data-testid="practice-wrong-angle">
        Wrong angle — shot not counted
      </p>
    {:else if store.noShotFlash}
      <p class="flash" data-testid="practice-no-shot">
        No shot detected — keep going
      </p>
    {/if}
    {#if store.feedback}
      {@const fb = store.feedback}
      <div class="feedback" data-testid="rep-feedback">
        <p class="score sc-numeral" data-testid="rep-feedback-score">
          {fmt(fb.overall)}
        </p>
        <div class="fb-body">
          {#if fb.worst.length > 0}
            <div class="chips">
              {#each fb.worst as m (m.id)}
                <span class="chip" data-testid="feedback-item"
                  ><b class="chip-phase">{phaseName(m.phase)}</b>
                  {phraseFor(m)}</span
                >
              {/each}
            </div>
          {:else}
            <p class="on-target">On target</p>
          {/if}
          <div class="feedback-actions">
            <button
              class="link"
              data-testid="toggle-breakdown"
              onclick={() => (breakdownOpen = true)}
            >
              Full breakdown
            </button>
            <button
              class="link"
              data-testid="rep-not-a-shot"
              onclick={() => void store.excludeShot(fb.index)}
            >
              Not a shot?
            </button>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <footer>
    <span class="rep-counter sc-numeral" data-testid="rep-counter">
      Shot {store.shotCount + 1}
    </span>
    <button
      class="drawer-toggle"
      data-testid="rep-drawer-toggle"
      onclick={() => (drawerOpen = true)}
    >
      Today ▴
    </button>
    <span class="avg" data-testid="session-average">
      avg <strong class="sc-numeral">{fmt(store.average)}</strong>
    </span>
  </footer>

  <Sheet bind:open={drawerOpen} title="Today's shots">
    <section class="drawer" data-testid="rep-drawer">
      {#if store.shots.length === 0}
        <p class="dim">No shots yet today.</p>
      {:else}
        <ul>
          {#each [...store.shots].reverse() as shot (shot.index)}
            <li
              class:excluded={shot.excluded}
              data-testid="rep-row-{shot.index}"
            >
              <span>Shot {shot.index}</span>
              <span class="sc-numeral">{fmt(shot.overall)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </Sheet>

  <Sheet bind:open={breakdownOpen} title="Full breakdown">
    {#if store.feedback}
      {@const entry = store.shots.find(
        (s) => s.index === store.feedback?.index,
      )}
      {#if entry}
        <div class="breakdown" data-testid="rep-breakdown">
          <ScoreCard card={entry.scorecard} />
        </div>
      {/if}
    {/if}
  </Sheet>

  <FocusSheet
    bind:open={focusOpen}
    selected={store.focusAreas}
    onchange={changeFocus}
  />
</main>

<style>
  /*
   * Lives inside the tab layout: fills the viewport above the tab bar. The
   * camera preview takes the remaining height so the status strip and the
   * feedback card are always on screen (no scrolling mid-practice).
   */
  .loop {
    height: calc(100dvh - 84px - env(safe-area-inset-bottom));
    max-width: 560px;
    margin: 0 auto;
    padding: 10px 12px 6px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .preview {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--sc-radius);
    border: 3px solid var(--sc-fail);
    background: #000;
    overflow: hidden;
  }
  .preview.partial {
    border-color: var(--sc-warn);
  }
  .preview.full,
  .preview.ready {
    border-color: var(--sc-success);
  }
  .preview.notready {
    border-color: var(--sc-fail);
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

  /* Overlaid controls (focus left, mute/pause right). */
  .hud-top {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    pointer-events: none;
  }
  .hud-top > * {
    pointer-events: auto;
  }
  .chip-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 60%;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgb(255 255 255 / 25%);
    background: rgb(0 0 0 / 60%);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .focus-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .controls {
    display: flex;
    gap: 6px;
  }
  .ctl {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid rgb(255 255 255 / 25%);
    background: rgb(0 0 0 / 60%);
    color: #fff;
    font-size: 15px;
    cursor: pointer;
  }
  .ctl:disabled {
    opacity: 0.4;
  }

  /* Positioning pill: under the overlaid controls. */
  .readiness {
    position: absolute;
    top: 54px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 90%;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgb(0 0 0 / 68%);
    border: 1px solid var(--sc-fail);
    color: #fff;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
  }
  .readiness.ok {
    border-color: var(--sc-success);
    color: #bbf7d0;
  }
  .r-text {
    white-space: normal;
  }
  .ready-debug {
    position: absolute;
    left: 8px;
    bottom: 8px;
    margin: 0;
    padding: 6px 8px;
    display: grid;
    grid-template-columns: auto auto;
    gap: 0 8px;
    border-radius: 6px;
    background: rgb(0 0 0 / 70%);
    color: #e5e7eb;
    font:
      11px/1.4 ui-monospace,
      monospace;
  }
  .ready-debug dt {
    color: #9ca3af;
  }
  .ready-debug dd {
    margin: 0;
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
  }
  .preview.partial .indicator-dot {
    background: var(--sc-warn);
  }
  .preview.full .indicator-dot {
    background: var(--sc-success);
  }

  /* One-time "Tap to start" (audio unlock). */
  .start-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    background: rgb(0 0 0 / 55%);
    text-align: center;
  }
  .start-btn {
    padding: 18px 36px;
    border: none;
    border-radius: 999px;
    background: var(--sc-primary);
    color: #0b1220;
    font-size: 22px;
    font-weight: 800;
    cursor: pointer;
  }
  .start-hint {
    margin: 0;
    max-width: 280px;
    color: #e5e7eb;
    font-size: 14px;
  }

  .stage {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sc-space-3);
    padding: 10px 14px;
    border-radius: var(--sc-radius);
    font-size: 22px;
    font-weight: 800;
    color: #0b1220;
    background: var(--sc-success);
    /* Instant color: state changes must read at a glance. */
  }
  .status[data-state="notready"],
  .status[data-state="paused"] {
    background: var(--sc-card-raised);
    color: var(--sc-text-dim);
  }
  .status[data-state="captured"] {
    background: #60a5fa;
  }
  .status[data-state="analyzing"] {
    background: #fbbf24;
  }
  .status[data-state="readback"] {
    background: #c4b5fd;
  }
  .pulse {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0b1220;
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
  .flash {
    margin: 0;
    text-align: center;
    color: var(--sc-warn);
    font-weight: 600;
  }
  .feedback {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
  }
  .score {
    margin: 0;
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
  }
  .fb-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .chip {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-border);
    font-size: 12px;
    font-weight: 600;
  }
  .chip-phase {
    color: var(--sc-primary);
    margin-right: 4px;
  }
  .on-target {
    margin: 0;
    font-weight: 700;
    color: var(--sc-success);
  }
  .feedback-actions {
    display: flex;
    gap: var(--sc-space-3);
  }
  .link {
    padding: 0;
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
    font-size: 14px;
  }
  .rep-counter {
    font-weight: 700;
  }
  .drawer-toggle {
    background: none;
    border: none;
    color: var(--sc-text-dim);
    cursor: pointer;
    font-size: 13px;
  }
  .avg {
    color: var(--sc-text-dim);
  }
  .avg strong {
    color: var(--sc-text);
  }
  .dim {
    color: var(--sc-text-dim);
  }
  .drawer ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
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
  .breakdown {
    text-align: left;
  }
</style>
