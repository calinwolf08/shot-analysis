<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { BenchmarkProfile } from "$lib/features/benchmarks";
  import type { FocusAreaRow } from "$lib/features/diagnosis";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { flushDb } from "$lib/shared/db";
  import type { ScoreRecord, Session, ShotRecord } from "$lib/shared/db/repos";
  import { Button, Card, PlaceholderBadge, ScoreRing } from "$lib/shared/ui";
  import DeltaStrip from "./DeltaStrip.svelte";
  import {
    computeFocusDeltas,
    computeScoreDeltas,
    type FocusDelta,
    type ScoreDelta,
  } from "./deltas";
  import MetricsAccordion from "./MetricsAccordion.svelte";
  import ShotStrip from "./ShotStrip.svelte";
  import TopIssues from "./TopIssues.svelte";
  import { summarizeMetrics, type MetricsByCategory } from "./metrics-summary";

  let { sessionId }: { sessionId: string } = $props();

  const services = useAppServices();

  let score = $state<ScoreRecord | null>(null);
  let focusAreas = $state<FocusAreaRow[]>([]);
  let shots = $state<ShotRecord[]>([]);
  let shotScores = $state<Map<string, number | null>>(new Map());
  let byCategory = $state<MetricsByCategory | null>(null);
  let benchmark = $state<BenchmarkProfile | null>(null);
  let session = $state<Session | null>(null);
  let scoreDeltas = $state<ScoreDelta[] | null>(null);
  let focusDeltas = $state<FocusDelta[]>([]);
  let loading = $state(true);
  let buildingPlan = $state(false);

  $effect(() => {
    void load(sessionId);
  });

  async function load(id: string) {
    loading = true;
    score = await services.repos.score.latestForRef("session", id);
    focusAreas = await services.diagnosis.listForSession(id);
    shots = await services.repos.shot.listBySession(id);
    benchmark = await services.benchmarks.getActive();

    const latest = await services.repos.score.latestForRefs(
      "shot",
      shots.map((s) => s.id),
    );
    shotScores = new Map(
      shots.map((s) => [s.id, latest.get(s.id)?.formScore ?? null]),
    );
    byCategory = benchmark ? summarizeMetrics(shots, benchmark) : null;
    session = await services.repos.session.get(id);
    await loadDeltas(id);
    loading = false;
  }

  /** Compares against the most recent prior completed assessment. */
  async function loadDeltas(id: string) {
    scoreDeltas = null;
    focusDeltas = [];
    if (!session || !score) return;
    const sessions = await services.repos.session.listByPlayer(
      session.playerId,
      { type: "assessment", status: "completed" },
    );
    const previous = sessions
      .filter(
        (s) =>
          s.id !== id &&
          (s.completedAt ?? 0) < (session!.completedAt ?? Infinity),
      )
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
    if (!previous) return;
    const previousScore = await services.repos.score.latestForRef(
      "session",
      previous.id,
    );
    if (!previousScore) return;
    scoreDeltas = computeScoreDeltas(score, previousScore);
    const previousAreas = await services.diagnosis.listForSession(previous.id);
    focusDeltas = computeFocusDeltas(focusAreas, previousAreas);
  }

  async function buildPlan() {
    if (buildingPlan) return;
    buildingPlan = true;
    try {
      const player = await services.repos.player.getFirst();
      if (!player) return;
      const plan = session?.planItemId
        ? await services.trainingPlan.completeReassessment(
            sessionId,
            player.id,
            session.planItemId,
          )
        : await services.trainingPlan.generateForSession(sessionId, player.id);
      await flushDb(services.db);
      // The plan-item binding is spent once the next plan exists.
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local URL builder, never reactive state
      const params = new URLSearchParams(page.url.search);
      params.delete("planItem");
      const qs = params.toString();
      await goto(`/plan/${plan.id}${qs ? `?${qs}` : ""}`);
    } finally {
      buildingPlan = false;
    }
  }
</script>

<main class="results" data-testid="assess-results">
  <header>
    <Button variant="ghost" onclick={() => goto(`/${page.url.search}`)}>
      ✕
    </Button>
    <h1>Your results</h1>
    <PlaceholderBadge />
  </header>

  {#if loading}
    <p>Loading…</p>
  {:else if !score}
    <p data-testid="results-missing">No score found for this session.</p>
  {:else}
    <section class="hero">
      <ScoreRing
        value={score.overallScore}
        size={170}
        label="Overall"
        testid="results-overall"
      />
      <div class="subs">
        <Card testid="results-sub-form">
          <span class="sub-label">Form</span>
          <span class="sub-value sc-numeral">
            {score.formScore === null ? "–" : Math.round(score.formScore)}
          </span>
        </Card>
        <Card testid="results-sub-consistency">
          <span class="sub-label">Consistency</span>
          <span class="sub-value sc-numeral">
            {score.consistencyScore === null
              ? "–"
              : Math.round(score.consistencyScore)}
          </span>
        </Card>
        <Card testid="results-sub-efficiency">
          <span class="sub-label">Efficiency</span>
          <span class="sub-value sc-numeral">
            {score.efficiencyScore === null
              ? "–"
              : Math.round(score.efficiencyScore)}
          </span>
        </Card>
      </div>
    </section>

    {#if scoreDeltas}
      <DeltaStrip {scoreDeltas} {focusDeltas} />
    {/if}

    <TopIssues areas={focusAreas} />
    <ShotStrip {shots} scores={shotScores} />
    {#if byCategory}
      <MetricsAccordion {byCategory} />
    {/if}

    <div class="cta">
      <Button
        size="lg"
        testid="results-build-plan"
        disabled={buildingPlan}
        onclick={buildPlan}
      >
        {buildingPlan
          ? "Building your plan…"
          : session?.planItemId
            ? "Build my next training plan"
            : "Build my training plan"}
      </Button>
      <Button variant="secondary" onclick={() => goto(`/${page.url.search}`)}>
        Done
      </Button>
    </div>
  {/if}
</main>

<style>
  .results {
    min-height: 100dvh;
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-5);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--sc-space-2);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    flex: 1;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sc-space-4);
  }
  .subs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sc-space-2);
    width: 100%;
  }
  .subs :global(.card) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .sub-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sc-text-dim);
  }
  .sub-value {
    font-size: 22px;
  }
  .cta {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
    margin-top: auto;
  }
</style>
