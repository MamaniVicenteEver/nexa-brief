# Nichos — Referencia completa

> Catálogo de los 10 nichos definidos en `niches.json` (raíz del proyecto): fuente de
> entrada (API), flujo de pipeline, dependencias, plantilla usada, y dónde queda
> cada log/artefacto de salida. Complementa a `docs.md` (arquitectura general) y
> `docs/video-recording-pipeline.md` (cómo graba el recorder).

---

## 1. Cómo se lee este documento

Cada nicho tiene una ficha con:

- **Tipo de pipeline** — `config_driven_template` (plantilla estática + `config.json`
  generado por IA) o `freeform_html` (IA genera el HTML completo desde cero).
- **Entrada (API)** — qué mandar en `POST /api/v1/videos` (JSON) o
  `POST /api/v1/videos/upload` (multipart) para este nicho en particular.
- **Flujo (stages)** — el orden real de `src/core/pipeline.py` para ese nicho
  (varía según `pipeline_type`/`skip_visual_design`/`template.requires_*`).
- **Plantilla** — carpeta en `src/templates/<id>/`, sus prompts y qué campos de
  `config.json` fuerza Python (no confía en que la IA los copie bien).
  Solo aplica a nichos `config_driven_template`.
- **Dependencias** — qué necesita este nicho puntualmente además del stack base.
- **Salida** — archivos en `output/{job_id}/` y qué campo del `manifest.json`
  final los referencia.
- **Logs** — qué se escribe en `output/{job_id}/logs/` durante la corrida.

### 1.1 Fuente de verdad y listado en vivo

`niches.json` es la única fuente de verdad — este documento es una foto de su
contenido al momento de escribirlo. Para el listado actual en vivo (id,
`display_name`, `pipeline_type`, `active`):

```
GET /api/v1/niches            # todos
GET /api/v1/niches/{niche_id} # uno solo
```

### 1.2 Stack común a TODOS los nichos (independiente de cuál se use)

| Pieza | Uso |
|---|---|
| **FastAPI** | expone `POST /videos`, `POST /videos/upload`, `GET /niches`, `GET /library/*` |
| **Gemini** (`settings.gemini_model`) | `analysis_model` — Stage 1 (análisis/queries), Vision Extractor (Prompt 1), validación de imágenes, `result_summarizer` |
| **DeepSeek** (`settings.deepseek_model`) | `codegen_model` — Config Mapper (Prompt 2) o generación de HTML libre |
| **Playwright + Chromium headless** | graba el visualizador HTML a `.webm` (`src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py`) |
| **FFmpeg/ffprobe** | mezcla audio, escala, recorta, mide duración — dependencia de sistema (no Python) |
| **`data/image_library/`, `data/music_library/`, `data/video_library/`** | librería local JSON-indexada (no DB) — todo recurso usado, buscado o provisto por el usuario queda archivado acá para reusar |
| **`asset_library.py`** | capa de acceso a esa librería — `register_*`/`resolve_*_path`/caches de visión y letras |

Cada Job corre bajo el `Orchestrator` (semáforo `settings.max_parallel_jobs`) y
termina en `output/{job_id}/` con `logs/` adentro.

---

## 2. Nichos `config_driven_template` (plantilla estática + `config.json` por IA)

Comparten este esqueleto de pipeline (con 2 variantes, ver más abajo):

```
input_analyzer → resource_fetcher → [visual_designer | lyrics_transcriber] →
prompt_architect → html_generator → video_recorder → result_summarizer → packager
```

`resource_fetcher` corre **antes** que el análisis (a diferencia de los nichos
`freeform_html`) porque el análisis necesita el recurso real ya descargado
(imagen, video o canción) — no hay nada que analizar todavía en Stage 1.

### 2.1 `image_bg_portrait` — Imagen con Fondo (Retrato)

| | |
|---|---|
| **Plantilla** | `src/templates/01-image-bg/` |
| **Concepto** | Sujeto/personaje central con fondo tratado (sólido / 2 colores / difuminado) + 2 palabras posicionadas automáticamente según el análisis real de la imagen |
| **Orientación nativa** | 9:16 |

