import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // SPA mode: every route falls back to index.html and is rendered client-side.
      fallback: "index.html",
    }),
  },
};

export default config;
