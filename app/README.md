# ShotCoach

Mobile basketball shooting-form training app (SvelteKit 2 + Svelte 5 SPA in a
Capacitor 7 shell) built on the `basketball-shot-analysis` library at the repo
root. Design: `../docs/design-training-app.md`. Implementation plan:
`../docs/implementation-plan-training-app.md`.

## Setup

```bash
# from the repo root (npm workspaces)
npm install
npm run build            # build the library first (app depends on it)
```

## Scripts (run in app/ or with --workspace=shotcoach from root)

| Script             | What                                              |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Vite dev server                                   |
| `npm run build`    | Production SPA build → `build/`                   |
| `npm run preview`  | Serve the production build                        |
| `npm run check`    | `svelte-kit sync` + `svelte-check` (tsc strict)   |
| `npm run lint`     | prettier --check + eslint                         |
| `npm run test`     | Vitest: unit (node) + component (jsdom) projects  |
| `npm run test:e2e` | Playwright against the built app (`vite preview`) |
| `npm run cap:sync` | Build + `npx cap sync` (android + ios)            |
| `npm run verify`   | **The gate**: check + lint + test + build         |

Every implementation step must keep `npm run verify` green; steps that touch
UI flows also keep `npm run test:e2e` green.

## E2E notes

- Chromium is expected preinstalled via `PLAYWRIGHT_BROWSERS_PATH`. If the
  revision mismatches, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a compatible
  binary (e.g. `/opt/pw-browsers/chromium`).
- E2E runs use the deterministic replay analysis backend (`?e2e=replay`,
  wired in step 8) — no camera or MediaPipe needed.

## Architecture

Feature-first: see `src/lib/features/README.md` for the import rules.
Deviations from the implementation plan are logged in `docs/deviations.md`.
