#!/usr/bin/env bash
# Conserva los datos y perfiles existentes; solo instala el supervisor del servicio.
set -Eeuo pipefail
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$root_dir/scripts/profile-env.sh"
port=$(python3 -c 'import json,sys; port=json.load(open(sys.argv[1], encoding="utf-8"))["services"]["tiktok"]["port"]; assert type(port) is int and 1024 <= port <= 65535; print(port)' "$NEXA_PROFILE_DIR/profile.json")
unit="nexa-tiktok-$NEXA_DATA_PROFILE.service"
# systemd unit syntax needs quoting and percent escaping for arbitrary paths.
unit_quote() {
  local value="$1"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || return 1
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//%/%%}"
  printf '"%s"' "$value"
}
working_dir=$(unit_quote "$root_dir/nexa-tiktok")
uvicorn=$(unit_quote "$root_dir/nexa-tiktok/.venv/bin/uvicorn")
tiktok_env=$(unit_quote "NEXA_TIKTOK_DATA_DIR=$NEXA_TIKTOK_DATA_DIR")
cd "$root_dir/nexa-tiktok"
.venv/bin/python -c 'from nexa_tiktok.config import settings; assert settings.nexa_tiktok_key, "Configura NEXA_TIKTOK_KEY antes de iniciar el servicio compartido"'
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$unit_dir"
cat > "$unit_dir/$unit" <<UNIT
[Unit]
Description=Nexa shared TikTok connections
After=network.target

[Service]
Type=simple
WorkingDirectory=$working_dir
ExecStart=$uvicorn nexa_tiktok.main:app --host 0.0.0.0 --port $port
Environment=APP_ENV=production
Environment=$tiktok_env
Environment=NEXA_TIKTOK_PROFILE_ID=$NEXA_DATA_PROFILE
Restart=on-failure
RestartSec=3
TimeoutStopSec=30
KillMode=control-group

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now "$unit"
"$root_dir/scripts/start-connections.sh"
