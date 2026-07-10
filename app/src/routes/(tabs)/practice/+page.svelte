<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button, Card } from "$lib/shared/ui";
</script>

<h1>Practice</h1>
<div class="options">
  <Card>
    <h2>Live practice</h2>
    <p>Shoot with real-time feedback after every rep.</p>
    <Button testid="practice-live" onclick={() => goto("/practice/live")}>
      Start live practice
    </Button>
  </Card>
  <Card>
    <h2>Upload shots</h2>
    <p>Analyze recorded videos for a full assessment.</p>
    <Button
      variant="secondary"
      testid="practice-upload"
      onclick={() => goto("/assess")}
    >
      Upload videos
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
