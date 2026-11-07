#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "${script_dir}/.." && pwd)"
container_name="${CLOUDFLARE_TUNNEL_CONTAINER:-nexa-brief-cloudflared}"
tunnel_id="${CLOUDFLARE_TUNNEL_ID:-6d2d97ad-b6ce-44e4-b4c2-83eeb426d489}"
image="${CLOUDFLARE_TUNNEL_IMAGE:-cloudflare/cloudflared:latest}"
current_home_dir="$(getent passwd "$(id -u)" | cut -d: -f6)"
config_dir="${XDG_CONFIG_HOME:-${current_home_dir}/.config}"
token_file="${CLOUDFLARE_TUNNEL_TOKEN_FILE:-${config_dir}/cloudflared/nexa-brief-token}"
origin_url="${NEXA_BRIEF_ORIGIN_URL:-http://127.0.0.1:3000}"
public_url="${NEXA_BRIEF_PUBLIC_URL:-https://nexa-brief.everdev.space}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

origin_responds() {
  curl --silent --show-error --fail --max-time 2 "$origin_url" >/dev/null 2>&1
}

port_3000_listening() {
  command -v ss >/dev/null 2>&1 && ss -ltnH | awk '$4 ~ /:3000$/ { found = 1 } END { exit !found }'
}

wait_for_origin() {
  local attempt
  for attempt in $(seq 1 90); do
    origin_responds && return 0
    sleep 1
  done
  return 1
}

command -v docker >/dev/null 2>&1 || fail 'Docker no está instalado.'
command -v curl >/dev/null 2>&1 || fail 'curl no está instalado.'
docker info >/dev/null 2>&1 || fail 'Docker no está activo o el usuario no tiene acceso.'
[[ -s "$token_file" ]] || fail "No existe un token válido en $token_file. Configura CLOUDFLARE_TUNNEL_TOKEN_FILE."
[[ -r "$token_file" ]] || fail "El token existe, pero no se puede leer: $token_file."

if origin_responds; then
  printf 'La app ya responde en %s.\n' "$origin_url"
elif port_3000_listening; then
  fail 'El puerto 3000 está ocupado, pero la app no responde. Revisa el proceso antes de levantar el túnel.'
elif [[ "${NEXA_BRIEF_START_APP:-dev}" == 'dev' ]]; then
  printf 'Iniciando la app local con make dev; logs: %s/dev.log\n' "$script_dir"
  nohup make -C "$project_dir" dev >"${script_dir}/dev.log" 2>&1 </dev/null &
  if ! wait_for_origin; then
    printf 'La app no respondió en %s. Últimas líneas del log:\n' "$origin_url" >&2
    tail -n 40 "${script_dir}/dev.log" >&2 || true
    fail 'No se pudo iniciar la app local.'
  fi
  printf 'La app ya responde en %s.\n' "$origin_url"
else
  fail "No hay una app en $origin_url y NEXA_BRIEF_START_APP=${NEXA_BRIEF_START_APP}. Inicia el origen antes del túnel."
fi

container_state="$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || true)"
if [[ "$container_state" == 'running' ]]; then
  docker update --restart unless-stopped "$container_name" >/dev/null
  printf 'El contenedor %s ya está activo.\n' "$container_name"
else
  if [[ -n "$container_state" ]]; then
    docker rm -f "$container_name" >/dev/null
  fi
  printf 'Iniciando el túnel %s en Docker...\n' "$tunnel_id"
  docker run -d \
    --name "$container_name" \
    --restart unless-stopped \
    --network host \
    --user "$(id -u):$(id -g)" \
    --mount "type=bind,src=${token_file},dst=/etc/cloudflared/token,readonly" \
    "$image" tunnel --no-autoupdate run --token-file /etc/cloudflared/token "$tunnel_id" >/dev/null
fi

connected=0
for attempt in $(seq 1 30); do
  container_state="$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || true)"
  [[ "$container_state" == 'running' ]] || break
  if docker logs "$container_name" 2>&1 | grep -q 'Registered tunnel connection'; then
    connected=1
    break
  fi
  sleep 1
done

[[ "$container_state" == 'running' ]] || {
  docker logs --tail 25 "$container_name" >&2 || true
  fail 'El conector de Cloudflare se detuvo. Revisa Docker y el archivo del token.'
}
[[ "$connected" -eq 1 ]] || {
  printf 'El contenedor sigue activo, pero Cloudflare aún no confirma una conexión. Revisa: make public-status\n' >&2
  exit 1
}

printf 'Túnel conectado. Verificando %s...\n' "$public_url"
for attempt in $(seq 1 20); do
  if curl --silent --show-error --fail --max-time 4 "$public_url" >/dev/null 2>&1; then
    printf 'Listo: %s responde.\n' "$public_url"
    exit 0
  fi
  sleep 1
done

fail "El túnel conectó, pero $public_url todavía no respondió. Ejecuta make public-status para ver el estado."
