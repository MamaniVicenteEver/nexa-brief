# Nexa Brief — Estrategia v3
**Análisis basado en lectura completa de `src/`** · 2026-06-30

---

## 1. Estado real del sistema (lo que ya existe)

Antes de plantear cualquier cosa nueva, el sistema actual es esto:

```
POST /api/v1/videos
    → Orchestrator (asyncio.Semaphore, max_parallel_jobs=2)
    → Pipeline (9 etapas)
        1. input_analyzer      → Gemini → AnalyzedInput (genre, mood_tags, image_query)
        2. visual_designer     → Gemini + skills/genres/{genre}.md → VisualDesign
        3. resource_fetcher    → fetch_image(query, bg.jpg) + fetch_music(genre, song.mp3)
        4. prompt_architect    → skills/html/html_design.md → prompt_text
        5. html_generator      → DeepSeek → index.html
        6. video_recorder      → Playwright + FFmpeg → youtube_video.mp4 + tiktok_video.mp4
        7. result_summarizer   → Gemini + skills/output/youtube_tiktok_copy.md → VideoSummary
        8. packager            → verifica _REQUIRED_FILES → manifest.json
        9. social_publisher    → PublisherFacade → YouTube / Facebook / TikTok
```

**Qué maneja el sistema hoy:**
- Un `Job` viaja inmutable (Pydantic `model_copy()`) por los 9 stages
- El objeto central es `src/core/job.py` — todo dato nuevo debe agregarse ahí
- El hook de extensibilidad principal ya existe: **`src/skills/genres/*.md`** (visual_designer.py carga el skill por género con fallback a `ambient.md`)
- Los factories (`factory.py` de imagen, música, AI, recorder) son el punto correcto para agregar nuevos adaptadores — una función, no una clase
- `JobInput.user_context` (max 500 chars) ya es el override de dirección creativa
- `JobPublishingConfig.accounts: list[str]` ya soporta selección por cuenta por job

**Tres restricciones de código que cualquier feature nueva debe respetar:**

1. `src/modules/packager.py` — lista fija:
   ```python
   _REQUIRED_FILES = ["index.html", "bg.jpg", "song.mp3", "youtube_video.mp4", "tiktok_video.mp4"]
   ```
   Cualquier nuevo artefacto de salida debe agregarse aquí, o el packager fallará.

2. `src/modules/prompt_architect.py` referencia `bg.jpg` y `song.mp3` por nombre fijo en el prompt.
   Cambiar a video de fondo o voz requiere parametrizar esas referencias.

3. `src/modules/resource_fetcher.py` llama siempre `fetch_image()` y `fetch_music()` sin condición.
   Las rutas alternativas (input externo de audio, video de fondo) necesitan condicionales aquí.

---

## 2. Los cinco features — análisis de implementación

### Feature A: Perfiles de canal (un sistema, múltiples identidades)

**Qué quiere el usuario:** cada nicho (ambiente, historia, motivación, gym) tiene su propio canal de YouTube, estética visual, y cuenta de publicación. No dos sistemas — un sistema con perfiles.

**Cómo encaja en el código actual:**
El patrón ya existe en `visual_designer.py`: carga `skills/genres/{genre}.md`. El mismo patrón se extiende a perfiles.

**Cambios exactos:**

| Archivo | Cambio |
|---------|--------|
| `src/core/job.py` | Agregar `profile_name: str \| None = None` a `JobInput` |
| `src/presentation/api/schemas/video_schema.py` | Agregar `profile_name: str \| None` a `VideoGenerationRequest` |
| `src/modules/visual_designer.py` | Cargar `skills/profiles/{profile_name}.md` si existe, antes del skill de género |
| `src/modules/prompt_architect.py` | Inyectar profile context al prompt de HTML si `job.input.profile_name` no es None |
| `src/modules/result_summarizer.py` | Inyectar tono de marca desde profile skill al prompt de SEO copy |
| `src/core/pipeline.py` | Pasar `publishing.accounts` desde el perfil si no viene en el request |

