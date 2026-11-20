> PLANTILLA de brief (paso 10 de AGENTE.md; se lanza en el paso 5, en cuanto existe `lyrics.json`, en paralelo a escena y revisión). Copiar a `~/codex/nexa-brief/BRIEF-<ID>-publicacion.md`,
> sustituir `<ID>`, `<EP>`, `<TÍTULO>` y lanzar: `EXTRA_ROOT=<EP> ~/codex/nexa-brief/run-model.sh gpt-6.1-terra high <ID>-publicacion nodepolitics/<ID>` (añadir a budgets.txt).
> Si Codex no está disponible: `claude-haiku-5-5`. Revisar a ojo la salida; no ejecutar `build` sin decidirlo con el usuario.

# Tarea <ID>-publicacion · paquete de publicación v2 completo (Codex Terra 6.1, esfuerzo alto)

Episodio: `EP=<EP>` (permiso de escritura SOLO en `$EP`). Sin MP4, sin render, sin commit, sin publicar. Servidor: `S=/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server`.
**Título del video (fijo, es la opción A): «<TÍTULO>».**

## Problema
El guion, la voz y los tiempos existen, pero falta el paquete de publicación: la web muestra «Faltan los textos de publicación» mientras no esté completo.
Hay que escribir `publish.json` v2 COMPLETO con la estrategia **amarillista v1** (títulos `title_alarmista_v1`, nivel de título **medio**: provocador pero verificable, un resumen
de noticias no promete lo que no cuenta) y la categoría `node_politics`.

## Lee, en este orden
1. `$S/src/skills/explainer/README.md`, `active.json`, `categories/node_politics.json` y las estrategias de `$S/src/skills/explainer/strategies/` (`title/title_alarmista_v1.json`, `thumbnail/thumb_two_modes_v1.json`,
   `description/desc_nine_blocks_v1.json`, `platforms/platforms_v1.json`, `tags/tags_minimal_v1.json`, `pinned/…`, `gratitude/…`, `narrative/narrative_amarillista_v1.json` para los niveles de título).
2. El esquema: `$S/src/core/explainer/publishing/package.py` (campo desconocido = error), `checks.py`, y un paquete válido de ejemplo:
   `/home/alfred/.local/share/nexa-brief/profiles/profesional/productions/nodeatlas/atlas-en-movimiento/publish.json`.
3. Fuentes de verdad: `$EP/assets/script.json` (texto), `$EP/assets/lyrics.json` (tiempos reales por palabra: los capítulos m:ss salen de aquí),
   `$EP/work/research/HECHOS.md` + `research.json` (**toda cifra con dígitos en títulos, miniaturas e intro debe estar en el guion**), `$EP/assets/media/credits.json` (créditos reales).

## Entregable
`$EP/publish.json` con `schema_version: 2` (si hay un borrador, guárdalo como `publish.v1-borrador.json`). `category: "node_politics"`, `preserve_opening: true`.
- **Miniaturas**: `text_only` (5–9 palabras, con `highlight`), `with_image` (2–5 palabras; imagen = un retrato o foto REAL de `$EP/assets/media/` con crédito) y `tabloid`; `chosen` = la mejor y no repite palabras de su título de pareja.
- **Títulos**: 3 de YouTube (A = el fijo; B y C con otras estrategias de gancho, ancla + tensión + detalle, verificables), `facebook` y `tiktok`, con `chosen`.
- **Descripción**: bloques `hook`, `context`, `chapters` (**un capítulo por noticia**, tiempos m:ss reales de `lyrics.json`, el primero 0:00), `reflection`, `question`, `gratitude`.
- `sources` (las del ledger, con fecha) y `credits` (autor · licencia de cada imagen usada), `tags` (YouTube, hashtags, TikTok, Facebook; `#NodePolitics` obligatorio según la categoría) y `pinned_comment` (dato verificado extra + 2 preguntas).
- Español neutro, **sin emojis**, sin muletillas, sin prometer lo que el video no cuenta, sin repetir el título de otro video de la carpeta.

## Validación (obligatoria)
Desde `$S`: `.venv/bin/python -m src.core.explainer.publishing check <ID>` hasta **0 errores** (explica los avisos). Si `check` no encuentra el episodio porque no está registrado en el perfil,
dilo AL INICIO del informe y no lo registres. **NO ejecutes `build`.**

## Informe
`$EP/work/results/<ID>-publicacion.md`: AL INICIO lo que no pudiste cumplir; luego miniatura elegida y por qué, salida del `check` e imágenes usadas.
