#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $# -ne 2 ]]; then
  printf 'Uso: %s archivo.tar.gz directorio-vacío\n' "$0" >&2
  exit 2
fi
printf '%s\n' 'Aviso: un respaldo antiguo no contiene las claves ni trabajos creados después de la copia. Antes de publicar, concilia esas operaciones con TikTok Studio y los registros del puente. Este archivo no incluye los datos del puente ni la clave externa.' >&2
archive="$1"
destination="$2"
mkdir -p "$destination"
if [[ -n "$(ls -A "$destination")" ]]; then
  printf 'El directorio de destino debe estar vacío.\n' >&2
  exit 1
fi
# Inspect paths and let the data filter validate links before extraction.
python3 - "$archive" "$destination" <<'PY'
import json, pathlib, sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    members = archive.getmembers()
    for member in members:
        path = pathlib.PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir() or member.issym() or member.islnk()):
            raise SystemExit('El respaldo contiene una entrada insegura.')
    archive.extractall(sys.argv[2], members=members, filter='data')
    # Archives can carry permissive modes; recovered sessions stay private.
    root = pathlib.Path(sys.argv[2])
    root.chmod(0o700)
    for path in root.rglob('*'):
        if not path.is_symlink():
            path.chmod(0o700 if path.is_dir() else 0o600)
    # A queued job in an old archive may have run AFTER the snapshot. Never
    # replay remote side effects automatically when restoring that snapshot.
    for path in root.glob('*/jobs/*.json'):
        if path.is_symlink():
            continue
        try:
            job = json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError):
            continue
        if isinstance(job, dict) and job.get('state') in {'queued', 'running', 'clicked'}:
            job['state'] = 'needs_review'
            job['error'] = {'code': 'restored_archive', 'message': 'Revisar en TikTok Studio; no se reintentó.'}
            path.write_text(json.dumps(job, ensure_ascii=False), encoding='utf-8')
PY