**Nuevo directorio:** `src/skills/profiles/`
- `src/skills/profiles/ambient.md` — Canal @DrovaSoft, YouTube, estética B&W + colores fríos
- `src/skills/profiles/gym.md` — energía, rojos/naranjas, TikTok + YouTube
- `src/skills/profiles/historia.md` — sepia, tipografía clásica, YouTube largo
- `src/skills/profiles/economia.md` — minimalismo financiero, texto limpio, YouTube

Un profile skill tiene esta estructura sugerida:
```markdown
# Perfil: Ambient Music — @DrovaSoft
## Identidad visual
Estética: blanco y negro + destellos de color frío (azul profundo o verde esmeralda)
Paleta: #0a0a0a, #ffffff, #1a2a3a
Tipografía: geométrica moderna, sin serif
Animación: fluida, lenta, partículas

## Canal de publicación
Plataforma preferida: youtube
Cuenta: youtube:canal_1
Playlist: PLRuOc7_kjUZs

## Tono de contenido
Descripción SEO: tranquilo, meditativo, ideal para trabajo y estudio
Hashtags base: #ambient #musicaambiente #lofi
```

El `visual_designer.py` lo carga exactamente igual que carga el skill de género — una línea de cambio.

---

### Feature B: Video de fondo (reemplaza imagen estática)

**Estado actual:** `resource_fetcher.py` descarga `bg.jpg` (imagen fija). El HTML usa CSS `background-image`.

**Lo que cambia en el HTML:** el visualizador usa `<video autoplay loop muted>` en lugar de `background-image`. Playwright ya graba esto correctamente porque lanza Chromium con `--autoplay-policy=no-user-gesture-required`.

**Cambios exactos:**

| Archivo | Cambio |
|---------|--------|
| `src/core/job.py` | Agregar `bg_video_path: Path \| None = None` a `JobArtifacts` |
| `src/core/job.py` | Agregar `use_video_background: bool = False` a `JobInput` (o inferido del profile) |
| `src/core/ports/` | Nuevo `video_background_port.py` — mismo patrón que `image_port.py` |
| `src/adapters/image/infrastructure/` | `pexels_video_adapter.py` — Pexels Videos API (`/v1/videos/search`) |
| `src/adapters/image/factory.py` | Nueva función `fetch_video_background(query, dest_path)` |
| `src/modules/resource_fetcher.py` | Si `use_video_background=True`, llamar `fetch_video_background()` → `bg_video.mp4` |
| `src/modules/prompt_architect.py` | Pasar `has_video_background=True/False` al prompt para que el HTML use `<video>` |
| `src/modules/packager.py` | Agregar `bg_video.mp4` a verificación si `job.artifacts.bg_video_path` existe (condicional) |
| `src/config/settings.py` | `video_background_adapter: str = "pexels_video"` |

**Nota técnica crítica:** el WebM que graba Playwright incluye solo video (sin audio). FFmpeg ya mezcla `_raw.webm` + `song.mp3` en `_run_ffmpeg()`. El video de fondo pesa ~10-30 MB. El packager necesita lógica condicional, no lista fija.

---

### Feature C: Voz AI (TTS narración)

**Estado actual:** el pipeline no tiene voz. Solo música (`song.mp3`). FFmpeg en el recorder mezcla un solo audio.

**El cambio de audio en FFmpeg** (recorder, en `_run_ffmpeg()`): actualmente usa `-i song.mp3`. Con voz también habría `-i voice.mp3` y un filtro de mezcla (`amix`).

**Cambios exactos:**

| Archivo | Cambio |
|---------|--------|
| `src/core/ports/` | Nuevo `tts_port.py` — `generate(text, dest_path, voice_id) → TTSResult` |
| `src/adapters/tts/` | `elevenlabs_adapter.py` o `openai_tts_adapter.py` |
| `src/adapters/tts/factory.py` | `get_tts()` — misma firma que `get_analysis_ai()` |
| `src/core/job.py` | Agregar `voice_path: Path \| None = None` a `JobArtifacts` |
| `src/core/job.py` | Agregar `narration_text: str \| None = None` a `JobArtifacts` |
| `src/modules/resource_fetcher.py` | Si perfil tiene voz activada: llamar `get_tts().generate(narration_text, voice.mp3)` |
| `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py` | Modificar `_run_ffmpeg()` para mezclar `voice.mp3` con `song.mp3` si existe |
| `src/modules/packager.py` | Agregar `voice.mp3` condicional a verificación |

