<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    PlanOverview,
    type PlanFocusArea,
    type PlanItem,
    type PlanWithItems,
  } from "$lib/features/training-plan";
  import { useAppServices } from "$lib/shared/config/services-context";

  const services = useAppServices();

  let data = $state<PlanWithItems | null>(null);
  let drillTitles = $state<Record<string, string>>({});
  let notFound = $state(false);

  $effect(() => {
    void load(page.params.id!);
  });

  async function load(planId: string) {
    data = await services.trainingPlan.getPlan(planId);
    notFound = data === null;
    if (!data) return;
    const titles: Record<string, string> = {};
    for (const drill of await services.drills.list()) {
      titles[drill.id] = drill.title;
    }
    drillTitles = titles;
  }

  function withPlanItem(path: string, item: PlanItem): string {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local URL builder, never reactive state
    const params = new URLSearchParams(page.url.search);
    params.set("planItem", item.id);
    return `${path}?${params.toString()}`;
  }

  function open(item: PlanItem) {
    if (item.type === "drill" && item.drillId) {
      void goto(withPlanItem(`/drill/${item.drillId}`, item));
    } else if (item.type === "live_practice") {
      void goto(withPlanItem("/practice/live", item));
    } else {
      void goto(`/assess${page.url.search}`);
    }
  }

  function back() {
    void goto(`/${page.url.search}`);
  }
</script>

{#if data}
  <PlanOverview
    focus={data.plan.focus as PlanFocusArea[]}
    items={data.items}
    {drillTitles}
    onopen={open}
    onback={back}
  />
{:else if notFound}
  <main class="missing">
    <p>Plan not found.</p>
  </main>
{/if}

<style>
  .missing {
    min-height: 50dvh;
    display: grid;
    place-content: center;
    color: var(--sc-text-dim);
  }
</style>
