<script lang="ts">
  import { onMount } from "svelte";
  import type {
    LandmarkFrame,
    LiveAnalysisSession,
  } from "$lib/features/analysis";
  import type { AudioFeedbackService } from "$lib/shared/audio";
  import type {
    CaptureHandle,
    CaptureService,
  } from "$lib/shared/media/capture";
  import { downsampleToImageData } from "$lib/shared/media/downsample";
  import {
    createLiveFrameCapture,
    type FrameCaptureHandle,
  } from "$lib/shared/media/frame-capture";
  import { Button } from "$lib/shared/ui";
  import {
    CHECK_DEFAULTS,
    createSustainedCheck,
    isFullBodyVisible,
    isLightingOk,
    isSideView,
    isStable,
  } from "./checks";

  let {
    session,
    capture = null,
    audio,
    focusLabel = null,
    onstart,
    onexit,
    onerror,
  }: {
    /** Pose source — replay-driven in e2e, worker-backed in production. */
    session: LiveAnalysisSession;
    capture?: CaptureService | null;
    audio: AudioFeedbackService;
    focusLabel?: string | null;
    /** Fired when the countdown finishes: the practice loop takes over. */
    onstart: () => void;
    onexit: () => void;
    /** Fired when the analysis session fails to start. */
    onerror?: (message: string) => void;
  } = $props();

  type CheckId = "full-body" | "side-view" | "lighting" | "stability";
  const CHECKS: { id: CheckId; label: string }[] = [
    { id: "full-body", label: "Full body visible" },
    { id: "side-view", label: "Side view" },
    { id: "lighting", label: "Good lighting" },
    { id: "stability", label: "Phone stable" },
  ];

  let pass = $state<Record<CheckId, boolean>>({
    "full-body": false,
    "side-view": false,
    lighting: false, // auto-passes in onMount when there's no camera
    stability: true, // re-evaluated only when devicemotion delivers samples
  });
  let overridden = $state<Record<CheckId, boolean>>({
    "full-body": false,
    "side-view": false,
    lighting: false,
    stability: false,
  });
  let countdown = $state<number | null>(null);
  let cameraNote = $state<string | null>(null);

  const allGreen = $derived(
    CHECKS.every((c) => pass[c.id] || overridden[c.id]),
  );

  let video = $state<HTMLVideoElement | null>(null);
  let handle: CaptureHandle | null = null;
  let frameCapture: FrameCaptureHandle | null = null;
  const fullBody = createSustainedCheck(CHECK_DEFAULTS.fullBodySustainMs);
  let recentFrames: LandmarkFrame[] = [];
  let accelSamples: number[] = [];
  let sessionReady = false;

  onMount(() => {
    // No camera pixels to judge (replay mode / no device) → auto-pass.
    if (!capture?.isAvailable()) pass.lighting = true;
    const unsubscribe = session.onFrame(handleFrame);
    session
      .start()
      .then(() => {
        sessionReady = true;
        maybeStartFrameCapture();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Analysis session failed to start:", msg);
        onerror?.(
          "Unable to start pose detection. Please refresh and try again.",
        );
      });
    void openCamera();

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      accelSamples.push(Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2));
      if (accelSamples.length > 60) accelSamples = accelSamples.slice(-60);
      pass.stability = isStable(accelSamples);
    };
    window.addEventListener("devicemotion", onMotion);

    const lumaTimer = setInterval(sampleLighting, 1000);

    return () => {
      unsubscribe();
      window.removeEventListener("devicemotion", onMotion);
      clearInterval(lumaTimer);
      frameCapture?.stop();
      handle?.stop();
    };
  });

  async function openCamera() {
    if (!capture?.isAvailable()) return;
    try {
      handle = await capture.start();
      if (video) {
        video.srcObject = handle.stream;
        // Wait for the video to start playing before attempting frame capture.
        video.onloadedmetadata = () => maybeStartFrameCapture();
      }
    } catch {
      cameraNote = "Camera unavailable — running pose-only setup.";
      pass.lighting = true;
    }
  }

  /**
   * Start frame capture once both the video element and session are ready.
   * This bridges the camera feed to the pose detection worker.
   */
  function maybeStartFrameCapture() {
    if (frameCapture) return; // Already started.
    if (!video || !sessionReady) return; // Not ready yet.
    if (video.videoWidth === 0) return; // Video not loaded yet.

    frameCapture = createLiveFrameCapture(video, session);
    if (frameCapture) {
      console.debug("[setup] Frame capture started");
    }
  }

  function handleFrame(frame: LandmarkFrame) {
    // Sticky once passed: the gate is a one-time readiness check, and a
    // momentary pose dropout must not yank Start away mid-click.
    pass["full-body"] ||= fullBody.update(
      isFullBodyVisible(frame),
      frame.timestamp,
    );
    recentFrames.push(frame);
    if (recentFrames.length > CHECK_DEFAULTS.sideViewWindow) {
      recentFrames = recentFrames.slice(-CHECK_DEFAULTS.sideViewWindow);
    }
    pass["side-view"] ||= isSideView(recentFrames);
  }

  function sampleLighting() {
    if (!video || !handle || video.videoWidth === 0) return;
    try {
      const data = downsampleToImageData(
        video,
        video.videoWidth,
        video.videoHeight,
        64,
      );
      pass.lighting = isLightingOk(data.data);
    } catch {
      // Canvas unsupported (jsdom) → leave the current verdict.
    }
  }

  async function engageDeviceLocks() {
    try {
      await navigator.wakeLock?.request("screen");
    } catch {
      /* best effort */
    }
    try {
      await (
        screen.orientation as unknown as {
          lock?: (o: string) => Promise<void>;
        }
      ).lock?.("portrait");
    } catch {
      /* best effort */
    }
  }

  function startCountdown() {
    if (!allGreen || countdown !== null) return;
    void engageDeviceLocks();
    countdown = 3;
    audio.beep("count");
    const tick = () => {
      setTimeout(() => {
        if (countdown === null) return;
        countdown -= 1;
        if (countdown <= 0) {
          audio.beep("go");
          countdown = null;
          onstart();
        } else {
          audio.beep("count");
          tick();
        }
      }, 1000);
    };
    tick();
  }
