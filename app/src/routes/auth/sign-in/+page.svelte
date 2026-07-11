<script lang="ts">
  import { page } from "$app/state";
  import { useAuth } from "$lib/shared/auth";
  import { Button } from "$lib/shared/ui";

  const auth = useAuth();

  let email = $state("");
  let password = $state("");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    // On success the root layout guard navigates into the app.
    await auth.signIn({ email: email.trim(), password });
  }
</script>

<form class="card" data-testid="auth-sign-in" onsubmit={submit}>
  <h2>Sign in</h2>
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
      autocomplete="current-password"
      required
      bind:value={password}
      data-testid="auth-password"
    />
  </label>
  {#if auth.error}
    <p class="error" data-testid="auth-error">{auth.error}</p>
  {/if}
  <Button size="lg" type="submit" testid="auth-submit" disabled={auth.pending}>
    {auth.pending ? "Signing in…" : "Sign in"}
  </Button>
  <p class="alt">
    New here?
    <a href="/auth/sign-up{page.url.search}" data-testid="auth-to-sign-up">
      Create an account
    </a>
  </p>
  <p class="alt">
    <a
      href="/auth/forgot-password{page.url.search}"
      data-testid="auth-to-forgot"
    >
      Forgot password?
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
