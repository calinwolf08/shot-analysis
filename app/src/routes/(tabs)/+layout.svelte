<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { href: "/", label: "Train", icon: "🏠" },
    { href: "/practice", label: "Practice", icon: "🏀" },
    { href: "/progress", label: "Progress", icon: "📈" },
    { href: "/profile", label: "Profile", icon: "👤" },
  ];

  function isActive(href: string): boolean {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  }
</script>

<div class="shell">
  <main>
    {@render children()}
  </main>
  <nav class="tab-bar" aria-label="Main">
    {#each tabs as tab (tab.href)}
      <a
        href={tab.href}
        class:active={isActive(tab.href)}
        aria-current={isActive(tab.href) ? "page" : undefined}
        data-testid="tab-{tab.label.toLowerCase()}"
      >
        <span class="icon" aria-hidden="true">{tab.icon}</span>
        <span>{tab.label}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }
  main {
    flex: 1;
    padding: var(--sc-space-4) var(--sc-space-4)
      calc(84px + env(safe-area-inset-bottom));
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
  }
  .tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background: var(--sc-card);
    border-top: 1px solid var(--sc-border);
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 30;
  }
  .tab-bar a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 0 8px;
    color: var(--sc-text-dim);
    text-decoration: none;
    font-size: 11px;
    font-weight: 600;
  }
  .tab-bar a.active {
    color: var(--sc-primary);
  }
  .icon {
    font-size: 20px;
  }
</style>
