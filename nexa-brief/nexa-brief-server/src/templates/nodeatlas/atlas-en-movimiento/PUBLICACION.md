> PLANTILLA de brief (paso 12 de AGENTE.md). Copiar a `~/codex/nexa-brief/BRIEF-<ID>-publicacion.md`, sustituir <ID>/<TÍTULO>/rutas y lanzar:
> `EXTRA_ROOT=$EP ~/codex/nexa-brief/run-model.sh gpt-6.1-terra high <ID>-publicacion` (añadir la tarea a budgets.txt). Si Codex no está disponible: `claude-haiku-5-5` (roles.json).
> Revisar a ojo la salida; no ejecutar `build` sin decidirlo con el usuario.

# Tarea <ID>-publicacion · paquete de publicación v2 completo (Codex Terra 6.1, esfuerzo alto)

Episodio: `EP=/home/alfred/.local/share/nexa-brief/profiles/profesional/productions/nodeatlas/<ID>` (tienes permiso de escritura en `$EP`; no toques nada más). Sin MP4, sin render, sin commit, sin publicar.
Servidor del repo: `S=/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server`.
**Título del video (fijo, es la opción A): «<TÍTULO>».**

## Problema
El video ya está terminado (guion, voz, escena), pero su `publish.json` es un borrador plano y la web muestra «Faltan los textos de publicación».
Hay que escribir el paquete de publicación v2 COMPLETO: miniaturas (A/B/C), 3 títulos de YouTube + Facebook + TikTok, descripción en 9 bloques con capítulos, fuentes, créditos, tags y comentario fijado, con la estrategia **amarillista v1** (la de títulos `title_alarmista_v1`, narrativa `narrative_amarillista_v1`, nivel de título «alto»; la categoría es `node_atlas`).

## Lee, en este orden
1. `$S/src/skills/explainer/README.md`, `active.json`, `categories/node_atlas.json` y las estrategias en `$S/src/skills/explainer/strategies/` (`title/title_alarmista_v1.json`, `thumbnail/thumb_two_modes_v1.json`, `description/desc_nine_blocks_v1.json`, `platforms/platforms_v1.json`, `tags/tags_minimal_v1.json`, `pinned/…`, `gratitude/…`, `narrative/narrative_amarillista_v1.json` para los niveles de título).
2. El esquema: `$S/src/core/explainer/publishing/package.py` (campo desconocido = error), `checks.py` (qué se valida) y un paquete de ejemplo ya válido: `/home/alfred/.local/share/nexa-brief/profiles/profesional/productions/nodeatlas/atlas-en-movimiento/publish.json` y `…/nodeatlas/atlas-demo/publish.json`. Docs de fondo: `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/docs/investigaciones/titulos-gancho-categorias-node-2026-10.md`, `paquete-publicacion-node-2026-10.md`, `integracion-estrategias-explainer-2026-10.md`.
3. Fuentes de verdad del video: `$EP/assets/script.json` (texto y segmentos), `$EP/assets/lyrics.json` (tiempos reales de cada palabra → úsalos para los capítulos m:ss), `$EP/work/research/HECHOS.md` + `research.json` (ledger: **cada cifra con dígitos de títulos, miniaturas e intro debe estar en el guion o la transcripción**), `$EP/work/briefs/angulo.md`, `$EP/assets/media/credits.json` (créditos reales de las imágenes).

## Entregable
Escribe `$EP/publish.json` con `schema_version: 2` (reemplaza el borrador; guarda una copia del anterior como `publish.v1-borrador.json`).
- `category: "node_atlas"`, `preserve_opening: true` (el video conserva su intro nativa de Atlas; no queremos que se reemplace la apertura).
- **Miniaturas**: `text_only` (5–9 palabras, con `highlight`), `with_image` (2–5 palabras; imagen = un archivo REAL de `$EP/assets/media/` con crédito en credits.json — p. ej. `putin.jpg`, `zelenski.jpg`, `columnas.jpg`, `kiev-refugio.jpg`; revisa a ojo cuáles sirven y rellena `image_review` honesto), y `tabloid` (miniatura de alerta, estilo amarillista, imagen real). `chosen` = la mejor de las tres, y la elegida no debe repetir palabras de su título de pareja. `kicker` tipo «UCRANIA · 24 FEB 2022». Nada que no sea cierto (cifras disputadas rotuladas como tales; sin gore; sin acusaciones no documentadas).
- **Títulos**: 3 opciones de YouTube (A = el fijo de arriba; B y C con otras estrategias de gancho de las 10, ANCLA + TENSIÓN + DETALLE, nivel alto/amarillista pero verificable), `facebook` (título + primera línea) y `tiktok` (caption), con `chosen`.
- **Descripción**: los bloques `hook`, `context`, `chapters` (≥ 6 capítulos con tiempos m:ss reales según lyrics.json, el primero en 0:00), `reflection`, `question`; `gratitude` según estrategia.
- `sources`: fuentes reales del ledger (ONU, Kiel Institute, ISW, etc.) con su fecha; `credits`: créditos de las imágenes usadas, tal como están en credits.json (autor · licencia).
- `tags` (youtube, youtube_hashtags, tiktok, facebook) y `pinned_comment` (dato extra verificado + 2 preguntas) según las estrategias.
- Español neutro, **sin emojis**, sin muletillas.

## Validación (obligatoria)
Desde `$S`: `.venv/bin/python -m src.core.explainer.publishing check <ID>` hasta **0 errores** (los avisos explícalos). **NO ejecutes `build`** (cambia la apertura y borra renders): eso lo decide quien te revisa.
## Informe
`$EP/work/results/ucr2-publicacion.md`: AL INICIO lo que no pudiste cumplir; luego qué miniatura elegiste y por qué, la salida del `check`, y qué imágenes usaste.
