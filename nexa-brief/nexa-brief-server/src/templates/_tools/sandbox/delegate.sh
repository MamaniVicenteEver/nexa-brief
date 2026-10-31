#!/usr/bin/env bash
# Ejecuta un trabajador Codex acotado a una plantilla del sandbox.
set -u

TOOL_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$(cd -- "$TOOL_DIR/../.." && pwd)"
SERVER_DIR="$(cd -- "$TOOL_DIR/../../../.." && pwd)"
SANDBOX_DIR="$TEMPLATES_DIR/sandbox"
INFO_SCRIPT="$TOOL_DIR/info.py"
ROLES_FILE="$SERVER_DIR/src/skills/models/roles.json"

usage() {
  echo "Uso: delegate.sh <cat>/<id> <tarea> [--bg]" >&2
  exit 2
}

[[ $# -ge 2 && $# -le 3 ]] || usage
ITEM="$1"
TASK="$2"
BACKGROUND=0
if [[ $# -eq 3 ]]; then
  [[ "$3" == "--bg" ]] || usage
  BACKGROUND=1
fi
[[ "$ITEM" =~ ^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*$ ]] || {
  echo "Error: usá una ruta segura con formato <categoría>/<id>." >&2
  exit 2
}
[[ "$TASK" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]] || {
  echo "Error: el nombre de tarea solo admite letras, números, guion y guion bajo." >&2
  exit 2
}

CATEGORY="${ITEM%%/*}"
ID="${ITEM#*/}"
ITEM_DIR="$SANDBOX_DIR/$CATEGORY/$ID"
SANDBOX_REAL="$(cd -- "$SANDBOX_DIR" && pwd -P)"
if [[ ! -d "$ITEM_DIR" || -L "$ITEM_DIR" || -L "$SANDBOX_DIR/$CATEGORY" ]]; then
  echo "Error: el prototipo debe existir como carpeta propia dentro de sandbox/<categoría>/<id>." >&2
  exit 2
fi
ITEM_REAL="$(cd -- "$ITEM_DIR" && pwd -P)"
if [[ "$ITEM_REAL" != "$SANDBOX_REAL/$CATEGORY/$ID" ]]; then
  echo "Error: la ruta real del prototipo sale de sandbox/<categoría>/<id>." >&2
  exit 2
fi
BRIEF="$ITEM_DIR/work/briefs/$TASK.md"
LOG="$ITEM_DIR/work/logs/$TASK.log"
RESULT="$ITEM_DIR/work/results/$TASK.md"
mkdir -p "$ITEM_DIR/work/briefs" "$ITEM_DIR/work/logs" "$ITEM_DIR/work/results"

if [[ ! -f "$BRIEF" ]]; then
  {
    echo "ERROR: no existe el brief requerido: $BRIEF"
    echo "Crealo en work/briefs/$TASK.md y volvé a ejecutar delegate.sh."
  } > "$LOG"
  printf 'EXIT 2\n' >> "$LOG"
  python3 "$INFO_SCRIPT" from-codex-log "$ITEM" "$LOG" >> "$LOG" 2>&1 || true
  echo "Error: no existe el brief requerido: $BRIEF" >&2
  exit 2
fi

if [[ "$BACKGROUND" -eq 1 ]]; then
  nohup "$TOOL_DIR/delegate.sh" "$ITEM" "$TASK" > "$LOG" 2>&1 < /dev/null &
  PID=$!
  echo "Codex quedó en segundo plano: pid=$PID log=$LOG"
  exit 0
fi

FINAL_STATUS=0
FINALIZED=0
finish() {
  if [[ "$FINALIZED" -eq 1 ]]; then return; fi
  FINALIZED=1
  printf 'EXIT %s\n' "$FINAL_STATUS" >> "$LOG"
  local usage_status=0
  python3 "$INFO_SCRIPT" from-codex-log "$ITEM" "$LOG" >> "$LOG" 2>&1 || usage_status=$?
  if [[ "$FINAL_STATUS" -eq 0 && "$usage_status" -ne 0 ]]; then
    FINAL_STATUS="$usage_status"
  fi
}
on_exit() {
  local actual_status=$?
  if [[ "$FINAL_STATUS" -eq 0 && "$actual_status" -ne 0 ]]; then
    FINAL_STATUS="$actual_status"
  fi
  finish
  trap - EXIT
  exit "$FINAL_STATUS"
}
trap on_exit EXIT

: > "$LOG"

ROLE_VALUES="$(python3 - "$ROLES_FILE" <<'PY'
import json, os, sys
path = sys.argv[1]
provider, model, effort = "codex", "gpt-6-luna", "xhigh"
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    role = data.get("roles", {}).get("prototype_worker", {})
    provider = role.get("provider", provider)
    model = role.get("model") or model
    setting = data.get("providers", {}).get(provider, {}).get("model_setting")
    if setting:
        model = os.environ.get(setting) or model
    effort = role.get("reasoning_effort") or role.get("effort") or effort
except (OSError, ValueError, TypeError):
    pass
print("\t".join((str(provider), str(model), str(effort))))
PY
)"
IFS=$'\t' read -r PROVIDER MODEL EFFORT <<< "$ROLE_VALUES"
if [[ "$PROVIDER" != "codex" ]]; then
  echo "Error: prototype_worker debe usar Codex; roles.json indica '$PROVIDER'." >> "$LOG"
  FINAL_STATUS=2
  exit "$FINAL_STATUS"
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Error: no encuentro el ejecutable codex en PATH." >> "$LOG"
  FINAL_STATUS=127
  exit "$FINAL_STATUS"
fi

CACHE_DIR="${HOME}/.cache"
PNPM_DIR="${HOME}/.local/share/pnpm"
ROOTS_JSON="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:], separators=(",", ":")))' \
  "$ITEM_DIR" "/tmp" "$CACHE_DIR" "$PNPM_DIR")"
PROMPT="Leé work/briefs/$TASK.md y ejecutá la tarea completa. Escribí la entrega final en work/results/$TASK.md. Trabajá desde esta carpeta; tus escrituras permitidas son esta plantilla, /tmp y las cachés locales. No edites lanzadores ni scripts que estén ejecutándose."
{
  echo "Trabajador Codex · modelo=$MODEL · reasoning=$EFFORT"
  echo "Plantilla: $ITEM"
  echo "Brief: work/briefs/$TASK.md"
  echo "Resultado requerido: work/results/$TASK.md"
  echo
} >> "$LOG"

CODEX_STATUS=0
# Codex workers use the machine's ChatGPT subscription, matching the agent adapter.
unset OPENAI_API_KEY CODEX_API_KEY OPENAI_BASE_URL
codex exec \
  -m "$MODEL" \
  -c "model_reasoning_effort=\"$EFFORT\"" \
  -c 'forced_login_method="chatgpt"' \
  -s workspace-write \
  -c sandbox_workspace_write.network_access=true \
  -c "sandbox_workspace_write.writable_roots=$ROOTS_JSON" \
  --skip-git-repo-check \
  -C "$ITEM_DIR" \
  "$PROMPT" >> "$LOG" 2>&1 || CODEX_STATUS=$?
if [[ "$CODEX_STATUS" -eq 0 && ! -s "$RESULT" ]]; then
  echo "Error: Codex terminó con EXIT 0 pero no creó work/results/$TASK.md." >> "$LOG"
  CODEX_STATUS=1
fi
FINAL_STATUS="$CODEX_STATUS"
exit "$FINAL_STATUS"
