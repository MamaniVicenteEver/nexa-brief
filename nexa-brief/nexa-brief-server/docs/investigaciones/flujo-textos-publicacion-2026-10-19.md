# Flujo de textos de publicación y miniaturas (reconstruido 2026-10-19)

El disco del servidor murió y se perdieron los `publish.json` de NodeMotion y los paquetes v2 de
NodeHistory (nunca estuvieron en git). El código y las estrategias sí están en el repo. Este documento
es el flujo de referencia: un ejemplo hecho a mano por categoría y los criterios para hacer el resto.

Reglas: sin `git commit`/`push`; no leer `.env`, `accounts.json`, `client_secret*.json`, `users.json`
ni tokens; no publicar ni grabar; **no editar ningún `.py` bajo `src/`** (uvicorn `--reload` reinicia y
corta lo que esté corriendo); no inventar datos: todo hecho, fecha, nombre o fuente sale de los
archivos del video.

## 1. NodeMotion · «Video original» de cada plantilla

Ejemplo hecho: `lyrics-caution` → `src/templates/nodemotion/lyrics/lyrics-caution/publish.json`.

Cómo se hace (la API ya corre en `http://127.0.0.1:8000`):

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/templates/<id>/original-draft \
     -H 'Content-Type: application/json' -d '{}'            # devuelve draft_id
curl -s http://127.0.0.1:8000/api/v1/drafts/<draft_id>     # repetir hasta status "prepared" (o "failed")
```

Importa la canción y el fondo de la plantilla, genera con IA los textos de YouTube, TikTok, Facebook
e Instagram según `src/skills/output/copy/active.json` (estrategias en `strategies/`, tono en
`voice*.md`) y los guarda en el `publish.json` de la plantilla. Con `{"song_notes": "..."}` se
reescriben desde cero con esa información.

Criterios de un buen resultado (mirar el `details` del draft):
- YouTube: título con pregunta o tensión ligada al tema de la canción + `| Artista (Letra)`; nada
  genérico ni clickbait; descripción con gancho, pregunta, invitación al diseño, créditos y hashtags;
  10–15 tags; `pinned_comment` (el primer comentario) presente.
- TikTok/Facebook/Instagram: gancho corto + pregunta, `Canción – Artista`, 3–4 hashtags.
- Canción y artista correctos (si la IA no los identifica, quedan mal: reportarlo, no inventar).
- Si un texto queda flojo: volver a pedirlo con `song_notes` que describan la canción (de qué trata
  la letra, sacado de `assets/lyrics.json`).

## 2. NodeHistory / NodeTech · paquete v2 + miniaturas A/B

Ejemplos: NodeTech (los 4 videos ya en v2) y `nodehistory/muro-de-berlin` (rehecho hoy desde el texto
publicado en YouTube). Formato y estrategias: `src/skills/explainer/` (`active.json`, `strategies/*`,
`categories/node_history.json`). Validador y armado:

```bash
.venv/bin/python -m src.core.explainer.publishing check <video_id>   # 0 errores obligatorio
.venv/bin/python -m src.core.explainer.publishing build <video_id>   # deriva textos y apertura
curl -s -X POST http://127.0.0.1:8000/api/v1/explainer/videos/<video_id>/thumbnails   # captura A/B
```

**Atención:** `build` cambia la apertura del video a la miniatura elegida y **borra los renders**
(`render/*.mp4`). Antes de correrlo, si el video tiene `render/*.mp4`, parar y avisar.

Piezas del paquete (ver `muro-de-berlin/publish.json` y `nodetech/vago-pero-emocionante/publish.json`):
- `thumbnail.text_only` (5–9 palabras, 2–3 renglones, ≤18 caracteres) y `with_image` (2–5 palabras +
  una imagen de `assets/media/` revisada con los 10 criterios, con `image_review`). Cada miniatura
  forma pareja con un título y **no repite sus palabras** (≥4 letras).
- `titles.youtube`: 3 opciones (A/B/C) con estrategia (preferidas por categoría) y emoción;
  Facebook (título + primera línea ≤125) y TikTok.
- `description`: gancho, contexto, capítulos `m:ss` reales (tiempos del `manifest.json`/storyboard),
  reflexión, pregunta, agradecimiento (variante de `gratitude_rotation_v1`).
- `sources`: URLs reales del `PLAN.md`/guion del video. `credits`: del `assets/media/CREDITS.md`.
- `tags`: 10–13 de YouTube, hashtags de la categoría (`#NodeHistory`, `#historia`, `#Historia`).
- `pinned_comment`: «Dato extra: …» (un dato verdadero del video que no esté en la descripción) +
  dos preguntas, la segunda sobre qué otro tema quieren ver.
- El `publish.json` v1 anterior tiene título, tags y TikTok útiles como punto de partida.

Después de `build` y la captura, mirar `render/thumbnail-A.jpg` y `-B.jpg`: texto legible, sin cortes.
