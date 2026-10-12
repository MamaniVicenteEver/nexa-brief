# Cómo trabajar en Nexa Brief

## Primer día

1. Pedí al equipo: acceso al repo, las claves del `.env` que necesites y, si vas a tocar plantillas, acceso
   SSH al servidor para `make media-pull`.
2. `make setup` y `make dev` (ver `README.md`).
3. `make check` tiene que pasar antes de empezar a cambiar nada.

## Ramas y commits

- Una rama por cambio, desde `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(web): casillas de formato al grabar`.
- Pull request a `main`. La CI (`.github/workflows/nexa-brief.yml`) corre ruff + pytest, biome + tsc + build y el
  build de Docker: tiene que quedar en verde.

## Antes de abrir el PR

```bash
make check     # ruff + biome + tsc + pytest
```

- Código nuevo con su test (`nexa-brief-server/tests/unit/`).
- Variable de entorno nueva → `Field(alias=…)` en `src/config/settings.py` **y** en `.env.example`, con un comentario.
- Nada de rutas absolutas, IPs ni datos de una máquina en el código: van al `.env`.

## Qué nunca va a git

- Secretos: `.env`, `.env.local`, `accounts.json`, `client_secret*.json`.
- Datos de la app: `nexa-brief-server/data/`, `output/`, `nexa-brief-web/data/`.
- Medios pesados (`*.mp3`, `*.mp4`, `*.wav`…): van por `make media-push`.
- Borradores de plantillas: `src/templates/**/work/`.

Los `.gitignore` anclan esas carpetas a la raíz de cada proyecto (`/data/`, `/output/`). Si creás una carpeta de
**código** llamada `data`, `output` o `build` y no aparece en `git status`, revisá
`nexa-brief-server/.gitignore`: ahí están las excepciones (`!src/adapters/data/`…).

## Arquitectura (backend)

Hexagonal: `src/core` (dominio y puertos) no conoce la infraestructura; `src/adapters` implementa los puertos
(IA, medios, grabación, publicación, datos) y `src/presentation` expone la API. Toda la persistencia pasa por el
DataStore (`src/adapters/data/README.md`).
