<script lang="ts">
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
    type LiveRepCoordinator,
    type SideOrientation,
  } from "$lib/features/live-practice";
  import {
    loadLiveTargets,
    normalizeAreas,
    type LiveTargets,
  } from "$lib/features/scoring";
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

  const services = useAppServices();
  const audio = createWebAudioFeedbackService();
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

  const capture: CaptureService | null = replayMode
    ? null
    : liveVideoUrl
      ? createFileCaptureService(liveVideoUrl)
      : createBrowserCaptureService();
  const feedbackMs = replayMode ? 1500 : 4000;

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
  let targets: LiveTargets | null = null;
  let captureHandle: CaptureHandle | null = null;
  let focusAreas: string[] = [];

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
    if (!player) {
      await goto(`/${page.url.search}`);
      return;
    }
    playerId = player.id;
    shootingHand = player.shootingHand;
    requiredSide = requiredOrientation(shootingHand);
    targets = await loadLiveTargets();
    focusAreas = normalizeAreas(
      await services.repos.settings.get("liveFocusAreas"),
    );

    const s = services.analysis.createLiveSession({
      shootingHand,
      profile: "pro-form",
    });
    session = s;
    try {
      await s.start();
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
      feedbackMs,
      focusAreas,
    });
    store.start();
    phase = "running";
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

  function handleError(message: string) {
    errorMessage = message;
    phase = "error";
  }

  onDestroy(() => {
    store?.stop();
    void session?.stop();
    if (cameraStream) {
      for (const track of cameraStream.getTracks()) track.stop();
    }
  });

  function exit() {
    void goto(`/${page.url.search}`);
  }
</script>

{#if phase === "error"}
  <main class="center">
    <h2>Something went wrong</h2>
    <p>{errorMessage}</p>
    <button onclick={exit}>Go back</button>
  </main>
{:else if phase === "running" && store}
  <PracticeScreen
    {store}
    {session}
    {audio}
    requiredOrientation={requiredSide}
    {clipStore}
    stream={cameraStream}
    onfocuschange={persistFocus}
    onexit={exit}
  />
  {#if liveDebug && coordinator}
    <LiveDebugHud {coordinator} />
  {/if}
{:else}
  <main class="center" data-testid="practice-loading">
    <div class="spinner"></div>
    <p>Starting camera…</p>
  </main>
{/if}

<style>
  .center {
    min-height: 100dvh;
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