**Dónde se genera el texto de narración:** en `src/modules/input_analyzer.py` (Stage 1) ya existe `AnalyzedInput.description` — se puede usar como base. O Gemini genera el texto de narración en Stage 1 opcionalmente si el perfil lo pide.

---

### Feature D: Lyric Video (música → subtítulos cinéticos)

**Qué quiere el usuario:** dar un archivo de audio, extraer letra/transcripción, generar video con texto animado sincronizado.

**Esta es la feature más compleja porque rompe el flujo actual:**
- Stage 3 siempre descarga música. Aquí el audio *ya existe* como input.
- Stage 5 genera HTML visual ambient. Aquí necesita HTML de subtítulos cinéticos.
- Se necesita transcripción con timestamps para sincronizar.

**Cambios exactos:**

| Archivo | Cambio |
|---------|--------|
| `src/core/job.py` | Agregar `input_audio_path: Path \| None = None` a `JobInput` |
| `src/core/job.py` | Agregar `lyrics_with_timestamps: list[dict] \| None = None` a `JobArtifacts` |
| `src/core/job.py` | Agregar `job_mode: Literal["ambient", "lyric_video", "research"] = "ambient"` a `JobInput` |
| `src/core/ports/` | Nuevo `transcription_port.py` — `transcribe(audio_path) → list[{"start": float, "end": float, "text": str}]` |
| `src/adapters/transcription/` | `whisper_adapter.py` — usa `faster-whisper` o `openai.audio.transcriptions` |
| `src/modules/` | Nuevo `lyrics_extractor.py` (Stage 3.5) — corre entre resource_fetcher y prompt_architect |
| `src/modules/resource_fetcher.py` | Si `input_audio_path` existe: skip `fetch_music()`, copiar audio dado a `song.mp3` en `output_dir` |
| `src/modules/prompt_architect.py` | Nueva rama de prompt para `job_mode="lyric_video"` — inyecta timestamps y texto |
| `src/skills/html/` | Nuevo `lyric_video_design.md` — skill de HTML para kinetic typography |
| `src/core/pipeline.py` | Insertar Stage 3.5 condicionalmente si `job.input.job_mode == "lyric_video"` |
| `src/presentation/api/` | Nuevo endpoint `POST /api/v1/lyric-video` que acepta `multipart/form-data` con archivo de audio |

**El HTML generado para lyric video:** DeepSeek recibe los timestamps y genera HTML con JS que anima cada línea de letra en el momento correcto usando `AudioContext.currentTime`. `prompt_architect.py` inyecta el JSON de timestamps en el prompt.

**Decisión de dependencia:** `faster-whisper` requiere ~1.5 GB para el modelo base. Alternativa: API de OpenAI Whisper a $0.006/minuto.

---

### Feature E: Research APIs por nicho + salida Markdown

**Qué quiere el usuario:** el sistema investiga contenido (economía, historia, religión) via APIs externas, genera contenido basado en ese research, y exporta el research como `.md`.

**Estado actual:** no existe ningún stage de investigación. El `user_context` es texto libre manual.

**Dos modos de uso:**
1. **Research + Video**: investiga, luego genera el HTML visualizador con ese contexto
2. **Research solo → Markdown**: investiga y genera documento .md (sin video)

**Cambios exactos:**

| Archivo | Cambio |
|---------|--------|
| `src/core/job.py` | Agregar `research_data: dict \| None = None` a `JobArtifacts` |
| `src/core/job.py` | Agregar `markdown_path: Path \| None = None` a `JobArtifacts` |
| `src/core/ports/` | Nuevo `research_port.py` — `search(topic, niche) → ResearchResult` |
| `src/adapters/research/` | `newsapi_adapter.py` (economía), `wikipedia_adapter.py` (historia), `bible_adapter.py` (religión) |
| `src/adapters/research/factory.py` | `get_research_adapter(niche: str) → ResearchPort` |
| `src/modules/` | Nuevo `research_fetcher.py` (Stage 1.5) — entre input_analyzer y visual_designer |
| `src/modules/` | Nuevo `markdown_writer.py` (Stage 8.5) — genera .md desde research_data via Gemini |
| `src/modules/prompt_architect.py` | Inyectar `research_data` al prompt de HTML cuando disponible |
| `src/modules/packager.py` | Agregar `research.md` condicional al manifest |
| `src/config/settings.py` | `newsapi_key`, `wikipedia_enabled: bool` |

