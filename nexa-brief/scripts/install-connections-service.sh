#!/usr/bin/env bash
# Conserva los datos y perfiles existentes; solo instala el supervisor del servicio.
set -Eeuo pipefail
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$root_dir/scripts/profile-env.sh"
port=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["services"]["tiktok"]["port"])' "$NEXA_PROFILE_DIR/profile.json")
unit="nexa-tiktok-$NEXA_DATA_PROFILE.service"
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
WorkingDirectory=$root_dir/nexa-tiktok
ExecStart="$root_dir/nexa-tiktok/.venv/bin/uvicorn" nexa_tiktok.main:app --host 0.0.0.0 --port $port
Environment=APP_ENV=production
Environment=NEXA_TIKTOK_DATA_DIR=$NEXA_PROFILE_DIR/tiktok
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
