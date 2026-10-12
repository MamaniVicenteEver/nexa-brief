#!/usr/bin/env bash
# Audios y videos de las plantillas (src/templates/**): no van en git por su peso
# (~3,6 GB), así que se sincronizan aparte con rsync por SSH.
#
#   MEDIA_REMOTE=ever-server:Proyectos/nexa-brief/nexa-brief ./scripts/media.sh pull
#
#   pull     baja del remoto lo que falta o cambió (no borra nada local)
#   push     sube lo local al remoto (no borra nada remoto)
#   status   muestra qué se bajaría, sin copiar nada
#
# MEDIA_REMOTE es "<host ssh>:<ruta a la carpeta nexa-brief>" y también puede ir en
# nexa-brief/.env. Hace falta acceso SSH a ese host (p. ej. por Tailscale).
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REL="nexa-brief-server/src/templates/"

remote="${MEDIA_REMOTE:-$({ grep -E '^MEDIA_REMOTE=' "$ROOT/.env" 2>/dev/null || true; } | tail -1 | cut -d= -f2-)}"
if [[ "${1:-}" =~ ^(pull|push|status)$ ]]; then
  [[ -n "$remote" ]] || { echo "Falta MEDIA_REMOTE (ej. ever-server:Proyectos/nexa-brief/nexa-brief), en el entorno o en nexa-brief/.env" >&2; exit 1; }
fi
command -v rsync >/dev/null || { echo "Falta rsync (sudo apt install rsync)" >&2; exit 1; }

# Solo medios, y solo los que usan las plantillas: se excluyen borradores (work/),
# pruebas (sandbox/, lab/), previews de grabación (render/preview/) y originales
# previos a la optimización.
FILTER=(
  --exclude='work/' --exclude='sandbox/' --exclude='lab/' --exclude='media_originals/'
  --exclude='_referencias/' --exclude='_source/*.mp4' --exclude='node_modules/' --exclude='render/preview/'
  --include='*/'
  --include='*.mp3' --include='*.mp4' --include='*.webm' --include='*.wav' --include='*.mov'
  --exclude='*'
  --prune-empty-dirs
)
SSH="ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=8"

case "${1:-}" in
  pull)
    rsync -a --partial --info=stats1,progress2 -e "$SSH" "${FILTER[@]}" "$remote/$REL" "$ROOT/$REL"
    ;;
  push)
    rsync -a --partial --info=stats1,progress2 -e "$SSH" "${FILTER[@]}" "$ROOT/$REL" "$remote/$REL"
    ;;
  status)
    rsync -a --dry-run --stats -e "$SSH" "${FILTER[@]}" "$remote/$REL" "$ROOT/$REL" \
      | grep -E 'Number of regular files transferred|Total transferred file size'
    ;;
  *)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
