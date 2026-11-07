# Guía · manifest.json y publish.json

Cada video tiene `manifest.json` en su raíz (mismo espíritu que `output/<job>/manifest.json` del
backend). Lo arma `kit.py manifest <id>` a partir de los archivos del video + `publish.json`
(que escribe el agente en el paso 9). Se regenera cuantas veces haga falta.

| campo | origen |
|---|---|
| `video_id`, `design`, `design_name`, `channel` | config.json + design.json |
| `status` | `nuevo` → `en progreso` → `listo` (voz real + transcripción + ≥15 beats) → `renderizado` |
| `title`, `kicker`, `language`, `duration_seconds` | script.json + song.mp3 |
| `script` | segmentos, palabras y la curva tono/intensidad |
| `voice` | voz, modelos/claves usados por parte (sin las claves), ppm, control (faltan/sobran) |
| `transcript`, `storyboard` | palabras; beats, componentes usados y momentos de letra grande |
| `media` | líneas de CREDITS.md |
| `video_formats` | 9:16 (1080×1920) y 16:9 (1920×1080) con su archivo en render/ |
| `files` | archivos del video y su tamaño |
| `target_minutes`, `chapters` | script.json: duración objetivo y capítulos `[{at: "m:ss", title}]` (segmentos con `chapter`, tiempos de lyrics.json) |
| `youtube_title`, `youtube_description`, `youtube_tags`, `tiktok_caption`, `tiktok_hashtags`, `thumbnail_text` | `publish.json` |

## publish.json (lo escribe el agente)

```json
{
  "youtube_title": "La conferencia de prensa que derribó el Muro de Berlín",
  "youtube_description": "Gancho…\n\nContexto…\n\nSuscríbete a UNO CERO…\n\nIMÁGENES\n- …(créditos de CREDITS.md)",
  "youtube_tags": ["muro de berlin", "…"],
  "tiktok_caption": "Un papel mal leído cambió la historia. ¿Lo sabías?",
  "tiktok_hashtags": ["historia", "muroDeBerlin"],
  "thumbnail_text": "UN ERROR"
}
```

La descripción DEBE incluir los créditos de las imágenes CC BY / CC BY-SA y, si el video tiene
capítulos, el bloque `CAPÍTULOS` copiado de `manifest.chapters` (el primero en 0:00).

**Miniatura** (la de YouTube es una captura de la intro del diseño, la elige la persona antes de
grabar): A = `<diseño>.introv1` con `thumbnail_text`; B = `<diseño>.introv2` con `thumbnail_text`
y la foto `thumbnail_image` (archivo de `assets/media/`, la más reconocible del tema: un rostro o el
objeto del punto crítico) y opcional `thumbnail_image_side` (`auto` | `left` | `right`).

**Sin emojis** en ningún campo (títulos, descripciones, captions, hashtags, texto de miniatura): el
backend los borra igual antes de publicar, pero el texto tiene que leerse bien sin ellos.