**Entrada (API):**
- `category_name: "image_bg_portrait"`
- `image_source` — `auto` (busca stock) / `library` (asset_id) / `url`
- `music_source` — igual, `auto`/`library`/`url`
- `song_info` opcional (`song_name`, `artist`, `topic`, `description`) — si se
  da, `input_analyzer` lo usa como hecho autoritativo (nunca lo inventa)
- `duration_config` opcional (`mode: auto|manual`)

**Flujo:** `input_analyzer → resource_fetcher → visual_designer (Vision
Extractor) → prompt_architect (Config Mapper) → html_generator → video_recorder
→ result_summarizer → packager`

**Prompts:** `prompts/vision_extractor.md` (Prompt 1, analiza `bg.jpg` real:
color, `bgMode`, zonas de texto, texto incrustado a evitar) →
`prompts/config_mapper.md` (Prompt 2, solo mapea ese JSON a `config.json`,
nunca HTML).

**Forzado en Python (`html_generator.py`)**, no confiado a la IA:
`img.w/h` (desde `vision_analysis.image_dimensions`, NO desde el archivo real
— ambos deben compartir el mismo sistema de coordenadas que usó Gemini para
`zones`/`subject`/`keepOut`), `img.src="bg.jpg"`, `audio.src="song.mp3"`.

**Grabación:** `reels` (9:16, `loop`, 25s + `use_device_viewport`) + `youtube`
(16:9, `loop`, 25s). Sin clip TikTok (`generate_tiktok_clip: false`).

**Dependencias específicas:** ninguna además del stack común.

**Salida en `output/{job_id}/`:** `index.html`, `bg.jpg`, `song.mp3`,
`config.json`, `reels_video.mp4`, `youtube_video.mp4`, `manifest.json`.

**Logs (`logs/`):** `01_input_completado.json`, `01a_song_info_usuario.json`
(si vino), `01b_search_queries.json` (si el recurso es `auto`),
`02_vision_extraction.json`, `03_prompt_generacion.txt`,
`04_config_generado.json`, `05_imagen_seleccionada.json`,
`05b_validacion_imagenes.json` (si `image.validation.enabled`),
`05c_duracion_resuelta.json` (si vino `duration_config`),
`06_musica_seleccionada.json`, `07_grabacion_stats.json`,
`08_resumen_final.json`.

---

### 2.2 `subject_spotlight` — Subject Spotlight (Recorte PNG)

| | |
|---|---|
| **Plantilla** | `src/templates/subject-spotlight/` |
| **Concepto** | Sujeto recortado (PNG con canal alfa real) centrado sobre fondo de color diseñado por IA, palabra gigante detrás, levitación + partículas |
| **Orientación nativa** | cualquiera (depende del recorte) |

**Entrada (API):** igual estructura que `image_bg_portrait`, pero
**`image_source` debe ser `library`/`url` (nunca `auto`)** — no existe
proveedor de stock que devuelva recortes con transparencia real; hay que subir
el PNG (por archivo en `/videos/upload` o por URL).

**Flujo:** idéntico al esqueleto de §2 (con `visual_designer`).

**Prompts:** `prompts/vision_extractor.md` (analiza el PNG: identidad del
sujeto, `crop_state`/`alignment`/`scale`, zonas por canal alfa, diseño de
fondo, palabra gigante, partículas) → `prompts/config_mapper.md`.

**Forzado en Python:** `subject.w/h` (desde `vision_analysis.image_dimensions`),
`subject.src="subject.png"` (⚠️ PNG, no jpg — necesita el canal alfa),
`audio.src="song.mp3"` (aunque el motor no reproduce audio en página — es
metadata muerta que igual se puebla, ver nota abajo).

**Campos muertos (documentados a propósito, no bug):** `intro`/`outro`/`audio`
existen en `config.json` pero ningún `index.html` los renderiza hoy — quedan
como metadata forward-compatible.

