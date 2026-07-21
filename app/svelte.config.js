import adapterStatic from "@sveltejs/adapter-static";
import adapterNode from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Two build targets from one codebase (see docs/server-migration-plan.md):
//   BUILD_TARGET=node   → adapter-node: the web app + /api/* backend server.
//   BUILD_TARGET=static → adapter-static SPA: the Capacitor bundle, which calls
//                         the remote API. Default, so existing Capacitor tooling
//                         and `npm run build` keep producing the SPA.
const target = process.env.BUILD_TARGET === "node" ? "node" : "static";

const adapter =
  target === "node"
    ? adapterNode()
    : adapterStatic({
        // SPA mode: every route falls back to index.html, rendered client-side.
        fallback: "index.html",
      });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
  },
};

export default config;
