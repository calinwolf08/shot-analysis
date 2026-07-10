<script lang="ts">
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { LiveAnalysisSession } from "$lib/features/analysis";
  import { builtInBenchmarks, type MetricName } from "$lib/features/benchmarks";
  import { SetupScreen } from "$lib/features/live-practice";
  import { createPlanRepo } from "$lib/features/training-plan";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { createWebAudioFeedbackService } from "$lib/shared/audio";
  import {
    createBrowserCaptureService,
    type CaptureService,
  } from "$lib/shared/media/capture";
  import { Button } from "$lib/shared/ui";

  const services = useAppServices();
  const audio = createWebAudioFeedbackService();

  // Replay mode (e2e / forced backend) has no camera to preview.
  const replayMode =
    page.url.searchParams.get("e2e") === "replay" ||
    import.meta.env.VITE_ANALYSIS_BACKEND === "replay";
  const capture: CaptureService | null = replayMode
    ? null
    : createBrowserCaptureService();

  let phase = $state<"loading" | "setup" | "running">("loading");
  let session = $state<LiveAnalysisSession | null>(null);
  let focusLabel = $state<string | null>(null);

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
    const planItemId = page.url.searchParams.get("planItem");
    if (planItemId) {
      const item = await createPlanRepo(services).getItem(planItemId);
      if (item?.focusMetric) {
        const target =
          builtInBenchmarks()[0]!.targets[item.focusMetric as MetricName];
        focusLabel = target?.displayName ?? item.focusMetric;
      }
    }
    session = services.analysis.createLiveSession({
      shootingHand: player.shootingHand,
      profile: "pro-form",
    });
    phase = "setup";
  }

  onDestroy(() => {
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
    onstart={() => (phase = "running")}
    onexit={exit}
  />
{:else if phase === "running"}
  <!-- Step 20 replaces this placeholder with the practice loop UI. -->
  <main class="running" data-testid="practice-loop">
    <h1>Session running</h1>
    <p>The live rep loop lands in step 20.</p>
    <Button variant="secondary" testid="practice-end" onclick={exit}>
      End session
    </Button>
  </main>
{/if}

<style>
  .running {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    gap: var(--sc-space-3);
    text-align: center;
  }
  p {
    color: var(--sc-text-dim);
  }
</style>
