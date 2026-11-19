import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

/**
 * Live practice moved into the Practice tab (the tab IS the live loop now).
 * Old links — hidden Home/plan screens, bookmarks — land there, keeping their
 * query string (e2e/debug flags).
 */
export const load: PageLoad = ({ url }) => {
  redirect(307, `/practice${url.search}`);
};
