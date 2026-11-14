<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { Button, Card } from "$lib/shared/ui";
  import {
    FocusSheet,
    focusSummary,
    normalizeAreas,
  } from "$lib/features/scoring";

  const services = useAppServices();

  let focusAreas = $state<string[]>([]);
  let focusOpen = $state(false);

  $effect(() => {
    void services.repos.settings
      .get("liveFocusAreas")
      .then((ids) => (focusAreas = normalizeAreas(ids)));
  });

  function changeFocus(ids: string[]) {
    focusAreas = ids;
    void services.repos.settings.set("liveFocusAreas", ids);
  }

  function startLive() {
    void goto(`/practice/live${page.url.search}`);
  }
</script>

<h1>Practice</h1>
<div class="options">
  <Card>
    <h2>Live practice</h2>
    <p>
      Shoot with real-time feedback after every rep. Set up side-on with your
      shooting arm toward the camera, then take your shots.
    </p>
    <button
      class="focus-row"
      data-testid="focus-row"
      onclick={() => (focusOpen = true)}
    >
      <span class="fr-label">🎯 Focus</span>
      <span class="fr-value" data-testid="focus-value"
        >{focusSummary(focusAreas)} ›</span
      >
    </button>
    <Button testid="practice-live" onclick={startLive}>
      Start live practice
    </Button>
  </Card>
</div>

<FocusSheet
  bind:open={focusOpen}
  selected={focusAreas}
  onchange={changeFocus}
/>

<style>
  h1 {
    margin: 0 0 var(--sc-space-4);
  }
  h2 {
    margin: 0 0 var(--sc-space-1);
    font-size: 17px;
  }
  p {
    color: var(--sc-text-dim);
    margin: 0 0 var(--sc-space-3);
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  .focus-row {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sc-space-3);
    padding: 10px 12px;
    margin-bottom: var(--sc-space-3);
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-surface);
    color: inherit;
    cursor: pointer;
    font-size: 14px;
  }
  .fr-label {
    font-weight: 600;
  }
  .fr-value {
    color: var(--sc-primary);
    font-weight: 600;
  }
</style>
