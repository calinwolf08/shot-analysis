<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<main class="auth">
  <h1>ShotCoach</h1>
  {@render children()}
</main>

<style>
  .auth {
    min-height: 100dvh;
    max-width: 420px;
    margin: 0 auto;
    padding: var(--sc-space-5) var(--sc-space-4);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--sc-space-4);
  }
  h1 {
    margin: 0;
    text-align: center;
    font-size: 28px;
  }
</style>
