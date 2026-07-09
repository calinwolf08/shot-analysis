<script lang="ts">
  import { page } from "$app/state";
  import type { Drill } from "$lib/features/drills";
  import { useAppServices } from "$lib/shared/config/services-context";

  // Test-build-only debug surface: dead-code-eliminated from production
  // builds (VITE_E2E unset) — verified by the step-24 build-output check.
  const enabled = import.meta.env.VITE_E2E === "1";

  const services = useAppServices();
  let drills = $state<Drill[]>([]);

  $effect(() => {
    if (!enabled) return;
    void services.drills.list().then((d) => (drills = d));
  });
</script>

{#if enabled}
  <main style="padding: 24px">
    <h1>Debug: drill catalog ({drills.length})</h1>
    <ul data-testid="debug-drill-list">
      {#each drills as drill (drill.id)}
        <li>
          <a
            data-testid="debug-drill-{drill.slug}"
            href="/drill/{drill.id}{page.url.search}"
          >
            {drill.title}
          </a>
        </li>
      {/each}
    </ul>
  </main>
{:else}
  <p>Not available.</p>
{/if}
