<script lang="ts">
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { Player } from "$lib/shared/db/repos";
  import { Card, PlaceholderBadge } from "$lib/shared/ui";

  const services = useAppServices();

  let player = $state<Player | null>(null);
  let voiceFeedback = $state(true);

  $effect(() => {
    void load();
  });

  async function load() {
    player = await services.repos.player.getFirst();
    voiceFeedback = await services.repos.settings.get("voiceFeedback");
  }

  async function toggleVoice() {
    voiceFeedback = !voiceFeedback;
    await services.repos.settings.set("voiceFeedback", voiceFeedback);
  }
</script>

<h1>Profile</h1>

{#if player}
  <Card testid="profile-player">
    <dl>
      <dt>Name</dt>
      <dd data-testid="profile-name">{player.name}</dd>
      <dt>Shooting hand</dt>
      <dd data-testid="profile-hand">
        {player.shootingHand === "left" ? "Left" : "Right"}
      </dd>
      <dt>Level</dt>
      <dd data-testid="profile-level">{player.level}</dd>
    </dl>
  </Card>
{/if}

<section class="block">
  <h2>Benchmark</h2>
  <Card>
    <div class="row">
      <span>Elite Shooter (sample data)</span>
      <PlaceholderBadge />
    </div>
    <p class="fine">
      Scores compare your form against targets derived from the analysis
      library's pro-form profile. Real elite-shooter data will replace this
      benchmark in a future update.
    </p>
  </Card>
</section>

<section class="block">
  <h2>Settings</h2>
  <Card>
    <label class="row">
      <span>Voice feedback during practice</span>
      <input
        type="checkbox"
        checked={voiceFeedback}
        onchange={toggleVoice}
        data-testid="voice-toggle"
      />
    </label>
  </Card>
</section>

<style>
  h1 {
    margin: 0 0 var(--sc-space-4);
  }
  h2 {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sc-text-dim);
    margin: var(--sc-space-5) 0 var(--sc-space-2);
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sc-space-2) var(--sc-space-4);
    margin: 0;
  }
  dt {
    color: var(--sc-text-dim);
  }
  dd {
    margin: 0;
    text-align: right;
    font-weight: 600;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sc-space-3);
  }
  .fine {
    color: var(--sc-text-dim);
    font-size: 13px;
    margin: var(--sc-space-3) 0 0;
  }
  .block {
    margin-top: var(--sc-space-2);
  }
</style>
