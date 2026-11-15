<script lang="ts">
  import { useAuth } from "$lib/shared/auth";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { Player } from "$lib/shared/db/repos";
  import { Button, Card, PlaceholderBadge } from "$lib/shared/ui";

  const services = useAppServices();
  const auth = useAuth();

  let player = $state<Player | null>(null);
  let voiceFeedback = $state(true);

  let changeOpen = $state(false);
  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let changeError = $state<string | null>(null);
  let changeDone = $state(false);

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

  async function changePassword(event: SubmitEvent) {
    event.preventDefault();
    changeError = null;
    changeDone = false;
    if (newPassword !== confirmPassword) {
      changeError = "Passwords don't match.";
      return;
    }
    if (newPassword.length < 8) {
      changeError = "Password must be at least 8 characters.";
      return;
    }
    const ok = await auth.changePassword({ currentPassword, newPassword });
    if (ok) {
      changeDone = true;
      changeOpen = false;
      currentPassword = newPassword = confirmPassword = "";
    } else {
      changeError = auth.error;
    }
  }

  async function signOut() {
    // The root layout guard redirects to /auth/sign-in on status change.
    await auth.signOut();
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

<section class="block">
  <h2>Account</h2>
  <Card testid="account-card">
    <div class="row">
      <span class="fine">Signed in as</span>
      <strong data-testid="account-email">{auth.user?.email ?? "—"}</strong>
    </div>

    {#if changeDone}
      <p class="success" data-testid="account-change-done">
        Password updated. Other devices were signed out.
      </p>
    {/if}

    {#if changeOpen}
      <form class="pw-form" onsubmit={changePassword}>
        <label>
          Current password
          <input
            type="password"
            autocomplete="current-password"
            required
            bind:value={currentPassword}
            data-testid="account-current-password"
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autocomplete="new-password"
            required
            minlength={8}
            bind:value={newPassword}
            data-testid="account-new-password"
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autocomplete="new-password"
            required
            bind:value={confirmPassword}
            data-testid="account-confirm-password"
          />
        </label>
        {#if changeError}
          <p class="error" data-testid="account-change-error">{changeError}</p>
        {/if}
        <div class="actions">
          <Button
            type="submit"
            testid="account-change-submit"
            disabled={auth.pending}
          >
            {auth.pending ? "Updating…" : "Update password"}
          </Button>
          <Button variant="ghost" onclick={() => (changeOpen = false)}>
            Cancel
          </Button>
        </div>
      </form>
    {:else}
      <div class="actions">
        <Button
          variant="secondary"
          testid="account-change-password"
          onclick={() => (changeOpen = true)}
        >
          Change password
        </Button>
        <Button
          variant="ghost"
          testid="account-sign-out"
          disabled={auth.pending}
          onclick={signOut}
        >
          Sign out
        </Button>
      </div>
    {/if}
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
  .actions {
    display: flex;
    gap: var(--sc-space-2);
    margin-top: var(--sc-space-3);
  }
  .pw-form {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
    margin-top: var(--sc-space-3);
  }
  .pw-form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--sc-text-dim);
  }
  .pw-form input {
    padding: 10px 12px;
    border-radius: var(--sc-radius);
    border: 1px solid var(--sc-border);
    background: var(--sc-surface);
    color: inherit;
    font-size: 16px;
  }
  .error {
    color: var(--sc-fail);
    margin: 0;
    font-size: 14px;
  }
  .success {
    color: var(--sc-success);
    margin: var(--sc-space-3) 0 0;
    font-size: 14px;
  }
</style>
