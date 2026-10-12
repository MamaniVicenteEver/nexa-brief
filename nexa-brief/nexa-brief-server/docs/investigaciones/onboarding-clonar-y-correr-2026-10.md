# ¿Puede alguien nuevo clonar nexa-brief y correrlo? Estudio + plan (2026-10-11)

Alcance: `nexa-brief/nexa-brief-server` (API FastAPI) y `nexa-brief/nexa-brief-web` (Next.js), en local y
con Docker.

## Veredicto

**Hoy no.** Un clon limpio arranca, pero **le falta código** que el `.gitignore` deja fuera por error: la
Biblioteca da 500, los tests ni siquiera arrancan y la imagen Docker de la web no construye. Tampoco se puede
iniciar sesión sin pasos que no están documentados, y las plantillas no tienen sus audios ni videos.

La base es buena: dependencias con lockfile, build de producción de la web sin errores, imagen de la API
sana con healthcheck y usuario no-root. Los problemas se arreglan en su mayoría con **medio día de trabajo**.

## Cómo se probó

Se simuló a un integrante nuevo en el servidor `sever`:

1. `git clone` limpio del repo (commit `c1a08c4`) en `/tmp/fresh`.
2. Pasos del README: copiar los `.env.example`, `uv sync`, levantar la API, `pnpm install`, `pnpm build`, `pnpm lint`.
3. `docker compose build` + `up` con un nombre de proyecto aparte (`nexa-fresh`, puertos 8200/3200).
4. Llamadas reales a los endpoints y a las páginas. Al final se borró todo lo que creó la prueba.

| Paso | Resultado |
|---|---|
| `uv sync` (server) | ✅ 4 s, con lockfile |
| API local: `/health`, `/niches`, `/categories`, `/templates`, `/explainer/videos` | ✅ 200 |
| API local: `/api/v1/videos/jobs` (Biblioteca) | ❌ **500**: `No module named 'src.adapters.data'` |
| `pytest` en el clon | ❌ **no arranca**: error de colección por el mismo módulo |
| `pnpm install --frozen-lockfile` (web) | ✅ 16 s |
| `pnpm build` (web, producción) | ✅ sin errores de tipos |
| `pnpm lint` (web) | ⚠️ 3 errores + 1 aviso de Biome |
| `docker compose build` → imagen **web** | ❌ **falla**: corepack baja pnpm 12.11.2, incompatible con Node 22.14 |
| `docker compose build` → imagen **api** | ✅ 5,87 GB, `healthy` |
| Web en Docker (con pnpm fijado a mano) | ✅ 431 MB, `healthy`, `/login` 200 |
| Iniciar sesión | ❌ `MissingSecret`: `AUTH_SECRET` vacío y no hay usuarios |

---

## P0. Bloqueantes: sin esto, un clon no funciona

### 1. Código fuente atrapado por el `.gitignore`

`nexa-brief-server/.gitignore` tiene reglas sin anclar (`data/`, `output/`, `build/`) pensadas para las
carpetas de **datos** de la raíz, pero coinciden con **cualquier** carpeta de ese nombre, incluidas las de código:

| Regla | Atrapa por error | Qué se pierde |
|---|---|---|
| `data/` | `src/adapters/data/` (5 archivos) | **Todo el DataStore**: jobs, cola, Biblioteca, canales. 500 en la web; tests rotos. |
| `output/` | `src/skills/output/copy/` (9 archivos) | Las **estrategias de copys** (títulos/descripciones por red). Son los 13 tests "que ya fallaban": no eran tests rotos, faltaban estos archivos. |
| `build/` | `src/templates/_tools/{commercial,lyrics-sad,lyrics-mixtas,lyrics-grunge}/build/` (27 archivos) | Los **generadores** de las plantillas (`build.py`, `core.js`, `*.spec.json`). |

**Arreglo:** anclar las reglas a la raíz del server (`/data/`, `/output/`, `/build/`) y commitear esos 41 archivos.
Revisar también el `.gitignore` raíz del repo (`build/`, `output/`).

### 2. Docker de la web no construye

