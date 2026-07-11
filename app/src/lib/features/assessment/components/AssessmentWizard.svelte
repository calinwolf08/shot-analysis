<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { Button, Card, EmptyState } from "$lib/shared/ui";
  import { AssessmentStore } from "../stores/assessment-store.svelte";
  import type { AssessmentVideoInput } from "../services/assessment-service";
  import {
    captureShotThumbnails,
    type ShotFrameInfo,
  } from "../services/frame-thumbnails";
  import AnalyzeStep from "./AnalyzeStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";

  const services = useAppServices();
  const store = new AssessmentStore(services.assessment, {
    // Set when launched from a plan's reassessment item.
    planItemId: page.url.searchParams.get("planItem"),
  });
  store.begin();

  // Replay mode (?e2e=replay): pick fixtures instead of files.
  const replayMode = $derived(page.url.searchParams.get("e2e") === "replay");
  const REPLAY_FIXTURES = [
    { id: "20201212_134104", label: "Fixture: 1 shot" },
    { id: "20190103_180930", label: "Fixture: 3 shots" },
    { id: "20190804_140654", label: "Fixture: 7 shots" },
  ];

  let finishing = $state(false);

  // Start/end frame stills per shot id, captured from the uploaded files
  // once review begins (fixture inputs have no pixels to capture).
  let frameInfo = $state<Record<string, ShotFrameInfo>>({});
  let thumbedSessionId: string | null = null;

  $effect(() => {
    if (store.phase !== "reviewing" || !store.outcome) return;
    const outcome = store.outcome;
    if (thumbedSessionId === outcome.sessionId) return;
    thumbedSessionId = outcome.sessionId;

    const blobs = store.inputs
      .map((i) => i.input)
      .filter((input): input is Blob => input instanceof Blob);
    // Videos are analyzed in input order, so distinct videoIds appear in
    // outcome.shots in the same order as the picked files.
    const videoIds: string[] = [];
    for (const shot of outcome.shots) {
      if (shot.videoId && !videoIds.includes(shot.videoId)) {
        videoIds.push(shot.videoId);
      }
    }
    if (blobs.length !== videoIds.length) return;

    void (async () => {
      for (const [idx, videoId] of videoIds.entries()) {
        const record = await services.repos.video.get(videoId);
        if (!record?.fps) continue;
        const captured = await captureShotThumbnails(
          blobs[idx]!,
          record.fps,
          outcome.shots.filter((s) => s.videoId === videoId),
        );
        frameInfo = { ...frameInfo, ...captured };
      }
    })();
  });

  function onFilesPicked(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;
    const inputs: AssessmentVideoInput[] = [...files].map((file) => ({
      input: file,
      name: file.name,
    }));
    store.addInputs(inputs);
  }

  function addFixture(id: string, label: string) {
    store.addInputs([
      { input: { kind: "fixture", fixtureId: id }, name: label },
    ]);
  }

  async function finishReview() {
    finishing = true;
    const sessionId = await store.finishReview();
    finishing = false;
    if (sessionId) {
      await goto(`/assess/results/${sessionId}${page.url.search}`);
    }
  }
</script>

<main class="wizard">
  <header>
    <Button
      variant="ghost"
      testid="assess-close"
      onclick={() => goto(`/${page.url.search}`)}
    >
      ✕
    </Button>
    <h1>Assessment</h1>
  </header>

  {#if store.phase === "picking" || store.phase === "idle"}
    <section class="pick" data-testid="assess-pick">
      <p class="hint">
        Add 1–10 videos of your shots. Side view, full body in frame. Each video
        can contain several shots.
      </p>

      {#if replayMode}
        <div class="fixtures">
          {#each REPLAY_FIXTURES as fixture (fixture.id)}
            <Button
              variant="secondary"
              testid="assess-fixture-{fixture.id}"
              onclick={() => addFixture(fixture.id, fixture.label)}
            >
              {fixture.label}
            </Button>
          {/each}
        </div>
      {:else}
        <label class="drop">
          <input
            type="file"
            accept="video/*"
            multiple
            data-testid="assess-file-input"
            onchange={onFilesPicked}
          />
          <span>Tap to add videos</span>
        </label>
      {/if}

      {#if store.inputs.length > 0}
        <div class="list" data-testid="assess-input-list">
          {#each store.inputs as input, i (i)}
            <Card padded={false}>
              <div class="input-row">
                <span>{input.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => store.removeInput(i)}
                >
                  Remove
                </Button>
              </div>
            </Card>
          {/each}
        </div>
      {/if}

      {#if store.errorKind === "no-shots"}
        <Card testid="assess-no-shots">
          <EmptyState
            title="No shots detected"
            body="We couldn't find a shot in that footage. Film from the side, 10–15 ft away, with your whole body and the arc of the ball in frame — then try again."
          />
        </Card>
      {:else if store.error}
        <p class="error" data-testid="assess-error">{store.error}</p>
      {/if}

      <Button
        size="lg"
        testid="assess-start"
        disabled={store.inputs.length === 0}
        onclick={() => store.start()}
      >
        Analyze {store.inputs.length || ""}
        {store.inputs.length === 1 ? "video" : "videos"}
      </Button>
    </section>
  {:else if store.phase === "analyzing"}
    <AnalyzeStep progress={store.progress} oncancel={() => store.cancel()} />
  {:else if store.phase === "reviewing" && store.outcome}
    <ReviewStep
      shots={store.outcome.shots}
      {frameInfo}
      isExcluded={(shot) => store.isExcluded(shot)}
      ontoggle={(shot) => store.toggleExclude(shot)}
      onfinish={finishReview}
      {finishing}
    />
  {:else if store.phase === "aborted"}
    <section class="aborted" data-testid="assess-aborted">
      <h2>Assessment cancelled</h2>
      <Button variant="secondary" onclick={() => goto(`/${page.url.search}`)}
        >Back home</Button
      >
    </section>
  {/if}
</main>

<style>
  .wizard {
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
    gap: var(--sc-space-2);
  }
  h1 {
    margin: 0;
    font-size: 20px;
  }
  .pick {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
  }
  .hint {
    color: var(--sc-text-dim);
    margin: 0;
    font-size: 14px;
  }
  .fixtures {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .drop {
    display: grid;
    place-content: center;
    min-height: 120px;
    border: 2px dashed var(--sc-border);
    border-radius: var(--sc-radius);
    color: var(--sc-text-dim);
    cursor: pointer;
  }
  .drop input {
    display: none;
  }
  .input-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sc-space-2) var(--sc-space-3);
  }
  .error {
    color: var(--sc-fail);
    margin: 0;
  }
  .aborted {
    text-align: center;
    padding-top: 20dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
    align-items: center;
  }
</style>
