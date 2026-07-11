<script lang="ts">
  import { page } from "$app/state";
  import { useAuth } from "$lib/shared/auth";
  import { Button } from "$lib/shared/ui";

  const auth = useAuth();

  let email = $state("");
  let sent = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const ok = await auth.requestPasswordReset(
      email.trim(),
      `${window.location.origin}/auth/reset-password`,
    );
    // Always show the same confirmation — don't leak which emails exist.
    if (ok || auth.error === null) sent = true;
  }
</script>

<form class="card" data-testid="auth-forgot" onsubmit={submit}>
  <h2>Reset your password</h2>
  {#if sent}
    <p class="sent" data-testid="auth-forgot-sent">
      If an account exists for that email, a reset link is on its way. Open it
      on this device to choose a new password.
    </p>
  {:else}
    <p class="hint">
      Enter your account email and we'll send you a link to choose a new
      password.
    </p>
    <label>
      Email
      <input
        type="email"
        autocomplete="email"
        required
        bind:value={email}
        data-testid="auth-email"
      />
    </label>
    {#if auth.error}
      <p class="error" data-testid="auth-error">{auth.error}</p>
    {/if}
    <Button
      size="lg"
      type="submit"
      testid="auth-submit"
      disabled={auth.pending}
    >
      {auth.pending ? "Sending…" : "Send reset link"}
    </Button>
  {/if}
  <p class="alt">
    <a href="/auth/sign-in{page.url.search}" data-testid="auth-to-sign-in">
      Back to sign in
    </a>
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
  .hint,
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
