/**
 * E2E-only: exposes the most recent password-reset link for an email so the
 * reset-flow test can complete without a mailbox. Gated by AUTH_E2E — returns
 * 404 in normal builds. Replaces the old auth-server `/__test/reset-url`.
 */
import { error, json } from "@sveltejs/kit";
import { resetUrls } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) => {
  if (process.env.AUTH_E2E !== "1") throw error(404, "Not found");
  const email = url.searchParams.get("email");
  return json({ url: (email && resetUrls.get(email)) ?? null });
};
