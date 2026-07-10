<script lang="ts">
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { LiveAnalysisSession } from "$lib/features/analysis";
  import { builtInBenchmarks, type MetricName } from "$lib/features/benchmarks";
  import {
    createLiveRepCoordinator,
    LiveSessionStore,
    PracticeLoopScreen,
    SetupScreen,
  } from "$lib/features/live-practice";
  import { createPlanRepo } from "$lib/features/training-plan";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { createWebAudioFeedbackService } from "$lib/shared/audio";
  import {
    createBrowserCaptureService,
    type CaptureService,
  } from "$lib/shared/media/capture";

  const services = useAppServices();
  const audio = createWebAudioFeedbackService();

  // Replay mode (e2e / forced backend) has no camera to preview.
  const replayMode =
    page.url.searchParams.get("e2e") === "replay" ||
    import.meta.env.VITE_ANALYSIS_BACKEND === "replay";
  const capture: CaptureService | null = replayMode
    ? null
    : createBrowserCaptureService();
  // Wall-clock feedback dwell; short in e2e so multi-rep runs stay fast.
  const feedbackMs = replayMode ? 1500 : 4000;

  let phase = $state<"loading" | "setup" | "running">("loading");
  let session = $state<LiveAnalysisSession | null>(null);
  let focusMetric = $state<MetricName | null>(null);
  let focusLabel = $state<string | null>(null);
  let store = $state<LiveSessionStore | null>(null);
  let shootingHand: "left" | "right" = "right";

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
    shootingHand = player.shootingHand;
    const planItemId = page.url.searchParams.get("planItem");
    if (planItemId) {
      const item = await createPlanRepo(services).getItem(planItemId);
      if (item?.focusMetric) {
        focusMetric = item.focusMetric as MetricName;
        const target = builtInBenchmarks()[0]!.targets[focusMetric];
        focusLabel = target?.displayName ?? item.focusMetric;
      }
    }
    session = services.analysis.createLiveSession({
      shootingHand,
      profile: "pro-form",
    });
    phase = "setup";
  }

  async function beginLoop() {
    if (!session) return;
    const coordinator = createLiveRepCoordinator(
      { analyze: (frames) => session!.analyzeWindow(frames) },
      { shootingHand },
    );
    // The setup screen already started the pose stream; route frames in.
    session.onFrame((frame) => coordinator.pushFrame(frame));
    store = new LiveSessionStore({
      repos: services.repos,
      scoring: services.scoring,
      benchmarks: services.benchmarks,
      db: services.db,
      coordinator,
      audio,
      focusMetric,
      planItemId: page.url.searchParams.get("planItem"),
      feedbackMs,
    });
    await store.start();
    phase = "running";
  }

  async function endLoop(sessionId: string | null) {
    if (sessionId) {
      await goto(`/practice/summary/${sessionId}${page.url.search}`);
    } else {
      await goto(`/${page.url.search}`);
    }
  }

  onDestroy(() => {
    void store?.end();
    void session?.stop();
  });

  function exit() {
    void goto(`/${page.url.search}`);
  }
</script>

{#if phase === "setup" && session}
  <SetupScreen
    {session}
    {capture}
    {audio}
    {focusLabel}
    onstart={() => void beginLoop()}
    onexit={exit}
  />
{:else if phase === "running" && store}
  <PracticeLoopScreen {store} {focusLabel} onend={endLoop} />
{/if}
