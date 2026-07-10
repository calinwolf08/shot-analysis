<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ScoreRecord, Session, ShotRecord } from "$lib/shared/db/repos";
  import { Button, ScoreRing } from "$lib/shared/ui";
  import { BarChart } from "$lib/shared/ui/charts";

  let { sessionId }: { sessionId: string } = $props();

  const services = useAppServices();

  let session = $state<Session | null>(null);
  let score = $state<ScoreRecord | null>(null);
  let shots = $state<ShotRecord[]>([]);
  let shotScores = $state<Map<string, number | null>>(new Map());

  $effect(() => {
    void load(sessionId);
  });

  async function load(id: string) {
    session = await services.repos.session.get(id);
    score = await services.repos.score.latestForRef("session", id);
    shots = await services.repos.shot.listBySession(id);
    const latest = await services.repos.score.latestForRefs(
      "shot",
      shots.map((s) => s.id),
    );
    shotScores = new Map(
      shots.map((s) => [s.id, latest.get(s.id)?.formScore ?? null]),
    );
  }

  const barValues = $derived(shots.map((s) => shotScores.get(s.id) ?? null));

  function openShot(index: number) {
    const shot = shots[index];
    if (shot) void goto(`/progress/shot/${shot.id}${page.url.search}`);
  }
</script>

<main class="detail" data-testid="session-detail">
  <header>
    <Button
      variant="ghost"
      testid="session-detail-back"
      onclick={() =>
        history.length > 1
          ? history.back()
          : goto(`/progress${page.url.search}`)}
    >
      ← Back
    </Button>
    <h1>
      {session?.type === "assessment" ? "Assessment" : "Live practice"}
    </h1>
    {#if session?.completedAt}
      <span class="date">
        {new Date(session.completedAt).toLocaleDateString()}
      </span>
    {/if}
  </header>

  <section class="hero">
    <ScoreRing
      value={score?.overallScore ?? score?.formScore ?? null}
      size={140}
      label={score?.overallScore !== null ? "Overall" : "Form"}
      testid="session-detail-score"
    />
  </section>

  {#if shots.length > 0}
    <section>
      <h2>{shots.length} shots</h2>
      <BarChart
        values={barValues}
        testid="session-detail-shots"
        onbarclick={openShot}
      />
      <p class="hint">Tap a bar to open the shot's detail.</p>
    </section>
  {:else}
    <p class="hint">No included shots in this session.</p>
  {/if}
</main>

<style>
  .detail {
    max-width: 560px;
    margin: 0 auto;
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
  .date {
    color: var(--sc-text-dim);
    font-size: 13px;
  }
  .hero {
    display: flex;
    justify-content: center;
  }
  h2 {
    margin: 0 0 var(--sc-space-2);
    font-size: 16px;
  }
  .hint {
    color: var(--sc-text-dim);
    font-size: 12px;
    margin: var(--sc-space-2) 0 0;
  }
</style>
