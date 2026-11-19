import { json, parseBody, withUser } from "$lib/server/http";
import type { ShotAnalysis } from "basketball-shot-analysis";
import { patchShotBody } from "$lib/shared/api/contracts";

export const GET = withUser(async ({ repos }, event) => {
  return json(await repos.shot.get(event.params.id!));
});

export const PATCH = withUser(async ({ repos }, event) => {
  const body = await parseBody(event, patchShotBody);
  if ("excluded" in body) {
    await repos.shot.setExcluded(event.params.id!, body.excluded);
  } else {
    await repos.shot.updateAnalysis(
      event.params.id!,
      body.analysis as unknown as ShotAnalysis,
    );
  }
  return json({ ok: true });
});
