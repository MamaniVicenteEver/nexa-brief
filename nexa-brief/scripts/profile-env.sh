#!/usr/bin/env bash
# Non-secret dataset selection, separate from execution mode.
export NEXA_DATA_HOME="${NEXA_DATA_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/nexa-brief}"
export NEXA_DATA_PROFILE="${NEXA_DATA_PROFILE:-profesional}"
export NEXA_PROFILE_DIR="${NEXA_PROFILE_DIR:-$NEXA_DATA_HOME/profiles/$NEXA_DATA_PROFILE}"
export NEXA_WEB_DATA_DIR="${NEXA_WEB_DATA_DIR:-$NEXA_PROFILE_DIR/web-data}"

export NEXA_PROJECT_ROOT="${NEXA_PROJECT_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
if [[ -f "$NEXA_PROFILE_DIR/profile.json" ]]; then
  export NEXA_DATA_PROFILE="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["id"])' "$NEXA_PROFILE_DIR/profile.json")"
fi
