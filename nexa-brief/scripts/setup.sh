#!/usr/bin/env bash
# Deja nexa-brief listo para desarrollar en una máquina nueva. Se puede correr las
# veces que haga falta: no pisa archivos ni claves que ya existan.
#
#   ./scripts/setup.sh            (o `make setup`)
#
# Variables opcionales:
#   ADMIN_EMAIL / ADMIN_PASSWORD  usuario inicial de la web (default admin@nexabrief.com / admin123)
#   MEDIA_REMOTE                  de dónde bajar los audios/videos de las plantillas (ver scripts/media.sh)
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/nexa-brief-server"
WEB="$ROOT/nexa-brief-web"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; }
die() { printf '  ✗ %s\n' "$*" >&2; exit 1; }

# Lee VAR de un archivo .env (vacío si no está o no tiene valor).
env_get() { grep -E "^$2=" "$1" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
# Pone VAR=valor en un .env: reemplaza la línea si existe, si no la agrega.
env_set() {
  local file="$1" key="$2" value="$3"
  if grep -qE "^$key=" "$file"; then
    python3 - "$file" "$key" "$value" <<'PY'
import sys, pathlib
path, key, value = sys.argv[1:]
p = pathlib.Path(path)
lines = [f"{key}={value}" if l.startswith(f"{key}=") else l for l in p.read_text().splitlines()]
p.write_text("\n".join(lines) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

step "Requisitos"
command -v git >/dev/null || die "falta git"
command -v python3 >/dev/null || die "falta python3"
command -v uv >/dev/null || die "falta uv → curl -LsSf https://astral.sh/uv/install.sh | sh"
command -v node >/dev/null || die "falta Node.js ≥ 22 (ver .nvmrc en nexa-brief-web)"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$node_major" -ge 22 ]] || die "Node $node_major es viejo: hace falta ≥ 22"
if ! command -v pnpm >/dev/null; then
  warn "pnpm no está instalado; se activa con corepack (viene con Node)"
  corepack enable 2>/dev/null || die "no se pudo activar pnpm: corre 'sudo corepack enable' o 'npm i -g pnpm@11'"
fi
command -v ffmpeg >/dev/null || warn "falta ffmpeg: la API arranca, pero no podrá grabar videos (sudo apt install ffmpeg)"
ok "git, python3, uv, node $(node -v), pnpm $(pnpm -v)"

step "Archivos de entorno"
[[ -f "$ROOT/.env" ]] || { cp "$ROOT/.env.example" "$ROOT/.env"; ok "creado .env (puertos de Docker)"; }
[[ -f "$SERVER/.env" ]] || { cp "$SERVER/.env.example" "$SERVER/.env"; ok "creado nexa-brief-server/.env"; }
[[ -f "$WEB/.env.local" ]] || { cp "$WEB/.env.example" "$WEB/.env.local"; ok "creado nexa-brief-web/.env.local"; }

step "Backend (nexa-brief-server)"
(cd "$SERVER" && uv sync --frozen)
ok "dependencias de Python instaladas (.venv)"

if [[ -z "$(env_get "$SERVER/.env" PUBLISHER_ENCRYPTION_KEY)" ]]; then
  key="$(cd "$SERVER" && uv run --frozen python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
  env_set "$SERVER/.env" PUBLISHER_ENCRYPTION_KEY "$key"
  ok "generada PUBLISHER_ENCRYPTION_KEY (cifra los tokens de las redes)"
fi

# Chromium de Playwright (graba los videos). Playwright no reconoce distros muy nuevas
# (p. ej. Ubuntu 26.04): en ese caso se usan los binarios de Ubuntu 24.04, que funcionan.
if ! (cd "$SERVER" && uv run --frozen playwright install chromium >/dev/null 2>&1); then
  (cd "$SERVER" && PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 uv run --frozen playwright install chromium >/dev/null) \
    || die "no se pudo instalar Chromium de Playwright"
fi
ok "Chromium de Playwright instalado"

step "Web (nexa-brief-web)"
(cd "$WEB" && pnpm install --frozen-lockfile)
ok "dependencias de Node instaladas"

if [[ -z "$(env_get "$WEB/.env.local" AUTH_SECRET)" ]]; then
  env_set "$WEB/.env.local" AUTH_SECRET "$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  ok "generado AUTH_SECRET (sesiones de la web)"
fi

if [[ ! -s "$WEB/data/users.json" ]]; then
  (cd "$WEB" && node scripts/seed-admin.mjs "${ADMIN_EMAIL:-admin@nexabrief.com}" "${ADMIN_PASSWORD:-admin123}")
else
  ok "ya hay usuarios en nexa-brief-web/data/users.json"
fi

step "Medios de las plantillas (audios y videos, no van en git)"
media_remote="${MEDIA_REMOTE:-$(env_get "$ROOT/.env" MEDIA_REMOTE)}"
if [[ -n "$media_remote" ]]; then
  MEDIA_REMOTE="$media_remote" "$ROOT/scripts/media.sh" pull
else
  warn "MEDIA_REMOTE no está configurado: las plantillas se ven sin audio ni video de fondo."
  warn "Pedí acceso al servidor del equipo y corré: MEDIA_REMOTE=<host>:<ruta> make media-pull"
fi

step "Listo"
cat <<EOF
  Claves de servicios externos (Gemini, Pexels, YouTube…): completalas en
  nexa-brief-server/.env cuando las necesites. La API arranca sin ellas.

  make dev      → API en http://localhost:8000 + web en http://localhost:3000
  make test     → tests del backend
  make help     → todos los comandos
EOF
