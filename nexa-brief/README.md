# Nexa Brief

Generación automática de videos (plantillas de letras, promos y documentales narrados) y publicación en
YouTube, TikTok y Facebook.

| Proyecto | Qué es | Puerto |
| --- | --- | --- |
| `nexa-brief-server` | API FastAPI: pipeline, grabación (Playwright + ffmpeg), publicación | 8000 |
| `nexa-brief-web` | Panel Next.js | 3000 |
| `nexa-brief-remotion` | Motor de render Node que invoca la API | — |
| `nexa-brief-hyperframes` | Composiciones HyperFrames (CLI) | — |

## Inicio rápido (desarrollo local)

Requisitos: **git**, **Python 3.10** vía [uv](https://docs.astral.sh/uv/), **Node ≥ 22** (`.nvmrc`), **ffmpeg** y
**rsync**. pnpm se activa solo con corepack.

```bash
git clone git@github.com:MamaniVicenteEver/nexa-brief.git
cd nexa-brief/nexa-brief
make setup     # dependencias, .env, claves, Chromium de Playwright y usuario admin
make dev       # API http://localhost:8000 + web http://localhost:3000
```

Entrá a la web con **admin@nexabrief.com / admin123**. Cambiala con
`make seed-admin EMAIL=tu@correo PASSWORD=…`, o pasá `ADMIN_EMAIL`/`ADMIN_PASSWORD` al `make setup`.

`make setup` se puede repetir: no pisa archivos ni claves existentes. Genera solo
`PUBLISHER_ENCRYPTION_KEY` (cifra los tokens de las redes) y `AUTH_SECRET` (sesiones de la web).

### Lo que no viene en git

| Qué | Dónde | Cómo se consigue |
| --- | --- | --- |
| Claves de servicios (Gemini, Pexels, YouTube…) | `nexa-brief-server/.env` | Pedilas al equipo. La API arranca sin ellas; cada función avisa qué clave falta. |
| Audios y videos de las plantillas (~3,6 GB) | `nexa-brief-server/src/templates/**` | `make media-pull` con `MEDIA_REMOTE` en `.env` (acceso SSH al servidor del equipo). |
| Cuentas conectadas (tokens cifrados) | `nexa-brief-server/accounts.json` | Se crean al conectar una red desde la web (**Canales**), o desde `ACCOUNTS_JSON_B64` en el `.env`. |
| Datos de la app (jobs, cola, biblioteca) | `nexa-brief-server/data/` | Se crean solos. Cada máquina tiene los suyos. |
| Usuarios de la web | `nexa-brief-web/data/users.json` | `make setup` / `make seed-admin`. |

### Comandos

```bash
make help        # todos
make test        # tests del backend
make lint        # ruff + biome + tsc (lo mismo que la CI)
make format      # arregla formato
make media-pull  # baja los medios de las plantillas
make media-push  # sube medios nuevos (plantillas creadas por vos)
make preview-media  # copias livianas para las vistas previas (si no, se generan solas al abrirlas)
make template-posters  # renderiza intros NodeMotion y las guarda como portadas WebP
make template-posters FORCE=1  # fuerza regenerar portadas existentes
```

## Docker

```bash
make setup                  # (o al menos copiar los .env.example)
make docker-build
make docker-up
make docker-seed-admin      # primer usuario de la web dentro del contenedor
```

- Web: http://localhost:3000 · API: http://localhost:8000 · Salud: http://localhost:8000/health · OpenAPI: http://localhost:8000/docs
- En Docker, `NEXT_PUBLIC_API_URL` queda vacío: el navegador usa el mismo origen (`/api/v1`) y Next.js reenvía
  las peticiones a `INTERNAL_API_URL=http://api:8000` dentro de la red privada. Configurá solo `PUBLIC_APP_URL` con la URL HTTPS pública (por ejemplo, el túnel) para que OAuth, los accesos y
  las redirecciones usen el mismo origen; `AUTH_URL` se deriva de esa variable; `INTERNAL_API_URL` se fija también al construir la imagen web.
- La API monta `nexa-brief-server/src/templates` del disco: los medios que bajes con `make media-pull` y las
  grabaciones se ven sin reconstruir. Construí con `make docker-build` (pasa tu UID/GID para que el contenedor
  pueda escribir ahí); con `docker compose` directo, exportá antes `APP_UID=$(id -u) APP_GID=$(id -g)`.

Verificar build, inicio, salud y una llamada real (`GET /api/v1/niches`):

```bash
make docker-verify
```

Mantenimiento (nunca borra volúmenes):

```bash
./scripts/docker-refresh.sh --build     # solo actualizar imágenes
./scripts/docker-refresh.sh --restart   # reconstruir y recrear web + API
./scripts/docker-refresh.sh --fresh     # reconstrucción completa sin caché
```

Los volúmenes `nexa-brief-data`, `nexa-brief-output`, `nexa-brief-accounts` y `nexa-brief-web-data` guardan
biblioteca, renders, credenciales cifradas y usuarios. **Esto los borra:** `docker compose down -v`.

## Acceder desde otra máquina (LAN / Tailscale)

En `nexa-brief-server/.env`:

```bash
CORS_ALLOW_ORIGIN_REGEX=^http://100\.[0-9.]+:3000$
```

En `nexa-brief-web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://<ip-del-servidor>:8000
ALLOWED_DEV_ORIGINS=<ip-del-servidor>
```

## Problemas comunes

| Síntoma | Causa / arreglo |
| --- | --- |
| `playwright install` dice que la distro no está soportada | `make setup` ya reintenta con los binarios de Ubuntu 24.04 (`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`). |
| El reproductor de una plantilla queda en negro | Faltan sus medios: `make media-pull`. |
| Login: `MissingSecret` | Falta `AUTH_SECRET` en `nexa-brief-web/.env.local`: `make setup` lo genera. |
| Error de CORS en el navegador | El origen de la web no está en `CORS_ALLOW_ORIGINS` / `CORS_ALLOW_ORIGIN_REGEX`. |
| La API usa mucha CPU sin hacer nada | `--reload` sin `--reload-dir src` vigila `output/` y `.venv/`. `make dev` ya lo limita. |

Más detalle: `CONTRIBUTING.md` (flujo de trabajo) y `nexa-brief-server/README.md` (API y arquitectura).
