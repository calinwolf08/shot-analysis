import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig, type PluginOption } from "vite";

// The repo root (library) and app workspaces carry different vite majors, so
// plugin types from hoisted packages are not identical at the type level even
// though they are runtime-compatible. Cast once here.
const svelteTestingPlugin = svelteTesting() as unknown as PluginOption;

export default defineConfig({
  plugins: [sveltekit()],
  // Keep these external in the adapter-node SSR bundle (resolved from
  // node_modules at runtime). This never affects the client bundle — ssr.external
  // only applies to server builds, and the client still bundles
  // `better-auth/client`.
  //  - better-sqlite3: native CommonJS module (bundling breaks on `__filename`).
  //  - better-auth: ships its own zod 4.x; bundling deduped it to the app's zod
  //    3.x and broke on `z.coerce.boolean().meta(...)`. Externalizing lets it use
  //    its own nested zod at runtime.
  ssr: {
    external: ["better-sqlite3", "better-auth"],
  },
  test: {
    projects: [
      {
        // Component tests: *.svelte.test.ts run in jsdom with browser resolution.
        extends: "./vite.config.ts",
        plugins: [svelteTestingPlugin],
        test: {
          name: "component",
          environment: "jsdom",
          clearMocks: true,
          include: ["src/**/*.svelte.test.ts"],
          setupFiles: ["./vitest-setup-client.ts"],
        },
      },
      {
        // Unit tests: plain *.test.ts run in Node.
        extends: "./vite.config.ts",
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["src/**/*.svelte.test.ts"],
        },
      },
    ],
  },
});