**APIs reales disponibles:**
- **Economía**: NewsAPI (`newsapi.org`) — gratis hasta 100 req/día, noticias en tiempo real
- **Historia**: Wikipedia REST API — gratis, sin key, JSON directo
- **Religión**: Bible API (`scripture.api.bible`) — gratis con registro, 1500+ versiones

**El Markdown de research** se genera en Stage 8.5 con Gemini, tomando `research_data` y generando un `.md` estructurado con fuentes, resumen, y puntos clave. Este archivo va a `output_dir/research.md` junto a los videos.

---

## 3. Mapa de cambios por archivo

Esta tabla muestra todos los archivos que requieren modificación y por qué feature:

| Archivo | Features | Tipo de cambio |
|---------|----------|----------------|
| `src/core/job.py` | A, B, C, D, E | Agregar campos a `JobInput`, `JobArtifacts`, nuevo `job_mode` enum |
| `src/modules/packager.py` | B, C, D, E | Cambiar `_REQUIRED_FILES` de lista fija a validación condicional |
| `src/modules/resource_fetcher.py` | B, C, D | Condicionales para video bg, TTS, y audio input |
| `src/modules/prompt_architect.py` | A, B, C, D, E | Inyectar profile, video flag, voice flag, lyrics, research |
| `src/modules/visual_designer.py` | A | Cargar `skills/profiles/*.md` antes del skill de género |
| `src/modules/result_summarizer.py` | A | Tono de marca desde profile skill |
| `src/core/pipeline.py` | D, E | Insertar stages condicionales (lyrics_extractor, research_fetcher, markdown_writer) |
| `src/config/settings.py` | B, C, E | Nuevas keys de API, flags de feature |
| `src/presentation/api/schemas/video_schema.py` | A, D | `profile_name`, `job_mode`, endpoint multipart |
| `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py` | C | Mezcla de voice.mp3 con song.mp3 |

**Archivos que NO cambian** (el sistema funciona sin tocarlos):
- `src/modules/input_analyzer.py` — Stage 1 se mantiene igual
- `src/modules/html_generator.py` — DeepSeek consume lo que le llegue del prompt
- `src/modules/video_recorder.py` — solo llama al recorder port
- `src/adapters/ai/` — los dos AI adapters funcionan para todos los usos nuevos
- `src/adapters/publishing/` — la publicación no cambia
- `src/presentation/api/routers/videos.py` — el router base se mantiene

---

## 4. Orden de implementación (sin romper producción)

El sistema ya publica en YouTube y Facebook en producción. Las features nuevas deben ser **opt-in** — no pueden romper el flujo actual. La regla: si los campos nuevos son `None` o `False`, el comportamiento es idéntico al de hoy.

### Fase 1 — Perfiles de canal (1-2 días)
**Por qué primero:** es el cambio menos invasivo. Solo agrega un campo nullable a `JobInput` y un nuevo directorio de skills. No rompe nada si `profile_name=None`.

Pasos:
1. Agregar `profile_name: str | None = None` a `JobInput` en `job.py`
2. Agregar `profile_name` a `VideoGenerationRequest` en `video_schema.py`
3. Modificar `visual_designer.py` para cargar el profile skill si existe
4. Crear `src/skills/profiles/ambient.md` con la identidad de @DrovaSoft
5. Modificar `result_summarizer.py` para tono de marca

**Test:** `POST /api/v1/videos` con `profile_name="ambient"` debe producir un video con estética B&W. Sin `profile_name`, comportamiento actual idéntico.

