<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ShotRecord } from "$lib/shared/db/repos";
  import {
    groupByDay,
    shotIssue,
    timeLabel,
  } from "$lib/features/live-practice/review/shot-list";
  import {
    displayScore,
    loadEnabledChecks,
    loadKeyframeTargets,
    severity,
  } from "$lib/features/scoring/keyframes";
  import { scoreStoredShots } from "$lib/features/live-practice/review/scored-shots";
  import { EmptyState } from "$lib/shared/ui";

  const services = useAppServices();

  let shots = $state<ShotRecord[]>([]);
  let overall = $state<Record<string, number | null>>({});
  let issue = $state<Record<string, string | null>>({});
  const groups = $derived(groupByDay(shots, Date.now()));
  let loading = $state(true);

  $effect(() => {
    void load();
  });

  async function load() {
    const player = await services.repos.player.getFirst();
    if (!player) {
      loading = false;
      return;
    }
    const [targets, enabled] = await Promise.all([
      loadKeyframeTargets(),
      loadEnabledChecks(services.repos.settings),
    ]);
    const rows = await services.repos.shot.listByPlayer(player.id, {
      limit: 50,
    });
    const scored = await scoreStoredShots(
      services.repos.shot,
      rows,
      player.shootingHand,
      targets,
      enabled,
    );
    shots = scored.map((x) => x.record);
    const m: Record<string, number | null> = {};
    const iss: Record<string, string | null> = {};
    for (const { record, card } of scored) {
      m[record.id] = card?.overall ?? null;
      iss[record.id] = shotIssue(card);
    }
    overall = m;
    issue = iss;
    loading = false;
  }

  function open(id: string) {
    void goto(`/shots/${id}${page.url.search}`);
  }

  const SEVERITY_COLOR = {
    good: "#34d399",
    warn: "#fde047",
    bad: "#f87171",
  } as const;
  function color(n: number | null): string {
    const b = severity(n);
    return b ? SEVERITY_COLOR[b] : "#6b7280";
  }
  const fmt = displayScore;
</script>

<main class="shots" data-testid="shots-list">
  <h1>Shots</h1>
  {#if loading}
    <p class="dim">Loading…</p>
  {:else if shots.length === 0}
    <EmptyState
      title="No shots yet"
      body="Take some shots in Practice and they'll show up here to review."
    />
  {:else}
    {#each groups as g (g.key)}
      <section class="day" data-testid="shot-day-{g.key}">
        <h2 class="day-label" data-testid="shot-day-label">{g.label}</h2>
        <ul>
          {#each g.rows as s (s.id)}
            <li class:excluded={s.excluded}>
              <button
                class="row"
                data-testid="shot-row-{s.id}"
                onclick={() => open(s.id)}
              >
                <span
                  class="badge"
                  style="background:{color(overall[s.id] ?? null)}"
                >
                  {fmt(overall[s.id] ?? null)}
                </span>
                <span class="meta" data-testid="shot-label">
                  <span class="time">{timeLabel(s.createdAt)}</span>
                  <span class="issue"
                    >{issue[s.id] ?? "Not enough tracked to score"}</span
                  >
                </span>
                <span class="chev">›</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>

<style>
  .shots {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--sc-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-3);
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  .dim {
    color: var(--sc-text-dim);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  li.excluded {
    opacity: 0.5;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sc-space-3);
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--sc-border);
    border-radius: var(--sc-radius);
    background: var(--sc-card);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .badge {
    min-width: 2.4rem;
    text-align: center;
    padding: 4px 0;
    border-radius: 8px;
    font-weight: 800;
    color: #0b1220;
    font-variant-numeric: tabular-nums;
  }
  .meta {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: var(--sc-space-2);
  }
  .day-label {
    margin: var(--sc-space-2) 0 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--sc-text-dim);
  }
  .time {
    font-weight: 600;
  }
  .issue {
    font-size: 0.85rem;
    color: var(--sc-text-dim);
  }
  .chev {
    color: var(--sc-text-dim);
    font-size: 20px;
  }
</style>
