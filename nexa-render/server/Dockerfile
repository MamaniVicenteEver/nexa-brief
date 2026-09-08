# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack install --global pnpm@10.27.0

FROM base AS dependencies
ENV PNPM_FETCH_TIMEOUT=120000 \
    PNPM_FETCH_RETRIES=3 \
    PNPM_NETWORK_CONCURRENCY=4
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter nexa-render-server...

FROM dependencies AS build
COPY server ./server
RUN pnpm --filter nexa-render-server build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app/server
RUN apt-get update && \
    apt-get install --no-install-recommends -y ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/server/node_modules /app/server/node_modules
RUN /app/server/node_modules/.bin/playwright install --with-deps chromium && \
    chown -R node:node /app /ms-playwright
COPY --from=build --chown=node:node /app/server /app/server
# TypeScript compila el índice de plantillas, pero los recursos que éste lee en
# tiempo de ejecución no forman parte de `dist` automáticamente.
COPY --from=build --chown=node:node /app/server/src/templates /app/server/dist/templates
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
