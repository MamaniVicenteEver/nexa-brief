#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

web_ready=false
api_ready=false
tiktok_ready=false
curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1 && web_ready=true
curl -fsS --max-time 3 http://127.0.0.1:8000/health >/dev/null 2>&1 && api_ready=true
curl -fsS --max-time 3 http://127.0.0.1:8100/health >/dev/null 2>&1 && tiktok_ready=true

if [[ "$web_ready" == true && "$api_ready" == true && "$tiktok_ready" == true ]]; then
  echo 'Ya hay servicios saludables en los puertos 3000, 8000 y 8100.'
  echo 'Desarrollo: https://dev-nexa-brief.everdev.space'
  exit 0
fi

port_in_use() {
  (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

if port_in_use 3000 || port_in_use 8000 || port_in_use 8100; then
  echo 'Alguno de los puertos 3000, 8000 o 8100 está ocupado; revisá los servicios existentes antes de iniciar desarrollo.' >&2
  exit 1
fi

echo 'Iniciando la web y la API de desarrollo. Para detenerlas, presioná Ctrl+C.'
echo 'Desarrollo: https://dev-nexa-brief.everdev.space'
exec make dev
