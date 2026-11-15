import { json, withUser } from "$lib/server/http";

// GET /api/benchmarks/active → the active benchmark profile (global catalog).
export const GET = withUser(async ({ domain }) => {
  return json(await domain.benchmarks.getActive());
});
