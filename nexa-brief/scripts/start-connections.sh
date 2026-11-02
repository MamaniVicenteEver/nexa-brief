#!/usr/bin/env bash
set -Eeuo pipefail
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$root_dir/scripts/profile-env.sh"
port=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["services"]["tiktok"]["port"])' "$NEXA_PROFILE_DIR/profile.json")
unit="nexa-tiktok-$NEXA_DATA_PROFILE.service"
sync_config() { "$root_dir/nexa-brief-server/.venv/bin/python" "$root_dir/scripts/sync-connection-config.py"; }
if curl -fsS --max-time 3 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
  sync_config
  exit 0
fi
systemctl --user start "$unit"
for ((attempt=1; attempt<=30; attempt++)); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then sync_config; exit 0; fi
  sleep 1
done
echo 'El servicio TikTok compartido no está listo; revisa nexa-tiktok-connections.service.' >&2
exit 1
