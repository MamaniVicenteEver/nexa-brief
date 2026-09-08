#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
WEB_URL="http://localhost:${WEB_PORT:-3000}"
API_URL="http://localhost:${API_PORT:-8000}"

on_error() { docker compose logs --no-color || true; }
trap on_error ERR

docker compose build
docker compose up -d

for attempt in $(seq 1 24); do
  if curl --fail --silent --show-error --max-time 5 "$API_URL/health" >/dev/null \
    && curl --fail --silent --show-error --max-time 5 "$WEB_URL/api/health" >/dev/null; then
    break
  fi
  [[ "$attempt" == 24 ]] && { echo "Stack did not become healthy." >&2; exit 1; }
  sleep 2
done

# Real API contract used by the UI, beyond health endpoints.
python3 - "$API_URL" <<'PY'
import json
import sys
import urllib.request

with urllib.request.urlopen(f"{sys.argv[1]}/api/v1/niches", timeout=5) as response:
    payload = json.load(response)
if not isinstance(payload, list):
    raise SystemExit("/api/v1/niches did not return a JSON list")
print(f"Business API check OK: {len(payload)} niches returned")
PY

docker compose exec -T api python -c 'import shutil; assert shutil.which("ffmpeg"); assert shutil.which("node")'
docker compose ps
echo "Docker verification completed successfully."