**Grabación:** `reels` (9:16, `loop`, `use_device_viewport`) + `youtube` (16:9,
`loop`). Sin clip TikTok.

**Dependencias específicas:** el usuario debe proveer el PNG con transparencia
real — no hay validación automática de que el archivo tenga canal alfa.

**Salida:** `index.html`, `subject.png`, `song.mp3`, `config.json`,
`reels_video.mp4`, `youtube_video.mp4`, `manifest.json`.

**Logs:** mismo set que §2.1 (con `05_imagen_seleccionada.json` reflejando
`local_path: "subject.png"`).

---

### 2.3 `landscape_scene_ambient` — Escena de Paisaje Viva

| | |
|---|---|
| **Plantilla** | `src/templates/living-landscape/` |
| **Concepto** | Paisaje pintado completo (acuarela/tinta/gouache) a pantalla completa, pétalos/hojas cayendo en 3 capas, niebla, nubes, aves, luciérnagas opcionales, estrellas fugaces, texto poético en la zona calma |
| **Orientación nativa** | cualquiera |

**Entrada (API):** `image_source` puede ser `auto` (foto/pintura de paisaje
normal, sí hay proveedores de stock razonables) o `library`/`url`.
`music_source` igual que siempre.

**Flujo:** idéntico al esqueleto de §2.

**Prompts:** `prompts/vision_extractor.md` (inventario de escena, punto focal,
paleta de 5 colores con rol fill/stroke/vein, bioma y energía física de
partículas, zona calma + orientación de texto, corredor de aves, ritmo
tipográfico) → `prompts/config_mapper.md`.

**Forzado en Python:** `img.w/h`, `img.src="bg.jpg"`, `audio.src="song.mp3"`.

**⚠️ Nota de implementación (única entre las plantillas):** el `index.html`
original del prototipo NO hacía `fetch("config.json")` — usaba un objeto
embebido en el `<script>`. Se forkeó con un parche real (`fetch()` con
`await` a nivel de módulo + fallback al objeto embebido si falla) — verificado
con un smoke test real de Playwright. Sin este parche, el motor ignoraría
`config.json` por completo.

**Audio real en página:** a diferencia de `01`/`02`, este motor SÍ reproduce
`<audio>` de verdad con Web Audio API (los pétalos/aves reaccionan al bajo) —
arranca solo en `DOMContentLoaded` (el recorder lanza Chromium con
`--autoplay-policy=no-user-gesture-required`, no necesita gesto real).

**Grabación:** `reels` (9:16, `loop`, `use_device_viewport`) + `youtube` (16:9,
`loop`). Sin clip TikTok.

**Dependencias específicas:** ninguna además del stack común.

**Salida:** `index.html`, `bg.jpg`, `song.mp3`, `config.json`,
`reels_video.mp4`, `youtube_video.mp4`, `manifest.json`.

**Logs:** mismo set que §2.1.

---

### 2.4 `motion_backdrop_showcase` — Fondo en Movimiento (Video)

| | |
|---|---|
| **Plantilla** | `src/templates/motion-backdrop/` |
| **Concepto** | Video en loop (sujeto en movimiento sutil o fondo animado) a pantalla completa con recorte/rotación adaptable, 2 palabras flanqueando el sujeto (o apiladas en móvil), ecualizador reactivo al audio |
| **Orientación nativa** | cualquiera |

**Única plantilla que usa un VIDEO de fondo, no una imagen** — `template.requires_image=false`, `template.requires_video=true`. Necesitó un subsistema propio (Fase 3 de la integración):

**Entrada (API):**
- `video_source` (**nuevo campo**, obligatorio para este nicho) — `library`
  (asset_id de `data/video_library/`) o `url`. **No existe `type: "auto"`** —
  no hay proveedor de stock de video integrado, se rechaza explícitamente.
- En `/videos/upload`: campo `video_file` (multipart).
- `image_source` no aplica (el nicho no resuelve imagen).
- `music_source` igual que siempre.

