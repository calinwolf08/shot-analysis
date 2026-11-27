<script lang="ts">
  /**
   * Practice tab = the live loop (SwingCoach-style): opening the tab opens
   * the camera and pose tracking straight away. A one-time "Tap to start"
   * unlocks audio (mobile browsers need a gesture) and starts shot detection.
   * Leaving the tab (e.g. to Shots) unmounts this page, which stops the camera
   * and tracking; coming back reopens them without asking again.
   */
  import { onDestroy } from "svelte";
  import {
    createLiveCapture,
    type LiveCapture,
    type LiveCaptureFile,
  } from "$lib/features/live-practice/debug/live-capture";
  import LiveCapturePanel from "$lib/features/live-practice/debug/LiveCapturePanel.svelte";
  import { deviceDebugEnabled } from "$lib/shared/debug/debug-mode";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { LiveAnalysisSession } from "$lib/features/analysis";
  import {
    createLiveRepCoordinator,
    DEFAULT_LIVE_REP_CONFIG,
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
  import type { KeyframeTargets } from "basketball-shot-analysis";
  import {
    loadEnabledChecks,
    loadKeyframeTargets,
    saveEnabledChecks,
  } from "$lib/features/scoring/keyframes";
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
  import {
    createFullRateRefiner,
    keyframeSpan,
    keyframeRelease,
    type FullRateRefiner,
  } from "$lib/features/live-practice/refine/full-rate";
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

  // Debug mode (`?debug=on`, remembered across pages; production too): record
  // the last ~20 s of poses and the loop's decisions, exportable for
  // diagnosis (live-capture.ts).
  const liveCapture = deviceDebugEnabled(page.url) ? createLiveCapture() : null;

  const liveDebug =
    import.meta.env.VITE_LIVE_DEBUG === "1" ||
    ((import.meta.env.DEV || import.meta.env.VITE_E2E === "1") &&
      page.url.searchParams.get("debug") === "live");

  let phase = $state<"loading" | "running" | "error">("loading");
  let session = $state<LiveAnalysisSession | null>(null);
  let store = $state<LivePracticeStore | null>(null);
  let coordinator = $state<LiveRepCoordinator | null>(null);
  /** Re-detects each rep at full frame rate from its clip (null: replay). */
  let refiner = $state.raw<FullRateRefiner | null>(null);
  let cameraStream = $state<MediaStream | null>(null);
  let errorMessage = $state<string | null>(null);
  let shootingHand: "left" | "right" = "right";
  let requiredSide = $state<SideOrientation>("side-left");
  let playerId = "";
  let targets: KeyframeTargets | null = null;
  /** Feedback filter (enabled check ids; null = every check). */
  let enabled: ReadonlySet<string> | null = null;
  let captureHandle: CaptureHandle | null = null;
  let tuning = $state<LiveTuning>(DEFAULT_LIVE_TUNING);
  /** Shot detection + audio started (after the one-time tap). */
  let started = $state(audioUnlockState.unlocked);
  /** Set on unmount: an in-flight boot must not open the camera afterwards. */
  let destroyed = false;
  let wakeLock: { release(): Promise<void> } | null = null;
  let initialShots: ShotEntry[] = [];

  /** The Feedback sheet's selection, shared with shot review. */
  function persistFeedback(next: ReadonlySet<string>) {
    enabled = next;
    void saveEnabledChecks(services.repos.settings, next);
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
    [targets, enabled] = await Promise.all([
      loadKeyframeTargets(),
      loadEnabledChecks(services.repos.settings),
    ]);
    const loaded = await loadLiveTuning();
    tuning = loaded.tuning;
    for (const w of loaded.warnings) console.warn("[live-tuning]", w);
    // Profile → "Voice feedback" off = practice starts muted (the speaker
    // button still unmutes for this session).
    audio.setMuted(!(await services.repos.settings.get("voiceFeedback")));
    initialShots = await loadTodaysShots(player.id, targets, enabled);
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
        // Dev/E2E A/B: `?delegate=cpu|gpu`, `?offlineModel=lite`.
        ...(devSurfaces && page.url.searchParams.get("delegate")
          ? {
              delegate:
                page.url.searchParams.get("delegate")!.toLowerCase() === "cpu"
                  ? ("CPU" as const)
                  : ("GPU" as const),
            }
          : {}),
        ...(devSurfaces && page.url.searchParams.get("offlineModel") === "lite"
          ? { offlineModel: "lite" as const }
          : {}),
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
    // Every shot is scored from the rep re-detected at FULL frame rate from
    // its clip (live tracking may only manage ~10 fps); needs a worker
    // session (not replay) and clip recording.
    refiner =
      session.detectOffline && clipStore.cap > 0
        ? createFullRateRefiner({
            session,
            // Dev/E2E: `?refineFrom=video` re-detects from the recording, not
            // the frame cache (A/B).
            ...(devSurfaces &&
            page.url.searchParams.get("refineFrom") === "video"
              ? { source: "video" as const }
              : {}),
            // Dev/E2E: `?noSeek=1` decodes as before (no seek, 4× fast-forward).
            ...(devSurfaces && page.url.searchParams.has("noSeek")
              ? { decodeOptions: { seek: false, fastForwardRate: 4 } }
              : {}),
            // Re-detect only the scored part of the rep (Setup → Release).
            // Dev/E2E: `?fullRefine=1` re-detects the whole window (A/B).
            span:
              devSurfaces && page.url.searchParams.has("fullRefine")
                ? () => null
                : keyframeSpan({
                    shootingHand,
                    aspect: () => {
                      const f = session?.frameSize?.();
                      return f && f.height > 0 ? f.width / f.height : null;
                    },
                  }),
          })
        : null;
    const activeRefiner = refiner;
    coordinator = createLiveRepCoordinator(
      {
        analyze: (frames) => session!.analyzeWindow(frames),
        ...(activeRefiner
          ? {
              refine: async (w) => {
                // Timeline marks for the latency benchmark.
                performance.mark("sc:refine-start");
                try {
                  return await activeRefiner.refine(w);
                } finally {
                  performance.mark("sc:refine-end");
                }
              },
            }
          : {}),
        // End the rep just after the release, not once the wrist settles.
        // Dev/E2E: `?settleEnd=1` waits for the wrist to settle (A/B).
        ...(devSurfaces && page.url.searchParams.has("settleEnd")
          ? {}
          : {
              releaseAt: keyframeRelease({
                shootingHand,
                aspect: () => {
                  const f = session?.frameSize?.();
                  return f && f.height > 0 ? f.width / f.height : null;
                },
              }),
            }),
      },
      { shootingHand },
    );
    if (liveCapture && activeRefiner)
      activeRefiner.onReport((r) => liveCapture.event("refine", r));
    const activeCoordinator = coordinator;
    // Timeline mark for the latency benchmark (the shot's start).
    activeCoordinator.on("repStarted", ({ timestamp }) => {
      performance.mark("sc:rep-start");
      // Start re-detecting the rep's cached frames at full rate now, while
      // the shot is still going (frame-cache mode).
      activeRefiner?.begin?.(
        timestamp,
        timestamp - DEFAULT_LIVE_REP_CONFIG.preRollMs,
      );
    });
    session.onFrame((frame) => activeCoordinator.pushFrame(frame));
    if (liveCapture) recordLoop(liveCapture, activeCoordinator, session);

    const shotStore = createRepoShotStore(services.repos.shot);
    const realPipeline = createLiveShotPipeline({
      targets,
      store: shotStore,
      api: createApiClient(),
    });
    // Dev/E2E only: `?analysisDelayMs=` makes each shot's analysis slow (a
    // slow phone), so clip coverage can be tested. Constant-folds away in
    // production.
    const analysisDelay = devSurfaces
      ? Number(page.url.searchParams.get("analysisDelayMs") ?? 0) || 0
      : 0;
    const timedPipeline =
      analysisDelay > 0
        ? {
            ...realPipeline,
            async process(
              input: Parameters<typeof realPipeline.process>[0],
            ): ReturnType<typeof realPipeline.process> {
              await new Promise((r) => setTimeout(r, analysisDelay));
              return realPipeline.process(input);
            },
          }
        : realPipeline;
    const pipeline = liveCapture
      ? {
          ...timedPipeline,
          async process(
            input: Parameters<typeof timedPipeline.process>[0],
          ): ReturnType<typeof timedPipeline.process> {
            performance.mark("sc:pipeline-start");
            liveCapture.event("pipeline.start", {
              frames: input.poseData.frames.length,
              focusIndex: input.focusIndex,
              size: [input.poseData.width, input.poseData.height],
            });
            try {
              const r = await timedPipeline.process(input);
              performance.mark("sc:pipeline-end");
              liveCapture.event("pipeline.result", {
                shots: r.shots.map((x) => ({
                  overall: x.scorecard.overall,
                  frames: [
                    x.shot.analysis.frameRange.start,
                    x.shot.analysis.frameRange.end,
                  ],
                  orientation: x.shot.analysis.orientation,
                })),
                rejected: r.rejected,
              });
              return r;
            } catch (e) {
              liveCapture.event("pipeline.error", {
                message: e instanceof Error ? e.message : String(e),
              });
              throw e;
            }
          },
        }
      : timedPipeline;
    store = new LivePracticeStore({
      coordinator,
      pipeline,
      shotStore,
      audio,
      playerId,
      opts: { shootingHand, profile: "pro-form" },
      fps: session.fps,
      targets,
      enabled,
      frameSize: () => session?.frameSize?.() ?? null,
      initialShots,
    });
    // Already unlocked this page-load (came back from another tab): go.
    if (started) store.start();
    phase = "running";
  }

  /** Feeds the flight recorder: frames, coordinator decisions, velocity. */
  function recordLoop(
    cap: LiveCapture,
    c: LiveRepCoordinator,
    s: LiveAnalysisSession,
  ): void {
    s.onFrame((f) =>
      cap.frame(
        f,
        f.captureTs !== undefined ? performance.now() - f.captureTs : undefined,
      ),
    );
    c.on("stateChanged", (e) => cap.event("state", e));
    c.on("repStarted", (e) => cap.event("rep.started", e));
    c.on("repAnalyzing", (e) => cap.event("rep.analyzing", e));
    c.on("repRefining", (e) => cap.event("rep.refining", e));
    c.on("repResult", (e) => {
      if (e.window.fullRate) cap.refined(e.window.startedAt, e.window.frames);
    });
    c.on("noShot", (e) => {
      if (e.window.fullRate) cap.refined(e.window.startedAt, e.window.frames);
    });
    c.on("repResult", (e) =>
      cap.event("rep.result", {
        shots: e.analysis.shots.length,
        frames: e.window.frames.length,
        fullRate: e.window.fullRate ?? false,
        window: [e.window.frames[0]?.timestamp, e.window.endedAt],
        trigger: e.window.trigger,
      }),
    );
    c.on("noShot", (e) =>
      cap.event("rep.noShot", {
        reason: e.reason,
        frames: e.window.frames.length,
        fullRate: e.window.fullRate ?? false,
        window: [e.window.frames[0]?.timestamp, e.window.endedAt],
        trigger: e.window.trigger,
      }),
    );
    c.on("nearTrigger", (e) => cap.event("rep.nearTrigger", e));
    c.on("debug", (d) =>
      cap.sample({
        t: d.timestamp,
        state: d.state,
        posePresent: d.posePresent,
        velocity: d.smoothedVelocity,
        riseVelocity: d.riseVelocity,
        settleVelocity: d.settleVelocity,
        settledForMs: d.settledForMs,
      }),
    );
    cap.setMeta({
      userAgent: navigator.userAgent,
      shootingHand,
      requiredOrientation: requiredSide,
      fps: s.fps,
      tuning,
      screen: [window.innerWidth, window.innerHeight, window.devicePixelRatio],
    });
  }

  function exportCapture(): LiveCaptureFile {
    const cap = liveCapture!;
    const stats = session?.stats?.() ?? null;
    cap.setMeta({
      started,
      armed: coordinator?.armed ?? null,
      coordinatorState: coordinator?.state ?? null,
      storePhase: store?.phase ?? null,
      storeCycle: store?.cycle ?? null,
      shotsThisSession: store?.shots.length ?? 0,
      poseStats: stats,
      frameSize: session?.frameSize?.() ?? null,
    });
    return cap.export({
      fps: session?.fps ?? 30,
      frameSize: session?.frameSize?.() ?? null,
    });
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
    t: KeyframeTargets,
    on: ReadonlySet<string> | null,
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
        on,
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
    {refiner}
    stream={cameraStream}
    onfeedbackchange={persistFeedback}
    {tuning}
    debug={liveDebug}
    capture={liveCapture}
    needsStart={!started}
    onstart={handleStart}
  />
  {#if liveCapture}
    <LiveCapturePanel capture={liveCapture} exportFile={exportCapture} />
  {/if}
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
