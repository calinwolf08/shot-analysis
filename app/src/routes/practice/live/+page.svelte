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
    SetupScreen,
    type LiveRepCoordinator,
    type SideOrientation,
  } from "$lib/features/live-practice";
  import { loadLiveTargets, type LiveTargets } from "$lib/features/scoring";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { createApiClient } from "$lib/shared/api/client";
  import { createWebAudioFeedbackService } from "$lib/shared/audio";
  import {
    createBrowserCaptureService,
    type CaptureService,
    createFileCaptureService,
  } from "$lib/shared/media/capture";

  const services = useAppServices();
  const audio = createWebAudioFeedbackService();

  const replayMode =
    page.url.searchParams.get("e2e") === "replay" ||
    import.meta.env.VITE_ANALYSIS_BACKEND === "replay";

  // Dev/e2e only: `?liveVideo=<url>` plays a recorded clip as the "camera"
  // through the real pipeline (no webcam) so the full live flow can be driven
  // from a video file. Constant-folds away in production builds.
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

  let phase = $state<"loading" | "setup" | "running" | "error">("loading");
  let session = $state<LiveAnalysisSession | null>(null);
  let store = $state<LivePracticeStore | null>(null);
  let coordinator = $state<LiveRepCoordinator | null>(null);
  let cameraStream = $state<MediaStream | null>(null);
  let errorMessage = $state<string | null>(null);
  let shootingHand: "left" | "right" = "right";
  let requiredSide = $state<SideOrientation>("side-left");
  let playerId = "";
  let targets: LiveTargets | null = null;

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
    session = services.analysis.createLiveSession({
      shootingHand,
      profile: "pro-form",
    });
    phase = "setup";
  }

  async function beginLoop() {
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
    });
    store.start();
    phase = "running";
  }

  onDestroy(() => {
    store?.stop();
    void session?.stop();
    if (cameraStream) {
      for (const track of cameraStream.getTracks()) track.stop();
    }
  });

  function handleSetupError(message: string) {
    errorMessage = message;
    phase = "error";
  }

  function exit() {
    void goto(`/${page.url.search}`);
  }
</script>

{#if phase === "error"}
  <main class="error-screen">
    <h2>Something went wrong</h2>
    <p>{errorMessage}</p>
    <button onclick={exit}>Go back</button>
  </main>
{:else if phase === "setup" && session}
  <SetupScreen
    {session}
    {capture}
    {audio}
    requiredOrientation={requiredSide}
    onstart={() => void beginLoop()}
    onexit={exit}
    onerror={handleSetupError}
    onstream={(s) => (cameraStream = s)}
  />
{:else if phase === "running" && store}
  <PracticeScreen {store} {session} stream={cameraStream} onexit={exit} />
  {#if liveDebug && coordinator}
    <LiveDebugHud {coordinator} />
  {/if}
{/if}

<style>
  .error-screen {
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
  .error-screen h2 {
    margin: 0;
    font-size: 20px;
  }
  .error-screen p {
    color: var(--sc-text-dim);
    margin: 0;
  }
  .error-screen button {
    padding: 10px 24px;
    border-radius: var(--sc-radius);
    background: var(--sc-primary);
    color: #fff;
    border: none;
    font-weight: 600;
    cursor: pointer;
  }
</style>
