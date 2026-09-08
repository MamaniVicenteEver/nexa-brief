# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
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
    pnpm install --frozen-lockfile --filter nexa-render-web...

FROM dependencies AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY web ./web
RUN pnpm --filter nexa-render-web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app/web
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/web /app/web
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
