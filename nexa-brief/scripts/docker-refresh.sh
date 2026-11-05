#!/usr/bin/env bash
# Rebuilds Nexa Brief after source/dependency changes and recreates its services.
# Named volumes are deliberately preserved.
set -Eeuo pipefail

# Igual que Make: los archivos compartidos pertenecen al usuario del host.
export APP_UID="${APP_UID:-$(id -u)}"
export APP_GID="${APP_GID:-$(id -g)}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
source "./scripts/profile-env.sh"

backup_images() {
  for service in api web; do
    container=$(docker compose ps --all --quiet "$service")
    if [[ -n "$container" ]]; then
      image=$(docker inspect --format '{{.Image}}' "$container")
      docker image tag "$image" "nexa-brief-$service:previous"
    elif docker image inspect "nexa-brief-$service:latest" >/dev/null 2>&1; then
      docker image tag "nexa-brief-$service:latest" "nexa-brief-$service:previous"
    fi
  done
}

case "${1:---help}" in
  --build)
    backup_images
    docker compose build
    bash ./scripts/docker-clean-images.sh
    ;;
  --restart)
    backup_images
    docker compose up -d --build --force-recreate --remove-orphans
    docker compose ps
    bash ./scripts/docker-clean-images.sh
    ;;
  --fresh)
    backup_images
    docker compose build --no-cache
    docker compose up -d --force-recreate --remove-orphans
    docker compose ps
    bash ./scripts/docker-clean-images.sh
    ;;
  --clean)
    bash ./scripts/docker-clean-images.sh
    ;;
  --help|-h)
    cat <<'USAGE'
Usage: ./scripts/docker-refresh.sh OPTION

  --build    Rebuild images only; leaves services stopped.
  --restart  Rebuild changed images and recreate/start the stack.
  --fresh    Rebuild all layers without cache, then recreate/start the stack.
  --clean    Remove obsolete project images, retaining latest and previous.

All options preserve named volumes and therefore do not delete data, renders,
or encrypted account credentials. To stop services later: docker compose down
USAGE
    ;;
  *)
    echo "Unknown option: $1. Use --help." >&2
    exit 2
    ;;
esac