**Flujo:** `input_analyzer → resource_fetcher (resuelve VIDEO, no imagen; extrae
un frame representativo con ffmpeg) → visual_designer (Vision Extractor sobre
ese frame) → prompt_architect → html_generator → video_recorder →
result_summarizer → packager`.

**Prompts:** `prompts/vision_extractor.md` (v10 — análisis del frame:
calibración de color de fondo con protocolo estricto de muestreo,
topología del fondo en regiones, sujeto con margen de movimiento +12%,
tipografía segura, texto incrustado a evitar) → `prompts/config_mapper.md`
(v11 — mapea a UN objeto "caso").

**`config.json` es una COLECCIÓN**, no un objeto único —
`{"activeId": "active", "configs": [caso]}` (mismo patrón que usa
internamente el motor `index.html`, que hace `fetch("config.json")` y elige
por `id`). El pipeline siempre escribe un único caso con `id="active"`, y el
`index.html` forkeado tiene `ACTIVE_ID = "active"` fijo (`wrap_as_case_collection: true`).

**Forzado en Python:** `video.w/h` (desde `vision_analysis.image_dimensions`,
dimensiones del ARCHIVO real, no del frame), `video.src="bg.mp4"`,
`audio.src="song.mp3"`, `id`/`activeId` forzados a `"active"`.

**Cache de visión:** separado del de imágenes — `data/video_library/_vision_cache/{asset_id}.json`
(`asset_library.get_video_vision_cache`/`save_video_vision_cache`), NO se
reusa el cache de `image_library` aunque comparten el mismo schema de salida.

**Rotación:** a diferencia de imagen, el video NUNCA se re-codifica físicamente
— la rotación es un dato (`video.rotation`) que el motor aplica en runtime vía
CSS (re-encodear video es lento y con pérdida).

**Grabación:** `reels` (9:16, `loop`, `use_device_viewport`) + `youtube` (16:9,
`loop`). Sin clip TikTok.

**Dependencias específicas:** `ffmpeg`/`ffprobe` para extraer el frame +
medir resolución/fps/duración del video (mismo binario que ya usa el
recorder, sin dependencia Python nueva).

**Salida:** `index.html`, `bg.mp4`, `song.mp3`, `config.json`,
`reels_video.mp4`, `youtube_video.mp4`, `manifest.json`.
`manifest.json["background_video"]` referencia `asset_id`/`path`
(`data/video_library/...`)/`label`/`provider`.

**Logs:** `01_input_completado.json`, `01a_song_info_usuario.json` (si vino),
`05b_video_seleccionado.json` (equivalente al `05_imagen_seleccionada.json`
de los demás), `00_video_frame.jpg` (frame extraído, dentro de `logs/`),
`02_vision_extraction.json`, `03_prompt_generacion.txt`,
`04_config_generado.json`, `06_musica_seleccionada.json`,
`07_grabacion_stats.json`, `08_resumen_final.json`. **No** hay
`05_imagen_seleccionada.json` (este nicho no resuelve imagen).

---

### 2.5 — 2.7 Familia `lyrics_video_*` — Video de Letras (neon / impacto / romántico)

Los 3 comparten TODO el mecanismo, solo cambia la plantilla visual — se
documentan juntos.

| Nicho | Plantilla | Concepto visual |
|---|---|---|
| `lyrics_video_neon` | `src/templates/lyrics-neon/` | Letreros de tubo neón que se encienden letra por letra, columnas escalonadas, cámara impredecible, foto nocturna con grano/viñeta |
| `lyrics_video_impact` | `src/templates/lyrics-impact/` | Corrido/trap: una palabra gigante + palabras chicas en tinta roja condensada itálica, reveal estampado frase por frase, barras de cine |
| `lyrics_video_romantic` | `src/templates/lyrics-romantic/` | Carta escrita a mano — serif itálica + cursiva que se escriben carácter a carácter, bokeh cálido, pulso tipo latido |

