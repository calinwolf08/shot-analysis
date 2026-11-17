import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig, type Plugin, type PluginOption } from "vite";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Dev server only: serve the replay pose fixtures at /fixtures/poses/<id>.json
 * (as the e2e production build does via scripts/copy-fixtures-to-build.mjs),
 * so `?e2e=replay` works under `npm run dev` too. Never part of a build.
 */
function devReplayFixtures(): Plugin {
  const dir = join(process.cwd(), "src-tests", "fixtures", "poses");
  return {
    name: "dev-replay-fixtures",
    apply: "serve",
    configureServer(server) {
      // Reference ("model") shots for the Curry viewer, straight from
      // test-data/<id>/: poses.json, labels.json, and the local-only video
      // (gitignored; NBA footage never ships). Range requests so it seeks.
      const testData = join(process.cwd(), "..", "test-data");
      server.middlewares.use("/fixtures/reference", (req, res, next) => {
        const m =
          /^\/([\w.-]+)\/(poses\.json|labels\.json|manifest\.json|video)$/.exec(
            (req.url ?? "").split("?")[0]!,
          );
        if (!m) return next();
        const dir = join(testData, m[1]!);
        if (m[2] === "manifest.json") {
          // Whether the local-only video is present (avoids a 404 probe).
          let video = false;
          try {
            const name = (
              JSON.parse(readFileSync(join(dir, "labels.json"), "utf8")) as {
                video?: string;
              }
            ).video;
            video = !!name && existsSync(join(dir, name));
          } catch {
            return next();
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ video }));
          return;
        }
        if (m[2] !== "video") {
          const file = join(dir, m[2]!);
          if (!existsSync(file)) return next();
          res.setHeader("Content-Type", "application/json");
          res.end(readFileSync(file));
          return;
        }
        let name: string | undefined;
        try {
          name = (
            JSON.parse(readFileSync(join(dir, "labels.json"), "utf8")) as {
              video?: string;
            }
          ).video;
        } catch {
          return next();
        }
        const file = name ? join(dir, name) : "";
        if (!name || !existsSync(file)) {
          res.statusCode = 404;
          res.end("reference video not found locally");
          return;
        }
        const size = statSync(file).size;
        const type = [".mov", ".mp4", ".m4v"].includes(
          extname(file).toLowerCase(),
        )
          ? "video/mp4"
          : "video/webm";
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", type);
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
        if (range) {
          const start = range[1] ? Number(range[1]) : 0;
          const end = range[2] ? Number(range[2]) : size - 1;
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
          res.setHeader("Content-Length", String(end - start + 1));
          createReadStream(file, { start, end }).pipe(res);
        } else {
          res.setHeader("Content-Length", String(size));
          createReadStream(file).pipe(res);
        }
      });
      server.middlewares.use("/fixtures/poses", (req, res, next) => {
        const name = (req.url ?? "").split("?")[0]!.replace(/^\//, "");
        if (!/^[\w.-]+\.json$/.test(name)) return next();
        const file = join(dir, name);
        if (!existsSync(file)) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(file));
      });
    },
  };
}

// The repo root (library) and app workspaces carry different vite majors, so
// plugin types from hoisted packages are not identical at the type level even
// though they are runtime-compatible. Cast once here.
const svelteTestingPlugin = svelteTesting() as unknown as PluginOption;

export default defineConfig({
  plugins: [sveltekit(), devReplayFixtures()],
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