`package.json` no tiene `packageManager`, así que `corepack` baja la última versión de pnpm (12.11.2), que no
corre en Node 22.14.

**Arreglo:** `"packageManager": "pnpm@11.25.0"` (probado: la imagen construye y queda `healthy`). Con eso se puede
quitar el truco `pnpm install || true && pnpm approve-builds --all`, porque `allowBuilds` ya está en `pnpm-workspace.yaml`.

### 3. No se puede iniciar sesión

- `AUTH_SECRET` viene vacío en `nexa-brief-web/.env.example` → `MissingSecret`.
- Los usuarios viven en `nexa-brief-web/data/users.json` (ignorado, correcto). El alta normal es "solicitar
  acceso → email por Resend → aprobar", que en un clon nuevo no funciona sin una cuenta de Resend.
- Ya existe `pnpm seed:admin` (`scripts/seed-admin.mjs`), pero **no está en el README**.

**Arreglo:** el script de setup genera `AUTH_SECRET` y ejecuta `seed:admin`; documentarlo.

### 4. Las plantillas no traen sus medios

`*.mp3`, `*.mp4`, `*.wav` no van a git (bien: son ~3,6 GB). Pero no hay otra forma de conseguirlos, así que en un
clon los videos del explainer quedan en negro y las plantillas de NodeMotion no tienen fondo ni canción.
La web también usa `public/videos/sample-publication.mp4`, que está ignorado.

**Arreglo:** ver "Medios" en el plan (Fase 2).

---

## P1. Importante: funciona, pero confunde o se rompe fácil

| # | Problema | Arreglo |
|---|---|---|
| 5 | `.env.example` del server documenta 29 de las 60 variables que lee `settings.py` (faltan `CORS_ALLOW_ORIGINS`, `FRONTEND_URL`, `EXPLAINER_AGENT`, `SCHEDULE_*`, `REMOTION_*`, `HYPERFRAMES_*`, `AGENT_*`…). | Completar el `.env.example`, agrupado y marcando cuáles son obligatorias. |
| 6 | Cambios **sin commitear** en el servidor (Codex, `ACCOUNTS_JSON_B64`, formatos de grabación, `veryfast`, etc.). Algunos tienen valores fijos de esta máquina: regex de CORS `100.x` en `main.py`, IP en `allowedDevOrigins` de `next.config.ts`. | Commitear, pero con esos valores por variable de entorno (`CORS_ALLOW_ORIGINS`, `ALLOWED_DEV_ORIGINS`). |
| 7 | Versiones sin fijar: Node (no hay `.nvmrc` ni `engines`); en desarrollo se usa Node 26 y el Dockerfile usa 22.14. | `.nvmrc` + `engines` + `packageManager`; misma versión mayor en Docker y en desarrollo. |
| 8 | `playwright install chromium` falla en Ubuntu 26.04. | El setup usa `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` cuando haga falta (Docker no lo necesita: usa el Chromium del sistema). |
| 9 | Bug: `jamendo_adapter.py:81` usa `jamendo_tag` sin definir: cuando no encuentra canciones, explota con `NameError` en vez de `MusicFetchError`. | Definir la variable; agregar un test. |
| 10 | No hay CI (no existe `.github/workflows`). Nada impide que esto vuelva a pasar. | Ver Fase 4. |
| 11 | La copia de trabajo tiene `nexa-brief-server/` y `nexa-brief-web/` sueltos en la raíz del repo (sin archivos versionados) y un `README.md` raíz sin versionar. | Borrar esos restos; un README raíz que apunte a `nexa-brief/`. |
| 12 | `data/` (base de datos JSON de la app) es distinta en cada máquina. | Decisión pendiente (A: el servidor es la fuente de verdad / B: Postgres compartido). Para un integrante nuevo, empezar con `data/` vacía funciona: se crea sola. |

## P2. Calidad y estándares

