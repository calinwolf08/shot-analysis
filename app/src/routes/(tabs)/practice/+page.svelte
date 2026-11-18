<script lang="ts">
  /**
   * Practice tab = the live loop (SwingCoach-style): opening the tab opens
   * the camera and pose tracking straight away. A one-time "Tap to start"
   * unlocks audio (mobile browsers need a gesture) and starts shot detection.
   * Leaving the tab (e.g. to Shots) unmounts this page, which stops the camera
   * and tracking; coming back reopens them without asking again.
   */
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { LiveAnalysisSession } from "$lib/features/analysis";
  import {
    createLiveRepCoordinator,
    createLiveShotPipeline,
    createRepoShotStore,
    LiveDebugHud,
    LivePracticeStore,
    PracticeScreen,
    requiredOrientation,
    type ShotEntry,
    type LiveRepCoordinator,
    type SideOrientation,
  } from "$lib/features/live-practice";
  import {
    DEFAULT_LIVE_TUNING,
    loadLiveTuning,
    type LiveTuning,
  } from "$lib/features/live-practice/tuning";
  import {
    simulatedSpeechMs,
    withAudioProbe,
  } from "$lib/shared/audio/audio-probe";
  import type { LiveTargetsV3 } from "basketball-shot-analysis";
  import { normalizeAreas } from "$lib/features/scoring";
  import { loadLiveTargetsV3 } from "$lib/features/scoring/v3";
  import { scoreStoredShots } from "$lib/features/live-practice/review/scored-shots";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { createApiClient } from "$lib/shared/api/client";
  import { createWebAudioFeedbackService } from "$lib/shared/audio";
  import {
    createBrowserCaptureService,
    type CaptureHandle,
    type CaptureService,
    createFileCaptureService,
  } from "$lib/shared/media/capture";
  import { getShotClipStore } from "$lib/shared/media/shot-clip-store";
  import { getVideoRetention } from "$lib/shared/media/video-retention";
  import { audioUnlockState } from "$lib/shared/audio/unlock-state";

  const services = useAppServices();
  // Dev/E2E: mirror everything audible into window.__scAudioLog so specs can
  // assert what the player hears. Constant-folds away in production.
  const devSurfaces = import.meta.env.DEV || import.meta.env.VITE_E2E === "1";
  // E2E builds also simulate speech durations (headless has no voices).
  const audio = devSurfaces
    ? withAudioProbe(
        createWebAudioFeedbackService(),
        import.meta.env.VITE_E2E === "1"
          ? { simulateSpeech: simulatedSpeechMs }
          : {},
      )
    : createWebAudioFeedbackService();
  // Retention is applied once the setting loads (see boot).
  const clipStore = getShotClipStore();

  const replayMode =
    page.url.searchParams.get("e2e") === "replay" ||
    import.meta.env.VITE_ANALYSIS_BACKEND === "replay";

  // Dev/e2e only: `?liveVideo=<url>` plays a recorded clip as the "camera"
  // through the real pipeline (no webcam). Constant-folds away in production.
  const liveVideoUrl =
    import.meta.env.DEV || import.meta.env.VITE_E2E === "1"
      ? page.url.searchParams.get("liveVideo")
      : null;

  // Dev/e2e only: `?fakecam=1` opens a real getUserMedia stream (Chromium's
  // fake device in e2e) alongside the REPLAYED pose stream, so the camera-only
  // paths (positioning gate, clip recording) run deterministically.
  const fakeCam =
    replayMode && devSurfaces && page.url.searchParams.get("fakecam") === "1";

  const capture: CaptureService | null = replayMode
    ? fakeCam
      ? createBrowserCaptureService()
      : null
    : liveVideoUrl
      ? createFileCaptureService(liveVideoUrl)
      : createBrowserCaptureService();

  const liveDebug =
    import.meta.env.VITE_LIVE_DEBUG === "1" ||
    ((import.meta.env.DEV || import.meta.env.VITE_E2E === "1") &&
      page.url.searchParams.get("debug") === "live");

  let phase = $state<"loading" | "running" | "error">("loading");
  let session = $state<LiveAnalysisSession | null>(null);
  let store = $state<LivePracticeStore | null>(null);
  let coordinator = $state<LiveRepCoordinator | null>(null);
  let cameraStream = $state<MediaStream | null>(null);
  let errorMessage = $state<string | null>(null);
  let shootingHand: "left" | "right" = "right";
  let requiredSide = $state<SideOrientation>("side-left");
  let playerId = "";
  let targets: LiveTargetsV3 | null = null;
  let captureHandle: CaptureHandle | null = null;
  let focusAreas: string[] = [];
  let tuning = $state<LiveTuning>(DEFAULT_LIVE_TUNING);
  /** Shot detection + audio started (after the one-time tap). */
  let started = $state(audioUnlockState.unlocked);
  /** Set on unmount: an in-flight boot must not open the camera afterwards. */
  let destroyed = false;
  let wakeLock: { release(): Promise<void> } | null = null;
  let initialShots: ShotEntry[] = [];

  function persistFocus(ids: string[]) {
    focusAreas = ids;
    void services.repos.settings.set("liveFocusAreas", ids);
  }

  $effect(() => {
    void boot();
  });

  async function boot() {
    if (session) return;
    const player = await services.repos.player.getFirst();
    if (destroyed) return;
    if (!player) {
      await goto(`/${page.url.search}`);
      return;
    }
    playerId = player.id;
    shootingHand = player.shootingHand;
    requiredSide = requiredOrientation(shootingHand);
    targets = await loadLiveTargetsV3();
    const loaded = await loadLiveTuning();
    tuning = loaded.tuning;
    for (const w of loaded.warnings) console.warn("[live-tuning]", w);
    focusAreas = normalizeAreas(
      await services.repos.settings.get("liveFocusAreas"),
    );
    initialShots = await loadTodaysShots(player.id, targets);
    await clipStore.setCap(getVideoRetention()).catch(() => undefined);
    if (destroyed) return;

    // Dev/E2E only: `?detectDelayMs=` slows each detection in the worker to
    // imitate a slow phone. Constant-folds away in production.
    const detectDelay = devSurfaces
      ? Number(page.url.searchParams.get("detectDelayMs") ?? 0) || 0
      : 0;
    const s = services.analysis.createLiveSession(
      { shootingHand, profile: "pro-form" },
      {
        ...tuning.latency,
        ...(detectDelay > 0 ? { debugDetectDelayMs: detectDelay } : {}),
      },
    );
    session = s;
    try {
      await s.start();
      if (destroyed) return;
    } catch {
      handleError(
        "Unable to start pose detection. Please refresh and try again.",
      );
      return;
    }

    // Open the camera (real webcam, or a file in dev/e2e). Replay has none —
    // the loop still runs from the replayed pose stream.
    if (capture) {
      try {
        captureHandle = await capture.start();
        if (destroyed) {
          // Left the tab while the camera was opening: release it now.
          for (const t of captureHandle.stream.getTracks()) t.stop();
          return;
        }
        cameraStream = captureHandle.stream;
      } catch {
        cameraStream = null; // pose-only fallback
      }
    }
    void engageDeviceLocks();
    beginLoop();
  }

  function beginLoop() {
    if (!session || !targets) return;
    coordinator = createLiveRepCoordinator(
      { analyze: (frames) => session!.analyzeWindow(frames) },
      { shootingHand },
    );
    const activeCoordinator = coordinator;
    session.onFrame((frame) => activeCoordinator.pushFrame(frame));

    const shotStore = createRepoShotStore(services.repos.shot);
    const pipeline = createLiveShotPipeline({
      targets,
      store: shotStore,
      api: createApiClient(),
    });
    store = new LivePracticeStore({
      coordinator,
      pipeline,
      shotStore,
      audio,
      playerId,
      opts: { shootingHand, profile: "pro-form" },
      fps: session.fps,
      frameSize: () => session?.frameSize?.() ?? null,
      focusAreas,
      initialShots,
    });
    // Already unlocked this page-load (came back from another tab): go.
    if (started) store.start();
    phase = "running";
  }

  /** The one-time tap: unlock audio inside the gesture, start detecting. */
  function handleStart() {
    audio.unlock();
    audioUnlockState.markUnlocked();
    started = true;
    store?.start();
  }

  /**
   * Today's already-recorded shots, so the counter/average/drawer continue
   * across tab switches (Shots tab has the full history).
   */
  async function loadTodaysShots(
    id: string,
    t: LiveTargetsV3,
  ): Promise<ShotEntry[]> {
    // Local midnight (plain timestamp math; no reactive Date needed).
    const now = Date.now();
    const d = new Date(now);
    const startOfDay =
      now -
      ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 -
      d.getMilliseconds();
    try {
      const rows = await services.repos.shot.listByPlayer(id, {
        since: startOfDay,
      });
      const sorted = [...rows].sort((a, b) => a.createdAt - b.createdAt);
      const scored = await scoreStoredShots(
        services.repos.shot,
        sorted,
        shootingHand,
        t,
      );
      // Shots that can't be re-analyzed are left out of today's count.
      return scored
        .filter((x) => x.card !== null)
        .map(({ record, card }, i) => ({
          index: i + 1,
          shotId: record.id,
          overall: card!.overall,
          worst: card!.worst,
          scorecard: card!,
          excluded: record.excluded,
        }));
    } catch {
      return [];
    }
  }

  async function engageDeviceLocks() {
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
      if (destroyed) void wakeLock?.release();
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

  function handleError(message: string) {
    errorMessage = message;
    phase = "error";
  }

  onDestroy(() => {
    destroyed = true;
    store?.stop();
    void session?.stop();
    if (cameraStream) {
      for (const track of cameraStream.getTracks()) track.stop();
    }
    void wakeLock?.release().catch(() => undefined);
  });

  function retry() {
    location.reload();
  }
</script>

{#if phase === "error"}
  <section class="center">
    <h2>Something went wrong</h2>
    <p>{errorMessage}</p>
    <button onclick={retry}>Try again</button>
  </section>
{:else if phase === "running" && store}
  <PracticeScreen
    {store}
    {session}
    {audio}
    requiredOrientation={requiredSide}
    {clipStore}
    stream={cameraStream}
    onfocuschange={persistFocus}
    {tuning}
    debug={liveDebug}
    needsStart={!started}
    onstart={handleStart}
  />
  {#if liveDebug && coordinator}
    <LiveDebugHud {coordinator} {session} />
  {/if}
{:else}
  <section class="center" data-testid="practice-loading">
    <div class="spinner"></div>
    <p>Starting camera…</p>
  </section>
{/if}

<style>
  .center {
    min-height: calc(100dvh - 84px - env(safe-area-inset-bottom));
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sc-space-4);
    text-align: center;
  }
  .center h2 {
    margin: 0;
    font-size: 20px;
  }
  .center p {
    color: var(--sc-text-dim);
    margin: 0;
  }
  .center button {
    padding: 10px 24px;
    border-radius: var(--sc-radius);
    background: var(--sc-primary);
    color: #fff;
    border: none;
    font-weight: 600;
    cursor: pointer;
  }
  .spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid var(--sc-border);
    border-top-color: var(--sc-primary);
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
