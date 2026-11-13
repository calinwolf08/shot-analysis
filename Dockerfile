# syntax=docker/dockerfile:1

# ShotCoach web app + API (SvelteKit adapter-node) as a container image.
#
# Monorepo: the app (app/, workspace "shotcoach") depends on the root library
# `basketball-shot-analysis` via `file:..`, so the whole repo is the build
# context and the library's dist/ is built before the app. `better-sqlite3` is
# a native module (build tools are the fallback when no prebuilt binary fits).
#
# Runtime env (set these in Coolify; see SETUP.md §5):
#   AUTH_SECRET            required  — better-auth signing secret
#   DATABASE_PATH          required  — e.g. /data/shotcoach.sqlite (persistent volume)
#   ORIGIN                 required  — public https origin, e.g. https://app.example.com
#   AUTH_TRUSTED_ORIGINS   required  — web origin + capacitor://localhost + http://localhost
#   PORT (3000) / BODY_SIZE_LIMIT (64M) default below; override as needed.

# ---- builder: install deps, build the library (dist) then the app -----------
FROM node:22-bookworm-slim AS builder
ENV NODE_ENV=development
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# Dependency layer — cached until a manifest changes.
COPY package.json package-lock.json ./
COPY app/package.json app/package.json
RUN npm ci

# Build: library dist/ first (the app imports it), then the adapter-node server,
# then drop dev dependencies from the installed tree.
COPY . .
RUN npm run build \
  && npm run build:node --workspace shotcoach \
  && npm prune --omit=dev

# ---- runner: production image ----------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    BODY_SIZE_LIMIT=64M \
    LIVE_TARGETS_PATH=/repo/app/static/reference/live-targets.json
WORKDIR /repo/app

# The whole built tree: production node_modules (incl. the workspace symlink and
# the compiled better-sqlite3), the library dist/, app/build, and app/static.
COPY --from=builder /repo /repo

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# adapter-node output is app/build; run from app/ so static/ resolves.
CMD ["node", "build"]
