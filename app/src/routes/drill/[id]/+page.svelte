<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/shared/ui";
</script>

<main class="stub">
  <h1>Coming soon</h1>
  <p>This flow lands in a later implementation step.</p>
  <Button variant="secondary" onclick={() => goto("/")}>Back home</Button>
</main>

<style>
  .stub {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    gap: var(--sc-space-3);
    text-align: center;
  }
  p {
    color: var(--sc-text-dim);
  }
</style>
