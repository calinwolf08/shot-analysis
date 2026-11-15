<script lang="ts">
  // Entry route. The live-first app opens on Practice; onboarding (no player)
  // is handled by the root layout guard before this runs. The old Train home
  // (HomeScreen) is retired from the nav but kept in the codebase.
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  $effect(() => {
    void goto(`/practice${page.url.search}`, { replaceState: true });
  });
</script>

<main class="redirect" aria-busy="true"><p>Loading…</p></main>

<style>
  .redirect {
    display: grid;
    place-content: center;
    min-height: 60dvh;
    color: var(--sc-text-dim);
  }
</style>
