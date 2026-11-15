<script lang="ts">
  import { page } from "$app/state";
  import { useAuth } from "$lib/shared/auth";
  import { Button } from "$lib/shared/ui";

  const auth = useAuth();

  const token = $derived(page.url.searchParams.get("token"));

  let password = $state("");
  let confirm = $state("");
  let localError = $state<string | null>(null);
  let done = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    localError = null;
    if (password !== confirm) {
      localError = "Passwords don't match.";
      return;
    }
    if (password.length < 8) {
      localError = "Password must be at least 8 characters.";
      return;
    }
    if (!token) return;
    done = await auth.resetPassword(password, token);
  }
</script>

<form class="card" data-testid="auth-reset" onsubmit={submit}>
  <h2>Choose a new password</h2>
  {#if done}
    <p class="sent" data-testid="auth-reset-done">
      Your password has been updated. Sign in with the new one.
    </p>
  {:else if !token}
    <p class="error" data-testid="auth-reset-no-token">
      This reset link is missing or incomplete. Request a new one from the
      "Reset your password" page.
    </p>
    <p class="alt">
      <a href="/auth/forgot-password{page.url.search}">Request a new link</a>
    </p>
  {:else}
    <label>
      New password
      <input
        type="password"
        autocomplete="new-password"
        required
        minlength={8}
        bind:value={password}
        data-testid="auth-password"
      />
    </label>
    <label>
      Confirm new password
      <input
        type="password"
        autocomplete="new-password"
        required
        bind:value={confirm}
        data-testid="auth-confirm"
      />
    </label>
    {#if localError || auth.error}
      <p class="error" data-testid="auth-error">{localError ?? auth.error}</p>
    {/if}
    <Button
      size="lg"
      type="submit"
      testid="auth-submit"
      disabled={auth.pending}
    >
      {auth.pending ? "Updating…" : "Set new password"}
    </Button>
  {/if}
  <p class="alt">
    <a href="/auth/sign-in" data-testid="auth-to-sign-in">Back to sign in</a>
  </p>
</form>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
    padding: var(--sc-space-4);
    background: var(--sc-card);
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
  }
  h2 {
    margin: 0;
  }
  .sent {
    margin: 0;
    font-size: 14px;
    color: var(--sc-text-dim);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--sc-text-dim);
  }
  input {
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
  .alt {
    margin: 0;
    font-size: 14px;
    text-align: center;
  }
  .alt a {
    color: var(--sc-primary);
  }
</style>