</script>

<main class="setup" data-testid="live-setup">
  <header>
    <Button variant="ghost" testid="setup-exit" onclick={onexit}>✕</Button>
    <h1>Get in position</h1>
    {#if focusLabel}
      <span class="focus" data-testid="setup-focus">Focus: {focusLabel}</span>
    {/if}
  </header>

  <div class="preview">
    <!-- Muted live preview, no audio track requested. -->
    <video
      bind:this={video}
      autoplay
      muted
      playsinline
      data-testid="setup-preview"
    ></video>
    <!-- Silhouette framing guide. -->
    <svg class="guide" viewBox="0 0 100 160" aria-hidden="true">
      <ellipse cx="50" cy="24" rx="10" ry="12" />
      <rect x="38" y="38" width="24" height="52" rx="10" />
      <rect x="41" y="92" width="7" height="58" rx="3.5" />
      <rect x="52" y="92" width="7" height="58" rx="3.5" />
    </svg>
    {#if countdown !== null}
      <div class="countdown" data-testid="setup-countdown">{countdown}</div>
    {/if}
  </div>

  {#if cameraNote}
    <p class="note" data-testid="setup-camera-note">{cameraNote}</p>
  {/if}

  <ul class="checks">
    {#each CHECKS as check (check.id)}
      {@const ok = pass[check.id] || overridden[check.id]}
      <li data-testid="check-{check.id}" data-state={ok ? "pass" : "pending"}>
        <span class="tick" class:ok>{ok ? "✓" : "○"}</span>
        <span class="label">{check.label}</span>
        {#if !pass[check.id]}
          <button
            class="override"
            data-testid="override-{check.id}"
            onclick={() => (overridden[check.id] = !overridden[check.id])}
          >
            {overridden[check.id] ? "undo" : "skip"}
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <Button
    size="lg"
    testid="setup-start"
    disabled={!allGreen || countdown !== null}
    onclick={startCountdown}
  >
    Start practice
  </Button>
</main>

<style>
  .setup {
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
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    flex: 1;
  }
  .focus {
    color: var(--sc-primary);
    font-size: 13px;
    font-weight: 600;
  }
  .preview {
    position: relative;
    aspect-ratio: 3 / 4;
    border-radius: var(--sc-radius);
    border: 1px solid var(--sc-border);
    background: #000;
    overflow: hidden;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .guide {
    position: absolute;
    inset: 10% 25%;
    width: 50%;
    height: 80%;
    fill: none;
    stroke: rgb(255 122 41 / 55%);
    stroke-width: 2;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }
  .countdown {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    font-size: 96px;
    font-weight: 800;
    color: var(--sc-primary);
    background: rgb(0 0 0 / 45%);
  }
  .note {
    margin: 0;
    color: var(--sc-text-dim);
    font-size: 13px;
  }
  .checks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .checks li {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
    padding: 10px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
  }
  .tick {
    color: var(--sc-text-dim);
    font-weight: 700;
  }
  .tick.ok {
    color: var(--sc-success);
  }
  .label {
    flex: 1;
    font-size: 14px;
  }
  .override {
    background: none;
    border: none;
    color: var(--sc-text-dim);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
  }
</style>
