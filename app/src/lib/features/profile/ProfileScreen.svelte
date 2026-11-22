<script lang="ts">
  import { useAuth } from "$lib/shared/auth";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { Player } from "$lib/shared/db/repos";
  import { Button, Card, PlaceholderBadge } from "$lib/shared/ui";
  import {
    CLIP_CAP_CHOICES,
    getShotClipStore,
  } from "$lib/shared/media/shot-clip-store";
  import {
    getVideoRetention,
    setVideoRetention,
  } from "$lib/shared/media/video-retention";
  import { loadProProfiles } from "$lib/features/pros";
  import type { ProProfile } from "basketball-shot-analysis";

  const services = useAppServices();
  const auth = useAuth();

  let player = $state<Player | null>(null);
  let voiceFeedback = $state(true);
  let videoRetention = $state(getVideoRetention());
  /** Pros the targets were built from (empty until the first pro build). */
  let pros = $state<readonly ProProfile[]>([]);
  let scoreAgainst = $state<string | null>(null);

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
    pros = (await loadProProfiles())?.pros ?? [];
    scoreAgainst = await services.repos.settings.get("scoreAgainstPro");
  }

  async function changeScoreAgainst(id: string) {
    scoreAgainst = id || null;
    await services.repos.settings.set("scoreAgainstPro", scoreAgainst);
  }

  /** Lowering the number deletes the oldest clips on this device now. */
  async function changeRetention(n: number) {
    videoRetention = n;
    setVideoRetention(n);
    await getShotClipStore()
      .setCap(n)
      .catch(() => undefined);
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
    <label class="row">
      <span>
        Keep video for the last
        <small class="hint"
          >Stored on this device only. Older shots show the skeleton.</small
        >
      </span>
      <select
        value={videoRetention}
        onchange={(e) => void changeRetention(Number(e.currentTarget.value))}
        data-testid="video-retention"
      >
        {#each CLIP_CAP_CHOICES as n (n)}
          <option value={n}>{n === 0 ? "No video" : `${n} shots`}</option>
        {/each}
      </select>
    </label>
    {#if pros.length > 0}
      <label class="row">
        <span>
          Score against
          <small class="hint"
            >Targets from all pros, or centred on one pro's form.</small
          >
        </span>
        <select
          value={scoreAgainst ?? ""}
          onchange={(e) => void changeScoreAgainst(e.currentTarget.value)}
          data-testid="score-against"
        >
          <option value="">All pros</option>
          {#each pros as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </label>
    {/if}
  </Card>
</section>

<!-- TEMP: quick access to the debug tools while metrics are being audited.
     Dev/E2E builds only (constant-folded away in production). -->
{#if import.meta.env.DEV || import.meta.env.VITE_E2E === "1"}
  <section class="block">
    <a class="debug-link" href="/__debug" data-testid="debug-tools-link"
      >Debug tools →</a
    >
  </section>
{/if}

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
  .hint {
    display: block;
    color: var(--sc-text-dim);
    font-size: 12px;
  }
  .debug-link {
    color: var(--sc-primary);
    font-weight: 600;
  }
</style>
