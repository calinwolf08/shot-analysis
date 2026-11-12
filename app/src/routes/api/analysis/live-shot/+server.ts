import { json, parseBody, withUser } from "$lib/server/http";
import { analyzeLiveShotBody } from "$lib/shared/api/contracts";
import { parsePoseData } from "$lib/server/analysis";
import { readLiveTargets } from "$lib/server/live-targets";
import { ForbiddenError } from "$lib/server/errors";
import { profileForLevel } from "$lib/features/assessment";
import {
  createLocalPipeline,
  createRepoShotStore,
} from "$lib/features/live-practice/pipeline";

// POST /api/analysis/live-shot { playerId, poseData }
//   De-sessioned live analysis: analyze one pose window on the server, score it
//   against the live targets, persist the detected shot(s) rooted on the player,
//   and return them with their deviation scorecard. This is the server backing
//   for the swappable analysis location — the on-device pipeline runs the same
//   core locally; the scorecard is derived (from stored v2 metrics), not stored.
export const POST = withUser(async (ctx, event) => {
  const body = await parseBody(event, analyzeLiveShotBody);
  const poseData = parsePoseData(body.poseData);

  const player = await ctx.repos.player.get(body.playerId);
  if (!player) throw new ForbiddenError("not your player");

  const pipeline = createLocalPipeline({
    targets: readLiveTargets(),
    store: createRepoShotStore(ctx.repos.shot),
  });
  const shots = await pipeline.process({
    playerId: body.playerId,
    poseData,
    opts: {
      shootingHand: player.shootingHand,
      profile: profileForLevel(player.level),
    },
  });
  return json({ shots }, 201);
});
