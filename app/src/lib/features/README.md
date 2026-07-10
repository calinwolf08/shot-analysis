# Feature-first architecture rules

Every product feature lives entirely inside its own folder here:
components, stores, services, repos, types, and tests together.

```
features/<feature>/
├── components/        *.svelte UI for this feature only
├── services/          business logic (interface + factory)
├── repo/              persistence for tables this feature owns
├── stores/            *.svelte.ts rune stores
├── data/              static JSON content (drills, benchmarks)
├── types.ts
├── __tests__/         feature tests (unit/component/integration)
└── index.ts           PUBLIC BARREL — the only import surface
```

## Import rules (enforced by convention — review PRs against these)

1. A feature may import from `$lib/shared/*` freely.
2. A feature may import from **another feature only via that feature's
   `index.ts` barrel**: `import { x } from "$lib/features/scoring";`
   Never deep-import `$lib/features/scoring/engine` from outside `scoring`.
3. Routes (`src/routes/**`) contain no business logic — they mount feature
   components and pass route params.
4. Every service/repo is exported as an interface + factory so tests can
   substitute fakes (see `shared/config/services.ts`).
5. Cross-cutting orchestration lives in the initiating feature's service,
   calling the other feature's public API.