**La familia más distinta del resto — sin análisis de imagen, con transcripción
real de la canción:**

- `template.requires_vision_extraction: false` — no hay Vision Extractor, no
  hay Prompt 1. Solo hay `prompts/config_mapper.md` (un único prompt,
  "estilo forzado" — cada nicho ya sabe qué plantilla usa, la IA no elige
  estilo, solo arma `intro`/`outro`/paleta/branding).
- `template.requires_lyrics: true` — en el lugar del Vision Extractor corre
  **`lyrics_transcriber`**, un stage nuevo.
- `video.duration_locked_to_music: true` — el pipeline **ignora cualquier
  `duration_config` del request** y fuerza `mode=auto, repeat_count=1`: la
  letra tiene que durar EXACTAMENTE lo que dura la canción real, nunca un
  valor manual ni un loop corto.
- `generation_method: "rerecord"` siempre (nunca `"loop"` — cortaría la letra
  a mitad de canción).

**Entrada (API):**
- `music_source` — **debe ser `library`/`url`, nunca `auto`** (no se bloquea a
  nivel de código, pero música de stock instrumental no tiene letra real que
  transcribir — está documentado en `search_instructions.music` de cada nicho).
- `song_info.language` (**campo nuevo**, código ISO como `"es"`/`"en"`) — le
  dice a la transcripción qué idioma esperar; si se omite, se auto-detecta.
- En `/videos/upload`: nuevo campo `language` (Form).
- `image_source` opcional, sí puede ser `auto` — es solo un fondo tratado con
  filtro CSS, nunca se analiza (`requires_image` sigue en `true` pero
  `media_dimension_key: null`, o sea sin forzado de dimensiones).

**Flujo:** `input_analyzer → resource_fetcher (resuelve imagen opcional + LA
CANCIÓN REAL) → lyrics_transcriber → prompt_architect (prompt sin Vision JSON)
→ html_generator → video_recorder (duración = canción real, rerecord) →
result_summarizer → packager`.

**`lyrics_transcriber` (`src/modules/lyrics_transcriber.py`):**
1. Busca cache por `music_asset_id` en `data/music_library/_lyrics_cache/{asset_id}.json`
   (`asset_library.get_lyrics_cache`).
2. Si no hay cache, llama al puerto `LyricsTranscriptionPort`
   (`src/adapters/lyrics/factory.py::get_lyrics_transcriber()` → hoy siempre
   `FasterWhisperAdapter`, aislado para poder cambiar a un servicio externo
   sin tocar el resto del pipeline).
3. Guarda el resultado en cache y escribe `output_dir/lyrics.json`.

**Dedup por nombre al subir una canción** (`POST /videos/upload`): si
`song_name`(+`artist`) coincide (normalizado) con una canción ya archivada
(`asset_library.find_music_by_name`), se reusa esa entrada — evita duplicar el
archivo Y evita retranscribir (el cache ya existe bajo ese `asset_id`).

**Adaptador de transcripción** (`src/adapters/lyrics/infrastructure/faster_whisper_adapter.py`):
`faster-whisper`, modelo `large-v3`, `device="cpu"`, `compute_type="float32"`
(configurable vía `settings.whisper_model/whisper_device/whisper_compute_type`),
sin VAD (`vad_filter=False` — el VAD de Silero está afinado para voz hablada,
no cantada, y descarta tramos reales), escalera de `temperature` para
reintentar tramos difíciles. Corre en `asyncio.to_thread` (bloqueante/CPU-bound).
**Lento la primera vez** (varios minutos por canción en CPU) — el cache hace
que esto pase UNA sola vez por canción real, no por cada video.

**`config.json` es una COLECCIÓN** `{"activeId": "active", "configs": [caso]}`
— mismo patrón que `motion_backdrop_showcase` (`wrap_as_case_collection: true`).

**Forzado en Python:** `audio.src="song.mp3"`, `lyricsUrl="lyrics.json"`,
`bg.src="bg.jpg"` (si el caso trae un campo `bg.src`), `id`/`activeId`
forzados a `"active"`.

