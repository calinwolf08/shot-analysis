<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Button, Card } from "$lib/shared/ui";

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
    <Button testid="practice-live" onclick={startLive}>
      Start live practice
    </Button>
  </Card>
</div>

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
</style>
