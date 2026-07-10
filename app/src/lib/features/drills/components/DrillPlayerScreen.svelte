<script lang="ts">
  import { builtInBenchmarks } from "$lib/features/benchmarks";
  import { ISSUE_GROUP_INFO } from "$lib/features/diagnosis";
  import { Button, Card, PlaceholderBadge } from "$lib/shared/ui";
  import type { Drill } from "../schema";

  let {
    drill,
    onback,
    oncomplete,
  }: {
    drill: Drill;
    onback: () => void;
    /** Persist the completion (plan item or standalone log). */
    oncomplete: () => void | Promise<void>;
  } = $props();

  let completed = $state(false);
  let saving = $state(false);

  // Static content lookup — display names only, no benchmark values.
  const metricNames = builtInBenchmarks()[0]!.targets;
  const fixes = $derived([
    ...drill.issueGroups.map((g) => ISSUE_GROUP_INFO[g].displayName),
    ...drill.focusMetrics.map((m) => metricNames[m]?.displayName ?? m),
  ]);

  const DIFFICULTY = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };

  async function markComplete() {
    if (completed || saving) return;
    saving = true;
    try {
      await oncomplete();
      completed = true;
    } finally {
      saving = false;
    }
  }
</script>

<main class="drill" data-testid="drill-player">
  <header>
    <Button variant="ghost" testid="drill-back" onclick={onback}>← Back</Button>
    <h1>{drill.title}</h1>
    <PlaceholderBadge show={drill.isPlaceholder} text="Placeholder video" />
  </header>

  <!-- Muted placeholder animation, no dialogue to caption. -->
  <video
    src={drill.videoUri}
    poster={drill.thumbnailUri}
    controls
    loop
    muted
    playsinline
    data-testid="drill-video"
  ></video>

  <section class="facts">
    <span class="sc-numeral">{drill.setsReps}</span>
    <span>{drill.durationMin} min</span>
    <span>{DIFFICULTY[drill.difficulty]}</span>
    <span>{drill.equipment.join(", ")}</span>
  </section>

  <p class="description">{drill.description}</p>

  <Card>
    <h2>Coaching points</h2>
    <ol data-testid="drill-coaching-points">
      {#each drill.coachingPoints as point (point)}
        <li>{point}</li>
      {/each}
    </ol>
  </Card>

  <section>
    <h2>What this fixes</h2>
    <div class="fixes" data-testid="drill-fixes">
      {#each fixes as fix (fix)}
        <span class="fix-chip">{fix}</span>
      {/each}
    </div>
  </section>

  <Button
    testid="drill-complete"
    disabled={completed || saving}
    onclick={markComplete}
  >
    {completed ? "Completed ✓" : "Mark complete"}
  </Button>
</main>

<style>
  .drill {
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-4);
    padding-bottom: var(--sc-space-5);
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
  video {
    width: 100%;
    border-radius: var(--sc-radius);
    border: 1px solid var(--sc-border);
    background: #000;
    aspect-ratio: 16 / 9;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-space-3);
    color: var(--sc-text-dim);
    font-size: 13px;
  }
  .description {
    margin: 0;
    color: var(--sc-text);
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
  ol {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .fixes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sc-space-2);
  }
  .fix-chip {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--sc-card-raised);
    border: 1px solid var(--sc-border);
    font-size: 12px;
    font-weight: 600;
  }
</style>
