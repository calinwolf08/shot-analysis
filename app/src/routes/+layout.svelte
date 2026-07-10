<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    createAppServices,
    type AppServices,
  } from "$lib/shared/config/services";
  import { provideAppServices } from "$lib/shared/config/services-context";
  import { Toast } from "$lib/shared/ui";

  let { children }: { children: Snippet } = $props();

  let services = $state<AppServices | null>(null);
  let bootError = $state<string | null>(null);

  // Context must be set synchronously during init; the holder is filled in
  // once boot completes and children only render after that.
  const holder: AppServices = new Proxy({} as AppServices, {
    get(_, prop) {
      if (!services) {
        throw new Error("AppServices accessed before boot completed");
      }
      return services[prop as keyof AppServices];
    },
  });
  provideAppServices(holder);

  $effect(() => {
    let cancelled = false;
    createAppServices()
      .then(async (s) => {
        if (cancelled) return;
        await redirectIfNotOnboarded(s);
        services = s;
        exposeE2eHooks(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        bootError = err instanceof Error ? err.message : String(err);
      });
    return () => {
      cancelled = true;
    };
  });

  /** First run lands on onboarding until a player is persisted. */
  async function redirectIfNotOnboarded(s: AppServices) {
    const onboarded = await s.repos.settings.get("onboarded");
    const path = page.url.pathname;
    if (!onboarded && path !== "/onboarding" && !path.startsWith("/__debug")) {
      await goto(`/onboarding${page.url.search}`, { replaceState: true });
    }
  }

  /**
   * When the page is loaded with ?e2e in the query string, expose a tiny
   * debug API for Playwright (raw db access). Inert in normal use.
   */
  function exposeE2eHooks(s: AppServices) {
    if (!new URLSearchParams(window.location.search).has("e2e")) return;
    (
      window as unknown as {
        __shotcoach?: {
          run: (sql: string, params?: unknown[]) => Promise<unknown>;
          query: (sql: string, params?: unknown[]) => Promise<unknown>;
        };
      }
    ).__shotcoach = {
      run: (sql, params) =>
        s.db.run(sql, params as Parameters<typeof s.db.run>[1]),
      query: (sql, params) =>
        s.db.query(sql, params as Parameters<typeof s.db.query>[1]),
    };
  }
</script>

<svelte:head>
  <title>ShotCoach</title>
</svelte:head>

{#if bootError}
  <main class="boot-screen" data-testid="boot-error">
    <h1>Something went wrong</h1>
    <p>ShotCoach couldn't open its database. Restart the app to try again.</p>
    <pre>{bootError}</pre>
  </main>
{:else if services}
  <div data-testid="db-ready" hidden></div>
  {@render children()}
  <Toast />
{:else}
  <main class="boot-screen" data-testid="boot-loading" aria-busy="true">
    <p>Loading…</p>
  </main>
{/if}

<style>
  .boot-screen {
    display: grid;
    place-content: center;
    gap: var(--sc-space-3);
    min-height: 100dvh;
    padding: var(--sc-space-5);
    text-align: center;
  }
  pre {
    color: var(--sc-text-dim);
    font-size: 12px;
    white-space: pre-wrap;
  }
</style>