- **Ruff:** está como dependencia pero sin configuración (`[tool.ruff]`). El código de la app tiene solo 2 avisos (incluido
  el bug #9); los 318 restantes son de los scripts compactos de `src/templates/_tools`. Configurarlo y excluir o
  formatear `_tools`.
- **Biome:** 3 errores en `PublicFooter.tsx` y 1 aviso en `AccountAvatar.tsx`.
- **Historial de git: 343 MB.** Sobre todo PNG (224 MB): capturas `work/sheet-*.png` de los demos de NodeHistory
  y carpetas `pruebas/`. Dejar de versionar `work/` (`work/.gitignore` ya lo pide); limpiar el historial con
  `git filter-repo` solo si el peso molesta (reescribe la historia: coordinar con el equipo).
- **Imagen de la API: 5,87 GB** (Chromium, ffmpeg, Remotion, faster-whisper, rembg/onnx). Aceptable; se puede
  achicar más adelante.
- Lo que **ya está bien**: `uv.lock` + `.python-version`, `pnpm-lock.yaml`, build multi-stage, usuarios no-root,
  volúmenes con nombre, healthchecks, `no-new-privileges`, `scripts/verify-docker.sh`, arquitectura hexagonal
  documentada, `AGENTS.md`/`CLAUDE.md`.

---

## Plan

### Fase 1: que el clon funcione (P0 + P1 rápidos) · ~medio día

1. Anclar las reglas de `.gitignore` y commitear `src/adapters/data`, `src/skills/output/copy` y `_tools/*/build`.
2. `packageManager`, `engines`, `.nvmrc`; simplificar el `Dockerfile` de la web.
3. Commitear los cambios del servidor, con CORS y `allowedDevOrigins` por variable de entorno.
4. Arreglar el bug de Jamendo y los errores de Biome.
5. Completar los `.env.example` (server y web).

**Hecho cuando:** en un clon limpio, `pytest` da 350/350, `/api/v1/videos/jobs` da 200 y `docker compose build` termina sin errores.

### Fase 2: medios de las plantillas · ~medio día

Los integrantes nuevos no tienen acceso SSH a tu PC, así que necesitan una fuente común:

- **Recomendado:** un bucket (Cloudflare R2 o S3) con `scripts/media.sh pull|push` que sincroniza
  `src/templates/**/{assets,render}` y `public/videos`. Funciona para cualquiera con una clave de solo lectura.
- **Mientras tanto:** usar el servidor como fuente (`rsync` desde `ever-server`, como se hizo el 2026-10-11) para
  quien tenga acceso por Tailscale.

**Hecho cuando:** después de `media pull`, los 4 videos de NodeTech se reproducen en la web.

### Fase 3: onboarding en un comando · ~medio día

Un `Makefile` (o `justfile`) en `nexa-brief/`:

| Comando | Qué hace |
|---|---|
| `make setup` | Copia los `.env.example`, genera `AUTH_SECRET` y `PUBLISHER_ENCRYPTION_KEY`, `uv sync`, Chromium de Playwright, `pnpm install`, `seed:admin`, `media pull`. |
| `make dev` | API (`--reload --reload-dir src`) + web. |
| `make test` / `make lint` | pytest + ruff / biome + tsc. |
| `make docker-up` | `docker compose up -d` + `verify-docker.sh`. |

Más un `CONTRIBUTING.md` (ramas, commits, PRs, cómo pedir las claves) y el README apuntando a `make setup`.

### Fase 4: que no vuelva a romperse · ~2 h

- **GitHub Actions** en cada PR: `ruff` + `pytest` (server), `biome` + `tsc` + `pnpm build` (web) y
  `docker compose build`. Con eso, el problema del `.gitignore` se habría visto en el primer PR.
- **pre-commit** con ruff y biome.

### Fase 5: decisiones aparte

- `data/`: opción A o B (ver P1 #12).
- Limpiar el historial de git (`git filter-repo`) y achicar la imagen de la API.

## Prueba de aceptación final

En una máquina limpia: `git clone` → `make setup` → `make dev` (o `make docker-up`) → iniciar sesión con el admin →
ver una plantilla de NodeTech reproduciéndose → grabar un preview de 10 s. Se repite en `/tmp/fresh` del servidor
después de cada fase.
