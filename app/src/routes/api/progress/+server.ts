import { json, withUser } from "$lib/server/http";
import { ownership } from "$lib/server/context";
import { metricNameSchema } from "$lib/features/benchmarks";

// GET /api/progress?playerId=&kind=history|totals|trend[&metric=]
//   kind=history (default) → scoreHistory, totals → totals, trend → metricTrend
export const GET = withUser(async (ctx, event) => {
  const q = event.url.searchParams;
  const playerId = q.get("playerId");
  if (!playerId) return json({ error: "playerId required" }, 400);
  await ownership(ctx).player(playerId);

  const kind = q.get("kind") ?? "history";
  if (kind === "totals") {
    return json(await ctx.domain.progress.totals(playerId));
  }
  if (kind === "trend") {
    const metric = metricNameSchema.parse(q.get("metric"));
    return json(await ctx.domain.progress.metricTrend(playerId, metric));
  }
  return json(await ctx.domain.progress.scoreHistory(playerId));
});
