<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { Button, Card, EmptyState, ScoreRing } from "$lib/shared/ui";

  const services = useAppServices();

  let overall = $state<number | null>(null);
  let hasData = $state(false);
  let playerName = $state("");

  $effect(() => {
    void load();
  });

  async function load() {
    const player = await services.repos.player.getFirst();
    if (!player) return;
    playerName = player.name;
    const sessions = await services.repos.session.listByPlayer(player.id, {
      status: "completed",
    });
    for (const session of sessions) {
      const score = await services.repos.score.latestForRef(
        "session",
        session.id,
      );
      if (score?.overallScore != null) {
        overall = score.overallScore;
        hasData = true;
        return;
      }
    }
  }
</script>

<h1>ShotCoach</h1>
{#if playerName}
  <p class="hello">Let's get to work, {playerName}.</p>
{/if}

<section class="hero">
  {#if hasData}
    <ScoreRing value={overall} size={160} label="Overall form" />
  {:else}
    <Card>
      <EmptyState
        title="No score yet"
        body="Record or upload a few shots to get your baseline Form Score and a training plan built for you."
      />
    </Card>
  {/if}
</section>

<div class="cta">
  <Button
    size="lg"
    testid="start-assessment"
    onclick={() => goto(`/assess${page.url.search}`)}
  >
    {hasData ? "New assessment" : "Start your first assessment"}
  </Button>
  <Button
    variant="secondary"
    size="lg"
    testid="go-live-practice"
    onclick={() => goto(`/practice/live${page.url.search}`)}
  >
    Live practice
  </Button>
</div>

<style>
  h1 {
    margin: 0 0 4px;
  }
  .hello {
    color: var(--sc-text-dim);
    margin: 0 0 var(--sc-space-5);
  }
  .hero {
    display: flex;
    justify-content: center;
    margin-bottom: var(--sc-space-5);
  }
  .cta {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
</style>
