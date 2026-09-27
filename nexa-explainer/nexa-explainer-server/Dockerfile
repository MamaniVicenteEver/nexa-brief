# syntax=docker/dockerfile:1.7
FROM node:22.14.0-bookworm-slim AS remotion-dependencies
WORKDIR /opt/remotion
COPY nexa-brief-remotion/package.json nexa-brief-remotion/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY nexa-brief-remotion/ ./

FROM python:3.10.12-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/app/.venv \
    PATH=/app/.venv/bin:$PATH
RUN apt-get update && apt-get install --no-install-recommends -y \
      chromium ffmpeg fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv==0.9.17
WORKDIR /app

FROM base AS dependencies
COPY nexa-brief-server/pyproject.toml nexa-brief-server/uv.lock ./
# The package registry is occasionally slow in the target environment; uv's
# default 30s HTTP timeout is too short for that, so give it more headroom.
ENV UV_HTTP_TIMEOUT=300
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

FROM dependencies AS build
COPY nexa-brief-server/ ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM base AS runtime
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    REMOTION_PROJECT_DIR=/opt/remotion
RUN groupadd --system --gid 10001 nexa \
    && useradd --system --uid 10001 --gid nexa --home-dir /app --shell /usr/sbin/nologin nexa \
    && mkdir -p /app/data /app/output /app/.cache /home/nexa \
    && chown -R nexa:nexa /app /home/nexa
COPY --from=dependencies /app/.venv /app/.venv
COPY --from=build --chown=nexa:nexa /app /app
COPY --from=remotion-dependencies --chown=nexa:nexa /opt/remotion /opt/remotion
COPY --from=remotion-dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=remotion-dependencies /usr/local/lib/node_modules /usr/local/lib/node_modules
ENV PATH=/usr/local/bin:/app/.venv/bin:$PATH \
    HOME=/home/nexa
USER nexa
EXPOSE 8000
CMD ["uvicorn", "src.presentation.main:app", "--host", "0.0.0.0", "--port", "8000"]
