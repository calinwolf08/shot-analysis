<script lang="ts">
  import { goto } from "$app/navigation";
  import { useAppServices } from "$lib/shared/config/services-context";
  import { flushDb } from "$lib/shared/db";
  import type { PlayerLevel, ShootingHand } from "$lib/shared/db/repos";
  import { Button } from "$lib/shared/ui";

  const services = useAppServices();

  const slides = [
    {
      icon: "🎯",
      title: "See your form like a coach does",
      body: "ShotCoach analyzes 26 details of your shooting form from your phone's camera — elbow, rhythm, release, legs.",
    },
    {
      icon: "🗣️",
      title: "Instant feedback, every rep",
      body: "During live practice you get a score and ONE cue after each shot, spoken out loud. No touching your phone between reps.",
    },
    {
      icon: "📈",
      title: "A plan that adapts to you",
      body: "Assessments diagnose what to fix first and build a two-week training plan. Everything stays on your device.",
    },
  ];

  let step = $state(0); // 0..2 slides, 3 form, 4 camera tutorial
  let name = $state("");
  let hand = $state<ShootingHand>("right");
  let level = $state<PlayerLevel>("youth");
  let saving = $state(false);
  let error = $state<string | null>(null);

  const formValid = $derived(name.trim().length > 0);

  async function finish() {
    saving = true;
    error = null;
    try {
      await services.repos.player.create({
        name: name.trim(),
        shootingHand: hand,
        level,
      });
      await services.repos.settings.set("onboarded", true);
      await flushDb(services.db); // onboarding must survive an immediate reload
      await goto("/");
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      saving = false;
    }
  }
</script>

<main class="flow" data-testid="onboarding">
  {#if step <= 2}
    {@const slide = slides[step]!}
    <section class="slide" data-testid="onboarding-slide-{step}">
      <div class="icon">{slide.icon}</div>
      <h1>{slide.title}</h1>
      <p>{slide.body}</p>
    </section>
    <div class="nav">
      {#if step > 0}
        <Button variant="ghost" onclick={() => (step -= 1)}>Back</Button>
      {/if}
      <Button testid="onboarding-next" onclick={() => (step += 1)}>
        {step === 2 ? "Set up my profile" : "Next"}
      </Button>
    </div>
  {:else if step === 3}
    <section class="form" data-testid="onboarding-form">
      <h1>About you</h1>
      <label for="ob-name">Name</label>
      <input
        id="ob-name"
        data-testid="onboarding-name"
        bind:value={name}
        placeholder="Your name"
        autocomplete="name"
      />

      <span class="group-label" id="hand-label">Shooting hand</span>
      <div class="segmented" role="group" aria-labelledby="hand-label">
        {#each ["left", "right"] as const as h (h)}
          <button
            class:selected={hand === h}
            data-testid="onboarding-hand-{h}"
            onclick={() => (hand = h)}
          >
            {h === "left" ? "Left" : "Right"}
          </button>
        {/each}
      </div>

      <span class="group-label" id="level-label">Level</span>
      <div class="segmented" role="group" aria-labelledby="level-label">
        {#each [["youth", "Youth"], ["high-school", "High school"], ["advanced", "Advanced"]] as const as [value, label] (value)}
          <button
            class:selected={level === value}
            data-testid="onboarding-level-{value}"
            onclick={() => (level = value)}
          >
            {label}
          </button>
        {/each}
      </div>
    </section>
    <div class="nav">
      <Button variant="ghost" onclick={() => (step = 2)}>Back</Button>
      <Button
        testid="onboarding-to-camera"
        disabled={!formValid}
        onclick={() => (step = 4)}
      >
        Next
      </Button>
    </div>
  {:else}
    <section class="slide" data-testid="onboarding-camera">
      <div class="icon">📱</div>
      <h1>Camera setup</h1>
      <ul class="tips">
        <li>Prop your phone at hip-to-chest height.</li>
        <li>Stand 10–15 feet to the <strong>side</strong> of the shooter.</li>
        <li>Keep the whole body and the top of the shot arc in frame.</li>
      </ul>
      <p class="hint">
        You'll get a live framing check with green ticks before every practice
        session.
      </p>
      {#if error}
        <p class="error">{error}</p>
      {/if}
    </section>
    <div class="nav">
      <Button variant="ghost" onclick={() => (step = 3)}>Back</Button>
      <Button testid="onboarding-finish" disabled={saving} onclick={finish}>
        {saving ? "Saving…" : "Let's train"}
      </Button>
    </div>
  {/if}

  <div class="dots" aria-hidden="true">
    {#each [0, 1, 2, 3, 4] as i (i)}
      <span class:active={i === step}></span>
    {/each}
  </div>
</main>

<style>
  .flow {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--sc-space-5);
    padding: var(--sc-space-5);
    max-width: 480px;
    margin: 0 auto;
  }
  .slide,
  .form {
    text-align: center;
  }
  .icon {
    font-size: 56px;
    margin-bottom: var(--sc-space-4);
  }
  h1 {
    font-size: 24px;
    margin: 0 0 var(--sc-space-3);
  }
  p {
    color: var(--sc-text-dim);
    margin: 0;
  }
  .form {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  label,
  .group-label {
    font-size: 13px;
    color: var(--sc-text-dim);
    margin-top: var(--sc-space-3);
  }
  input {
    background: var(--sc-card);
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius-sm);
    color: var(--sc-text);
    padding: 12px 14px;
    font-size: 16px;
  }
  .segmented {
    display: flex;
    gap: var(--sc-space-2);
  }
  .segmented button {
    flex: 1;
    padding: 12px 8px;
    border-radius: var(--sc-radius-sm);
    border: 1px solid var(--sc-border);
    background: var(--sc-card);
    color: var(--sc-text-dim);
    font-weight: 600;
    cursor: pointer;
  }
  .segmented button.selected {
    border-color: var(--sc-primary);
    color: var(--sc-primary);
    background: rgb(255 122 41 / 10%);
  }
  .tips {
    text-align: left;
    color: var(--sc-text-dim);
    line-height: 1.7;
    margin: 0 auto;
    max-width: 320px;
  }
  .hint {
    margin-top: var(--sc-space-3);
    font-size: 13px;
  }
  .error {
    color: var(--sc-fail);
  }
  .nav {
    display: flex;
    justify-content: space-between;
    gap: var(--sc-space-3);
  }
  .nav :global(button:only-child) {
    margin-left: auto;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
  }
  .dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sc-border);
  }
  .dots span.active {
    background: var(--sc-primary);
  }
</style>
