# shotcoach-auth-server

Standalone [better-auth](https://better-auth.com) server for the ShotCoach
app: **email + password** auth with cookie sessions, backed by its own
server-side SQLite file (`better-sqlite3`). The app is a static SPA whose
sql.js database lives in the browser — credentials and sessions can't live
there, so identity gets this small dedicated service.

## Run

```sh
npm start --workspace shotcoach-auth-server
```

| Env                    | Default                                | Meaning                                   |
| ---------------------- | -------------------------------------- | ----------------------------------------- |
| `AUTH_PORT`            | `5174`                                 | Listen port                               |
| `AUTH_DB`              | `auth-server/data/auth.sqlite`         | SQLite file (created + migrated on boot)  |
| `AUTH_SECRET`          | dev-only fallback                      | Signing secret — **set in production**    |
| `AUTH_TRUSTED_ORIGINS` | localhost:5173/4173 + Capacitor shells | Comma-separated origins allowed CORS/CSRF |
| `AUTH_E2E`             | off                                    | `1` exposes `/__test/reset-url` for tests |

Endpoints: better-auth under `/api/auth/*` (sign-up/sign-in/sign-out,
get-session, request-password-reset, reset-password, change-password),
plus `/health`.

## Password reset email

There is no SMTP here: `sendResetPassword` logs the reset link to the
server console (and, under `AUTH_E2E=1`, exposes the latest link per email
at `/__test/reset-url?email=…` so e2e tests can complete the flow). For
production, replace the sender in `src/auth.js` with a real email
transport.

## Tests

```sh
npm test --workspace shotcoach-auth-server
```

Boots the server on an ephemeral port with a temp database and exercises
sign-up, sign-in (right/wrong password), session cookies, and the
reset-link round trip over HTTP.
