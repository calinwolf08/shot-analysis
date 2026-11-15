# `$lib/server` — server-only code

Everything in this directory runs **only** on the SvelteKit server. SvelteKit
guarantees that modules under `$lib/server` (and any `*.server.ts` file) are
never bundled into the client — importing one from client code is a build error.
That guarantee is what lets us keep secrets, the database handle, and auth here.

Part of the [server migration](../../../../../docs/server-migration-plan.md).

## What lives here

| Module                             | Purpose                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `db.ts`                            | The single server-side database singleton (`getDb()`), built on the `better-sqlite3` driver, migrated on first access.        |
| `auth.ts` (Phase 2)                | better-auth instance (bearer tokens for all clients), same DB file.                                                           |
| `repos.ts` (Phase 3)               | `createServerRepos(db, userId)` — the shared repo set bound to an authenticated user, ownership enforced on every read/write. |
| `context.ts` / `http.ts` (Phase 4) | `requireUser(event)` and JSON/error helpers for `/api/*` route handlers.                                                      |
| `analysis.ts` (Phase 6)            | Runs the deterministic library pipeline server-side over posted pose frames (same results as the client replay path).         |

## Rules

- **Never import `$lib/server/*` from client code** (`.svelte`, stores, non-server
  `$lib` modules). Route handlers (`+server.ts`), `hooks.server.ts`, and other
  `*.server.ts` files are the only legitimate importers.
- **No secrets in the client.** Auth secrets, DB paths, and mailer config are
  read from `process.env` here, never via `import.meta.env` /`PUBLIC_*`.
- **One database.** All server code goes through `getDb()`; do not open ad-hoc
  connections. Auth tables and app tables share the one file/connection.
