#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

if ! docker info >/dev/null 2>&1; then
  echo 'Docker no está disponible o el usuario no tiene acceso.' >&2
  exit 1
fi

api_container="$(docker compose ps --all --quiet api)"
web_container="$(docker compose ps --all --quiet web)"
if [[ -z "$api_container" || -z "$web_container" ]]; then
  echo 'Faltan los contenedores existentes de API o web. Prepará Docker con make docker-up.' >&2
  exit 1
fi

wait_healthy() {
  local container_id="$1" service_name="$2" state
  for ((attempt = 1; attempt <= 120; attempt++)); do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    case "$state" in
      healthy|running) return 0 ;;
      unhealthy|exited|dead)
        echo "El servicio $service_name no está saludable ($state). Revisá docker compose logs $service_name." >&2
        return 1 ;;
    esac
    sleep 1
  done
  echo "El servicio $service_name no estuvo listo a tiempo. Revisá docker compose logs $service_name." >&2
  return 1
}

echo 'Iniciando la API de Docker...'
docker start "$api_container" >/dev/null
wait_healthy "$api_container" api

echo 'Iniciando la web de Docker...'
docker start "$web_container" >/dev/null
wait_healthy "$web_container" web

echo 'Docker listo: https://nexa-brief.everdev.space'
if [[ "$(docker inspect --format '{{.State.Status}}' nexa-brief-cloudflared 2>/dev/null || true)" != running ]]; then
  echo 'El túnel de Cloudflare no está activo; el acceso público no estará disponible.' >&2
fi
