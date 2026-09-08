#!/usr/bin/env bash
# Rebuilds Nexa Brief after source/dependency changes and recreates its services.
# Named volumes are deliberately preserved.
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

case "${1:---help}" in
  --build)
    docker compose build
    ;;
  --restart)
    docker compose up -d --build --force-recreate --remove-orphans
    docker compose ps
    ;;
  --fresh)
    docker compose build --no-cache
    docker compose up -d --force-recreate --remove-orphans
    docker compose ps
    ;;
  --help|-h)
    cat <<'USAGE'
Usage: ./scripts/docker-refresh.sh OPTION

  --build    Rebuild images only; leaves services stopped.
  --restart  Rebuild changed images and recreate/start the stack.
  --fresh    Rebuild all layers without cache, then recreate/start the stack.

All options preserve named volumes and therefore do not delete data, renders,
or encrypted account credentials. To stop services later: docker compose down
USAGE
    ;;
  *)
    echo "Unknown option: $1. Use --help." >&2
    exit 2
    ;;
esac
