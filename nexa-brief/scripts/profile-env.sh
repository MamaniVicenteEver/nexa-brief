#!/usr/bin/env bash
# Non-secret dataset selection, separate from execution mode.
export NEXA_DATA_HOME="${NEXA_DATA_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/nexa-brief}"
export NEXA_DATA_PROFILE="${NEXA_DATA_PROFILE:-profesional}"
export NEXA_PROFILE_DIR="${NEXA_PROFILE_DIR:-$NEXA_DATA_HOME/profiles/$NEXA_DATA_PROFILE}"

export NEXA_PROJECT_ROOT="${NEXA_PROJECT_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
_nexa_set_profile_paths() {
  local profile_id name kind selected_path validated_web_data
  if [[ -f "$NEXA_PROFILE_DIR/profile.json" ]]; then
    profile_id="$(python3 -c 'import json,re,sys; value=json.load(open(sys.argv[1], encoding="utf-8"))["id"]; assert isinstance(value,str) and re.fullmatch(r"[a-z][a-z0-9_-]{0,47}",value); print(value)' "$NEXA_PROFILE_DIR/profile.json")" || return 1
    export NEXA_DATA_PROFILE="$profile_id"
  fi
  validated_web_data="$(python3 "$NEXA_PROJECT_ROOT/scripts/profile-path.py" "$NEXA_PROFILE_DIR" web_data)" || return 1
  for kind in web_data connections renders tiktok; do
    case "$kind" in
      web_data) name=NEXA_WEB_DATA_DIR ;;
      connections) name=NEXA_CONNECTIONS_DIR ;;
      renders) name=NEXA_RENDERS_DIR ;;
      tiktok) name=NEXA_TIKTOK_DATA_DIR ;;
    esac
    if [[ -z "${!name:-}" ]]; then
      if [[ "$kind" == web_data ]]; then
        selected_path="$validated_web_data"
      else
        selected_path="$(python3 "$NEXA_PROJECT_ROOT/scripts/profile-path.py" "$NEXA_PROFILE_DIR" "$kind")" || return 1
      fi
      printf -v "$name" '%s' "$selected_path"
    fi
    export "$name"
  done
}
_nexa_set_profile_paths || { echo "No se pudo resolver el perfil de almacenamiento." >&2; return 1 2>/dev/null || exit 1; }
unset -f _nexa_set_profile_paths
