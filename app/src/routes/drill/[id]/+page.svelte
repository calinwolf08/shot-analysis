<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { DrillPlayerScreen, type Drill } from "$lib/features/drills";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { toasts } from "$lib/shared/ui";

  const services = useAppServices();

  let drill = $state<Drill | null>(null);
  let notFound = $state(false);

  $effect(() => {
    void load(page.params.id!);
  });

  async function load(id: string) {
    drill =
      (await services.drills.get(id)) ?? (await services.drills.getBySlug(id));
    notFound = drill === null;
  }

  function back() {
    if (history.length > 1) history.back();
    else void goto(`/${page.url.search}`);
  }

  async function complete() {
    // When opened from a training plan, completion checks off that item;
    // standalone plays just acknowledge.
    const planItemId = page.url.searchParams.get("planItem");
    if (planItemId) {
      await services.trainingPlan.completeItem(planItemId);
    }
    toasts.show("Drill completed — nice work!", "success");
  }
</script>

{#if drill}
  <DrillPlayerScreen {drill} onback={back} oncomplete={complete} />
{:else if notFound}
  <main class="missing">
    <p>Drill not found.</p>
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
