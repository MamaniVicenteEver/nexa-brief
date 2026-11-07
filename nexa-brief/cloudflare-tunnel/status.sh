#!/usr/bin/env bash
set -Eeuo pipefail

container_name="${CLOUDFLARE_TUNNEL_CONTAINER:-nexa-brief-cloudflared}"
current_home_dir="$(getent passwd "$(id -u)" | cut -d: -f6)"
config_dir="${XDG_CONFIG_HOME:-${current_home_dir}/.config}"
token_file="${CLOUDFLARE_TUNNEL_TOKEN_FILE:-${config_dir}/cloudflared/nexa-brief-token}"
origin_url="${NEXA_BRIEF_ORIGIN_URL:-http://127.0.0.1:3000}"
public_url="${NEXA_BRIEF_PUBLIC_URL:-https://nexa-brief.everdev.space}"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  printf 'Docker: no disponible\n'
  exit 1
fi

container_state="$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || true)"
restart_policy="$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container_name" 2>/dev/null || true)"
printf 'Token: %s\n' "$(if [[ -s "$token_file" && -r "$token_file" ]]; then printf 'disponible'; else printf 'falta o no se puede leer'; fi)"
printf 'Origen %s: ' "$origin_url"
if curl --silent --show-error --fail --max-time 4 "$origin_url" >/dev/null 2>&1; then
  printf 'responde\n'
else
  printf 'sin respuesta\n'
fi
printf 'Contenedor %s: %s (reinicio: %s)\n' "$container_name" "${container_state:-no creado}" "${restart_policy:-n/a}"
printf 'Dominio %s: ' "$public_url"
if curl --silent --show-error --fail --max-time 8 "$public_url" >/dev/null 2>&1; then
  printf 'responde\n'
else
  printf 'sin respuesta\n'
fi

if [[ -n "$container_state" ]]; then
  printf '\nÚltimas líneas de cloudflared:\n'
  docker logs --tail 12 "$container_name" 2>&1 || true
fi
