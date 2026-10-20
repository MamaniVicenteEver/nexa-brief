# Guía · paquete de publicación (`publish.json` v2)

Para las categorías con perfil en `nexa-brief-server/src/skills/explainer/categories/` (hoy
**NodeTech**, `node_tech`) el paso 9 NO deja textos sueltos: escribe el **paquete v2**. Es lo que la
app muestra en el estudio («Títulos y metadatos»: antes de publicar, 3 títulos para Test & Compare,
miniaturas A/B, comentario fijado) y de donde salen la apertura del video, la miniatura y los textos
de YouTube, Facebook y TikTok.

**La miniatura elegida ES la apertura del video**: A (`<diseño>.introv1`, solo texto, por defecto) o
B (`<diseño>.introv2`, texto + foto). `build` la pone como beat 0 del storyboard (conserva su
`until`), y su captura es la miniatura de YouTube. En TikTok/Reels ese primer cuadro hace de título.
No hay un texto de intro aparte.

Las demás categorías siguen con
`guides/manifest.md` (v1) hasta tener perfil.

- Modelo exacto (campos, tipos, validaciones): `nexa-brief-server/src/core/explainer/publishing/package.py`.
- Reglas y límites (todas con números): `nexa-brief-server/src/skills/explainer/strategies/*/*.json`
  + el perfil de la categoría (`categories/node_tech.json`: anclas, estrategias de gancho preferidas,
  hashtags fijos). Fundamentos: `docs/investigaciones/paquete-publicacion-node-2026-10.md`.
- Ejemplo completo y aprobado: `src/templates/nodetech/apolo-1202/publish.json`.

## Cuándo y cómo

1. Después de `kit.py manifest` (ya existen la transcripción y `manifest.chapters` con los tiempos reales).
2. Reemplazar `publish.json` por el paquete (solo los campos de abajo; los campos planos
   `youtube_title`, `youtube_description`… NO se escriben a mano: los genera el build).
3. Construir y validar (desde `nexa-brief-server/`):
   ```bash
   .venv/bin/python -m src.core.explainer.publishing build <video-id>   # deriva publish.json, abre el video con la miniatura elegida, manifest y portada
   .venv/bin/python -m src.core.explainer.publishing check <video-id>   # 0 errores
   ```
   `build` pone la miniatura elegida como apertura (beat 0) y como título del guion, y borra los
   renders viejos si la apertura cambió (la persona puede cambiar A/B en la app antes de grabar).

## Campos (resumen; el detalle y los rangos están en las estrategias)

| campo | qué va | reglas que valida `check` |
|---|---|---|
| `schema_version`, `category` | `2`, `"node_tech"` | |
| `thumbnail.text_only` | `lines` (2–3 renglones, ≤ 18 caracteres), `highlight` (palabra dentro de UN renglón), `pair_title` | 5–9 palabras; no repetir palabras de ≥ 4 letras de su título de pareja |
| `thumbnail.with_image` | `text` (2–5 palabras), `image` (archivo de `assets/media/`), `composition`, `pair_title`, `image_side` (`auto`/`left`/`right`), `image_review` (por qué esa foto) | **obligatoria** (las dos opciones tienen que existir); la foto existe y tiene crédito en CREDITS.md; criterios en `thumb_two_modes_v1.json` |
| `thumbnail.chosen` | `text_only` (por defecto) o `with_image`: la que abre el video (la persona la puede cambiar en la app) | |
| `thumbnail.kicker` | antetítulo de las dos (lugar · fecha), p. ej. `APOLO 11 · 20 JUL 1969` | sin emojis; cifras del guion |
| `titles.youtube` | 3 opciones `A`/`B`/`C`: `text` (≤ 60 caracteres, lo clave en 40), `strategy` (1–10 de `title_anchor_tension_v1.json`), `emotion` | emociones distintas; cada cifra está en el guion |
| `titles.facebook` | `title`, `first_line` (≤ 125) | |
| `titles.tiktok.caption` | ≤ 150 caracteres | |
| `description` | `hook`, `context`, `chapters` (`[{at, title}]` copiados de `manifest.chapters`), `reflection`, `question`, `gratitude` (G1–G4 o vacío), `gratitude_topic` | ≥ 3 capítulos, el primero 0:00, ≥ 10 s entre capítulos; la descripción armada ≤ 5000 |
| `sources` | URLs de PLAN §3 (las principales) | no vacío |
| `credits` | líneas de CREDITS.md | no vacío |
| `tags` | `youtube` (10–13, ≤ 500 caracteres), `youtube_hashtags` (3), `tiktok` (3–4), `facebook` (2) | hashtags fijos de la categoría (`#NodeTech`, `#sabiasque`, `#Tecnología`); sin `#fyp`/`#viral` |
| `pinned_comment` | «Dato extra: …» + 2 preguntas: una sobre el tema (más amplia que el video) y otra sobre qué otro tema quieren ver o escuchar. Natural, como escrito a mano (`strategies/pinned/`) | empieza con «Dato extra:», 2 preguntas al final, ≤ 420 caracteres, sin «Gracias por…», cifras del guion |

**Sin emojis** en ningún texto. Toda cifra con dígitos (títulos, miniaturas, antetítulo, Facebook,
TikTok) tiene que estar en el guion: `check` lo controla.
