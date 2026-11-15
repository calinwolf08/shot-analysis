<script lang="ts">
  import { page } from "$app/state";
  import { useAuth } from "$lib/shared/auth";
  import { Button } from "$lib/shared/ui";

  const auth = useAuth();

  let email = $state("");
  let password = $state("");
  let confirm = $state("");
  let localError = $state<string | null>(null);

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
    const address = email.trim();
    // The player's display name is collected during onboarding; the
    // account name defaults to the mailbox part of the email.
    await auth.signUp({
      name: address.split("@")[0] ?? address,
      email: address,
      password,
    });
    // On success the root layout guard navigates into onboarding.
  }
</script>

<form class="card" data-testid="auth-sign-up" onsubmit={submit}>
  <h2>Create account</h2>
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
  <label>
    Password
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
    Confirm password
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
  <Button size="lg" type="submit" testid="auth-submit" disabled={auth.pending}>
    {auth.pending ? "Creating account…" : "Create account"}
  </Button>
  <p class="alt">
    Already have an account?
    <a href="/auth/sign-in{page.url.search}" data-testid="auth-to-sign-in">
      Sign in
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
    color: var(--sc-text-dim);
    text-align: center;
  }
  .alt a {
    color: var(--sc-primary);
  }
</style>
