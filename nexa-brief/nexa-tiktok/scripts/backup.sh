#!/usr/bin/env bash
set -euo pipefail
umask 077
base="$(cd "$(dirname "$0")/.." && pwd)"
data="${NEXA_TIKTOK_DATA_DIR:-$base/data}"
destination="${1:-${NEXA_TIKTOK_BACKUP_DIR:-$base/backups}}"
data="$(realpath -e "$data")"
destination="$(realpath -m "$destination")"
case "$destination/" in
  "$data/"*) printf 'El destino debe estar fuera del directorio de datos.\n' >&2; exit 1 ;;
esac
# Keep Chromium closed and prevent concurrent startup until tar is finished.
exec 9>"$data/.service.lock"
if ! flock -n 9; then
  printf 'Detén nexa-tiktok antes de crear el respaldo completo.\n' >&2
  exit 1
fi
exec 8>"$data/.store.lock"
flock -x 8
mkdir -p "$destination"
archive="$destination/nexa-tiktok-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gz"
trap 'rm -f -- "$archive"' EXIT
tar --exclude='Cache' --exclude='Code Cache' --exclude='GPUCache' --exclude='ShaderCache' --exclude='Crashpad' -C "$(dirname "$data")" -czf "$archive" "$(basename "$data")"
chmod 600 "$archive"
trap - EXIT
printf '%s\n' "$archive"