**`lyrics.json`** consumido directamente por cada `index.html` vía
`fetch(C.lyricsUrl)` — schema Whisker/word-level:
```
{"metadata": {...}, "segments": [{"words": [{"word","start","end","probability"}, ...]}]}
```
El timing de la letra se maneja con `audio.currentTime` real (con fallback a
reloj de pared por `requestAnimationFrame` si el audio no suena) — el outro
se dispara con el final REAL del audio (`audio.ended`), nunca con un timer fijo.

**Grabación:** un único formato `reels` (9:16, `rerecord`,
`use_device_viewport`). Sin clip TikTok.

**Dependencias específicas:** `faster-whisper` (nueva dependencia en
`pyproject.toml`) + su backend `ctranslate2`; primera vez descarga el modelo
`large-v3` (~2.9 GB) a caché local de Hugging Face.

**Salida:** `index.html`, `bg.jpg`, `song.mp3`, `config.json`, `lyrics.json`,
`reels_video.mp4`, `manifest.json`.

**Logs:** `01_input_completado.json`, `01a_song_info_usuario.json` (si vino),
`02_lyrics_transcripcion.json` (**en vez de** `02_vision_extraction.json`),
`03_prompt_generacion.txt`, `04_config_generado.json`,
`05_imagen_seleccionada.json` (si se resolvió imagen de fondo),
`05c_duracion_resuelta.json` (**siempre** presente — `duration_locked_to_music`
fuerza `duration_config`), `06_musica_seleccionada.json`,
`07_grabacion_stats.json`, `08_resumen_final.json`.

---

## 3. Nichos `freeform_html` (retirados, `active: false`)

`ambient_music` y `animated_study` — la IA (DeepSeek) genera el HTML/CSS/JS
completo desde cero en cada corrida (sin plantilla estática). Se marcaron
`active: false` porque el flujo config-driven los reemplaza — se conservan
como referencia histórica, ya no seleccionables. Sus `skills/` de diseño
(`src/skills/genres/*.md`, `src/skills/html/html_design.md`) fueron borrados
en la ronda de limpieza previa; el código de `visual_designer.py`/
`prompt_architect.py` tiene fallback a string genérico si el skill no existe
en disco, no crashea.

`economy_finance` — nunca implementado del todo, sigue `active: false` como
placeholder a futuro.

Su flujo (cuando estaban activos): `input_analyzer → visual_designer (diseño
abstracto, IA elige género/paleta/animación SIN ver ninguna imagen todavía) →
resource_fetcher → prompt_architect → html_generator (HTML completo por IA) →
video_recorder → result_summarizer → packager`. Nótese el orden: acá
`visual_designer` corre ANTES que `resource_fetcher` — al revés que en
`config_driven_template`, porque no necesita ninguna imagen real para diseñar.

---

## 4. `manifest.json` — el resumen final de cada job

Escrito por `packager.py` al final de CADA nicho (`output/{job_id}/manifest.json`):

```jsonc
{
  "job_id", "category", "niche_id", "niche_display_name", "pipeline_type",
  "genre",              // niche_cfg.metadata.genre (curado) o analyzed_input.genre (fallback)
  "style", "duration_seconds",
  "youtube_title", "youtube_description", "youtube_tags",
  "tiktok_caption", "tiktok_hashtags",
  "video_formats": [...],           // copia de niche_cfg.video.formats
  "files": { "<filename>": "<tamaño en bytes>" },
  "image": { "asset_id", "path", "label", "provider", "photographer" } | null,
  "music": { "asset_id", "path", "track_name", "artist", "genre", "provider" } | null,
  "background_video": { "asset_id", "path", "label", "provider" } | null,  // solo motion_backdrop_showcase
  "template_id"                     // solo pipeline_type=config_driven_template
}
```

