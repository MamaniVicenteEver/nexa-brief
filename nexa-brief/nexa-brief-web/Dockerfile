# syntax=docker/dockerfile:1.7
FROM node:22.14.0-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The dependency registry is occasionally slow in the target environment.
# Keep installs deterministic but tolerate transient package-download failures.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_factor=2 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000 \
    npm_config_network_concurrency=4
# pnpm sale de "packageManager" (package.json) y los build scripts permitidos de
# allowBuilds (pnpm-workspace.yaml), así que el install es directo y reproducible.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/node/corepack \
    corepack enable \
    && pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Skip pnpm's pre-script dependency sync check: it re-runs "pnpm install" internally,
# which re-triggers the same build-approval gate non-interactively and fails.
# node_modules is already correctly built by the dependencies stage above.
ENV pnpm_config_verify_deps_before_run=false
RUN pnpm build

FROM node:22.14.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 10001 nextjs \
    && useradd --system --uid 10001 --gid nextjs --home-dir /app --shell /usr/sbin/nologin nextjs \
    && mkdir -p /app/data && chown nextjs:nextjs /app/data
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
# Alta del primer usuario dentro del contenedor (`make docker-seed-admin`): el script
# y su única dependencia, que el bundle standalone no deja como módulo suelto.
COPY --from=build --chown=nextjs:nextjs /app/scripts/seed-admin.mjs ./scripts/seed-admin.mjs
COPY --from=build --chown=nextjs:nextjs /app/node_modules/.pnpm/bcryptjs@*/node_modules/bcryptjs ./node_modules/bcryptjs
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
