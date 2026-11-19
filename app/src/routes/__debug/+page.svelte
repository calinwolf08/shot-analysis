<script lang="ts">
  /** Index of the dev/E2E debug tools (not in production builds). */
  import { DEBUG_ROUTES } from "./debug-routes";

  const enabled = import.meta.env.DEV || import.meta.env.VITE_E2E === "1";
</script>

<svelte:head><title>Debug tools</title></svelte:head>

{#if !enabled}
  <p>Not available.</p>
{:else}
  <main class="dbg" data-testid="debug-index">
    <a href="/profile">← App</a>
    <h1>Debug tools</h1>
    <ul>
      {#each DEBUG_ROUTES as r (r.path)}
        <li>
          <a href={r.path} data-testid="debug-link-{r.path.split('/').at(-1)}"
            >{r.title}</a
          >
          <p>{r.about}</p>
        </li>
      {/each}
    </ul>
  </main>
{/if}

<style>
  .dbg {
    max-width: 640px;
    margin: 0 auto;
    padding: 16px;
  }
  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  li a {
    font-weight: 700;
    color: var(--sc-primary);
  }
  li p {
    margin: 2px 0 0;
    color: var(--sc-text-dim);
    font-size: 14px;
  }
</style>