### Fase 2 — Video de fondo (2-3 días)
**Por qué segundo:** Playwright ya graba `<video>` sin cambios en el recorder. Pexels Videos es la API más conocida del equipo (ya tienen Pexels para imágenes).

Pasos:
1. Crear `video_background_port.py` y `pexels_video_adapter.py`
2. Agregar `fetch_video_background()` al factory de imagen
3. Modificar `resource_fetcher.py` con condicional `use_video_background`
4. Modificar `prompt_architect.py` para indicar el tipo de fondo
5. Modificar `packager.py` para validación condicional de `bg_video.mp4`

**Test:** el HTML generado debe tener `<video autoplay loop muted>` en lugar de CSS `background-image`.

### Fase 3 — Voz AI (2-3 días)
**Por qué tercero:** necesita Fase 1 para saber qué voz usar por perfil. El cambio en el recorder es quirúrgico.

Pasos:
1. Crear `tts_port.py` y el adapter elegido (ElevenLabs o OpenAI TTS)
2. Agregar `voice_path` a `JobArtifacts`
3. Modificar `resource_fetcher.py` para generar voz si el perfil lo requiere
4. Modificar `playwright_ffmpeg_adapter.py` para mezcla con `amix` si `voice.mp3` existe

**Test:** video final debe tener voz narrando encima de la música de fondo.

### Fase 4 — Research APIs + Markdown (3-4 días)
**Por qué cuarto:** feature independiente, no bloquea ni depende de las anteriores.

Pasos:
1. Crear `research_port.py` y los tres adapters (NewsAPI, Wikipedia, Bible)
2. Crear `research_fetcher.py` como nuevo Stage 1.5
3. Crear `markdown_writer.py` como nuevo Stage 8.5
4. Modificar `pipeline.py` para insertar stages condicionales
5. Agregar `research_data` y `markdown_path` a `JobArtifacts`
6. Modificar `prompt_architect.py` para inyectar research context

**Test:** request con `job_mode="research"` y `category_name="economia"` debe producir `research.md` + video cuyo HTML refleje las noticias del día.

### Fase 5 — Lyric Video (5-7 días)
**Por qué al final:** la más compleja. Requiere dependencia nueva pesada (Whisper), endpoint multipart, y skill HTML completamente nuevo.

Pasos:
1. Decidir: `faster-whisper` local vs `openai.audio.transcriptions` API
2. Crear `transcription_port.py` y adapter
3. Crear `lyrics_extractor.py` como Stage 3.5
4. Crear `skills/html/lyric_video_design.md`
5. Modificar `prompt_architect.py` con rama lyric-video
6. Crear `POST /api/v1/lyric-video` con `multipart/form-data`
7. Modificar `resource_fetcher.py` para usar audio input externo

**Test:** subir `cancion.mp3` → API debe devolver `youtube_video.mp4` con texto animado sincronizado a la música.

---

## 5. Decisiones pendientes (preguntas al usuario)

| # | Pregunta | Impacta |
|---|----------|---------|
| 1 | ¿El video de fondo es por perfil o un flag global en el request? | Fase 2 |
| 2 | ¿TTS en español o inglés o ambos? ¿ElevenLabs o OpenAI TTS? | Fase 3 |
| 3 | ¿El research genera SOLO Markdown, o también video + Markdown? | Fase 4 |
| 4 | ¿Lyric video: Whisper local (gratis, pesado) o API OpenAI (pago, fácil)? | Fase 5 |
| 5 | ¿Los perfiles nuevos (gym, historia, etc.) ya tienen canal en YouTube/TikTok o aún no? | Fase 1 |

---

## 6. Principio guía

El núcleo del sistema — el `Job` inmutable, el pipeline de 9 stages, los dos modelos AI (Gemini + DeepSeek), la arquitectura hexagonal con ports/adapters, la publicación en tres plataformas — **no se toca**.

Todo lo nuevo es opt-in: nuevos fields nullables en `Job`, nuevos adapters, nuevos skills Markdown, nuevos stages condicionales en `pipeline.py`.

Si `profile_name=None`, `use_video_background=False`, `input_audio_path=None`, `job_mode="ambient"` → el sistema se comporta **exactamente igual que hoy**.
