/**
 * Copies replay fixtures into the built app for e2e runs. Kept out of
 * static/ so production builds don't ship megabytes of pose JSON.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src-tests", "fixtures", "poses");
// vite preview (SvelteKit) serves .svelte-kit/output/client; the adapter
// output in build/ is what ships. Cover both so e2e and any static server
// find the fixtures.
const dests = [
  join(here, "..", "build", "fixtures", "poses"),
  join(here, "..", ".svelte-kit", "output", "client", "fixtures", "poses"),
];

if (!existsSync(src)) {
  console.error(
    `No fixtures at ${src} — run: npx tsx scripts/build-fixtures.ts`,
  );
  process.exit(1);
}
for (const dest of dests) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`Copied fixtures → ${dest}`);
}
