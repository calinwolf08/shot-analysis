import { json, parseBody, withUser } from "$lib/server/http";
import { analyzeLiveShotBody } from "$lib/shared/api/contracts";
import { parsePoseData } from "$lib/server/analysis";
import { readKeyframeTargets } from "$lib/server/live-targets";
import { ForbiddenError } from "$lib/server/errors";
import { profileForLevel } from "$lib/features/assessment";
import {
  createLocalPipeline,
  createRepoShotStore,
} from "$lib/features/live-practice/pipeline";

// POST /api/analysis/live-shot { playerId, poseData }
//   De-sessioned live analysis: analyze one pose window on the server, score it
//   against the keyframe targets, persist the detected shot(s) rooted on the player,
//   and return them with their deviation scorecard. Shots read from a camera
//   angle live practice doesn't accept come back in `rejected`, unstored. This is the server backing
//   for the swappable analysis location — the on-device pipeline runs the same
//   core locally; the scorecard is derived (from the stored keyframe checks), not stored.
export const POST = withUser(async (ctx, event) => {
  const body = await parseBody(event, analyzeLiveShotBody);
  const poseData = parsePoseData(body.poseData);

  const player = await ctx.repos.player.get(body.playerId);
  if (!player) throw new ForbiddenError("not your player");

  const pipeline = createLocalPipeline({
    targets: readKeyframeTargets(),
    store: createRepoShotStore(ctx.repos.shot),
  });
  const result = await pipeline.process({
    playerId: body.playerId,
    poseData,
    opts: {
      shootingHand: player.shootingHand,
      profile: profileForLevel(player.level),
    },
    ...(body.focusIndex !== undefined ? { focusIndex: body.focusIndex } : {}),
  });
  // { shots, rejected } — rejected = detected but wrong camera angle.
  return json(result, 201);
});
