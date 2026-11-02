#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"
source "$root_dir/scripts/profile-env.sh"

tiktok_port=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["services"]["tiktok"]["port"])' "$NEXA_PROFILE_DIR/profile.json")

web_ready=false
api_ready=false
tiktok_ready=false
curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1 && web_ready=true
curl -fsS --max-time 3 http://127.0.0.1:8000/health >/dev/null 2>&1 && api_ready=true
curl -fsS --max-time 3 "http://127.0.0.1:$tiktok_port/health" | python3 -c 'import json,os,sys;sys.exit(0 if json.load(sys.stdin).get("profile_id")==os.environ["NEXA_DATA_PROFILE"] else 1)' 2>/dev/null && tiktok_ready=true

if [[ "$web_ready" == true && "$api_ready" == true && "$tiktok_ready" == true ]]; then
  if ! curl -fsS --max-time 3 http://127.0.0.1:8000/api/v1/storage/profile | python3 -c 'import json,os,sys;sys.exit(0 if json.load(sys.stdin).get("id")==os.environ["NEXA_DATA_PROFILE"] else 1)'; then
    echo 'Los puertos de desarrollo pertenecen a otro perfil. Detén esos procesos antes de cambiar de datos.' >&2
    exit 1
  fi
  echo "Ya hay servicios saludables del perfil $NEXA_DATA_PROFILE."
  echo 'Desarrollo: https://dev-nexa-brief.everdev.space'
  exit 0
fi

port_in_use() {
  (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

if port_in_use 3000 || port_in_use 8000; then
  echo 'Alguno de los puertos 3000 o 8000 está ocupado; revisá los servicios existentes antes de iniciar desarrollo.' >&2
  exit 1
fi

echo 'Iniciando la web y la API de desarrollo. Para detenerlas, presioná Ctrl+C.'
echo 'Desarrollo: https://dev-nexa-brief.everdev.space'
exec make dev
