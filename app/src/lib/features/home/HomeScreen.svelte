<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import type { Plan, PlanItem } from "$lib/features/training-plan";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { Button, Card, EmptyState, ScoreRing } from "$lib/shared/ui";

  const services = useAppServices();

  let overall = $state<number | null>(null);
  let hasData = $state(false);
  let playerName = $state("");
  let today = $state<{ plan: Plan; item: PlanItem; label: string } | null>(
    null,
  );

  $effect(() => {
    void load();
  });

  async function load() {
    const player = await services.repos.player.getFirst();
    if (!player) return;
    playerName = player.name;
    await loadToday(player.id);
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

  async function loadToday(playerId: string) {
    const next = await services.trainingPlan.nextPendingItem(playerId);
    if (!next) {
      today = null;
      return;
    }
    let label: string;
    if (next.item.type === "drill" && next.item.drillId) {
      label = (await services.drills.get(next.item.drillId))?.title ?? "Drill";
    } else if (next.item.type === "live_practice") {
      label = next.item.focusMetric ? "Focused live practice" : "Free shooting";
    } else {
      label = "Re-assessment";
    }
    today = { ...next, label };
  }

  function openToday() {
    if (!today) return;
    const { item } = today;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local URL builder, never reactive state
    const params = new URLSearchParams(page.url.search);
    params.set("planItem", item.id);
    if (item.type === "drill" && item.drillId) {
      void goto(`/drill/${item.drillId}?${params.toString()}`);
    } else if (item.type === "live_practice") {
      void goto(`/practice/live?${params.toString()}`);
    } else {
      void goto(`/assess${page.url.search}`);
    }
  }

  function openPlan() {
    if (!today) return;
    void goto(`/plan/${today.plan.id}${page.url.search}`);
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

{#if today}
  <section class="today">
    <Card raised testid="today-card">
      <span class="today-label">Today</span>
      <p class="today-title" data-testid="today-card-title">{today.label}</p>
      <div class="today-actions">
        <Button size="sm" testid="today-card-go" onclick={openToday}>
          {today.item.type === "reassessment" ? "Re-assess" : "Start"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          testid="today-card-plan"
          onclick={openPlan}
        >
          View plan
        </Button>
      </div>
    </Card>
  </section>
{/if}

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
  .today {
    margin-bottom: var(--sc-space-5);
  }
  .today-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sc-primary);
  }
  .today-title {
    margin: 4px 0 var(--sc-space-3);
    font-size: 16px;
    font-weight: 600;
  }
  .today-actions {
    display: flex;
    gap: var(--sc-space-2);
  }
  .cta {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
</style>
