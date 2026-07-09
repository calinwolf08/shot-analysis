<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ScoreRecord } from "$lib/shared/db/repos";
  import { Button, Card, PlaceholderBadge, ScoreRing } from "$lib/shared/ui";

  let { sessionId }: { sessionId: string } = $props();

  const services = useAppServices();

  let score = $state<ScoreRecord | null>(null);
  let loading = $state(true);

  $effect(() => {
    void load(sessionId);
  });

  async function load(id: string) {
    loading = true;
    score = await services.repos.score.latestForRef("session", id);
    loading = false;
  }
</script>

<main class="results" data-testid="assess-results">
  <header>
    <Button variant="ghost" onclick={() => goto("/")}>✕</Button>
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

    <!-- Top issues + all-metrics accordion land in step 15. -->
    <div class="cta">
      <Button size="lg" testid="results-build-plan" disabled>
        Build my training plan (coming soon)
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