`image`/`music`/`background_video` se leen FRESCOS de la librería local en el
momento de empaquetar (no de lo que se resolvió en Stage 3) — importante para
`image.label`, que `visual_designer` recién escribe DESPUÉS de
`resource_fetcher` (el Vision Extractor corre entre medio). `path` es relativo
a la raíz del proyecto (ej. `"data/image_library/portrait_subjects/4576562b.jpg"`),
resoluble por cualquier cliente con acceso al mismo filesystem — el archivo
real nunca se duplica dentro de `output/{job_id}/`.

---

## 5. Índice rápido de logs por número

| Archivo en `logs/` | Quién lo escribe | Cuándo aparece |
|---|---|---|
| `00_video_frame.jpg` | `resource_fetcher.py` | solo `motion_backdrop_showcase` |
| `01_input_completado.json` | `input_analyzer.py` | siempre |
| `01a_song_info_usuario.json` | `input_analyzer.py` | si vino `song_info` en el request |
| `01b_search_queries.json` | `input_analyzer.py` | si el nicho tiene `search_instructions` y algún source es `auto` |
| `02_diseno_visual.json` | `visual_designer.py` | solo nichos `freeform_html` (diseño abstracto) |
| `02_vision_extraction.json` | `visual_designer.py` | nichos config-driven con `requires_vision_extraction=true` |
| `02_lyrics_transcripcion.json` | `lyrics_transcriber.py` | solo familia `lyrics_video_*` |
| `03_prompt_generacion.txt` | `prompt_architect.py` | siempre |
| `04_config_generado.json` | `html_generator.py` | solo `config_driven_template` |
| `04_html_generado.html` / `04_html_log.json` | `html_generator.py` | solo `freeform_html` |
| `05_imagen_seleccionada.json` | `resource_fetcher.py` | si el nicho resuelve imagen (`requires_image` ≠ false) |
| `05b_validacion_imagenes.json` | `image_validator.py` | si `image.validation.enabled` |
| `05b_video_seleccionado.json` | `resource_fetcher.py` | solo `motion_backdrop_showcase` |
| `05c_duracion_resuelta.json` | `resource_fetcher.py` | si vino `duration_config` (siempre en `lyrics_video_*`) |
| `06_musica_seleccionada.json` | `resource_fetcher.py` | siempre |
| `07_grabacion_stats.json` | `video_recorder.py` | siempre |
| `08_resumen_final.json` | `result_summarizer.py` | siempre |
| `09_publicacion_resultado.json` | `social_publisher.py` | solo si `publishing.enabled` |

---

## 6. Dependencias — resumen por capa

| Capa | Paquete/binario | Nichos que lo usan |
|---|---|---|
| IA multimodal | Gemini (`google-genai`) | todos (análisis, Vision Extractor, validación de imagen) |
| IA de texto/JSON | DeepSeek (`openai` SDK, endpoint compatible) | todos (Config Mapper o HTML libre) |
| Grabación | `playwright` + Chromium | todos |
| Mux/transcodificación | `ffmpeg`/`ffprobe` (binario de sistema) | todos (audio, escalado); extra: extracción de frame en `motion_backdrop_showcase` |
| Transcripción de letras | `faster-whisper` + `ctranslate2` | solo `lyrics_video_*` |
| Recorte de fondo | `rembg` | disponible en el proyecto, no atado a un nicho específico hoy |
| Búsqueda de imagen | Unsplash / Pexels / Pixabay | nichos con `image_source.type=auto` |
| Búsqueda de música | Pixabay / Jamendo / yt-dlp fallback | nichos con `music_source.type=auto` |

---

## 7. Ver también

- `docs.md` — arquitectura general del sistema (hexagonal, pipeline, Job/Stage).
- `docs/video-recording-pipeline.md` — cómo graba Playwright (modos `rerecord`
  vs `loop`, viewport móvil realista, el bug de `fetch()` + `file://`).
- `GET /api/v1/niches` — listado en vivo de nichos activos/inactivos.
- `GET /api/v1/library/{images,music,videos}` — assets ya archivados y
  reusables por `library`/asset_id.
