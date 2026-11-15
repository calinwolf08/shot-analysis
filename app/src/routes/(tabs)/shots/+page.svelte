<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { useAppServices } from "$lib/shared/config/services-context";
  import type { ShotRecord } from "$lib/shared/db/repos";
  import { scorecardForShot } from "$lib/features/live-practice";
  import { loadLiveTargets } from "$lib/features/scoring";
  import { EmptyState } from "$lib/shared/ui";

  const services = useAppServices();

  let shots = $state<ShotRecord[]>([]);
  let overall = $state<Record<string, number | null>>({});
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
    const targets = await loadLiveTargets();
    shots = await services.repos.shot.listByPlayer(player.id, { limit: 50 });
    const m: Record<string, number | null> = {};
    for (const s of shots) {
      m[s.id] = scorecardForShot(s.analysis, targets).overall;
    }
    overall = m;
    loading = false;
  }

  function open(id: string) {
    void goto(`/shots/${id}${page.url.search}`);
  }

  function color(n: number | null): string {
    if (n === null) return "#6b7280";
    if (n <= 1.5) return "#34d399";
    if (n <= 4) return "#fbbf24";
    return "#f87171";
  }
  const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(1));
  const when = (t: number) =>
    new Date(t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
    <ul>
      {#each shots as s (s.id)}
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
            <span class="meta">
              <span class="orient">{s.orientation ?? "shot"}</span>
              <span class="date">{when(s.createdAt)}</span>
            </span>
            <span class="chev">›</span>
          </button>
        </li>
      {/each}
    </ul>
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
  .orient {
    font-weight: 600;
    text-transform: capitalize;
  }
  .date {
    font-size: 0.78rem;
    color: var(--sc-text-dim);
  }
  .chev {
    color: var(--sc-text-dim);
    font-size: 20px;
  }
</style>
