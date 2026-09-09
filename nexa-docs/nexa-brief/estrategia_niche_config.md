# Nexa Brief — Estrategia de Configuración por Nicho
**Análisis basado en código** · 2026-07-01
**Cubre:** YAML vs JSON, flujo de validación de imágenes, 9:16 real para Reels, objeto de configuración por nicho

> **Nota de vigencia (2026-09-08):** la propuesta de mover cada nicho a un archivo YAML propio (`niches/{id}.yaml`) **no se adoptó** — el sistema implementado usa un único `niches.json` (16 nichos, 14 activos). El resto del análisis (validación de imágenes, bug del 9:16 falso) sí se implementó. Ver `nexa-brief/nexa-brief-server/niches.json` y `nexa-brief/nexa-brief-server/docs/niches-reference.md` para el esquema real vigente.

---

## 1. YAML vs JSON — Decisión

El proyecto ya usa JSON en todos lados: `accounts.json`, `manifest.json`, todos los logs de etapas (`01_input_completado.json`, `05_imagen_seleccionada.json`, etc.). El instinto de usar JSON es correcto para datos generados por máquina.

Pero los archivos de configuración de nicho los va a **escribir y editar un humano**. La diferencia decisiva es una sola: **JSON no soporta comentarios**.

```json
// ESTO NO FUNCIONA EN JSON ESTÁNDAR
{
  "query_template": "greek statue dramatic",
  "results_count": 3  // ← cuántas imágenes buscar antes de validar
}
```

```yaml
# YAML SÍ soporta comentarios — puedes documentar cada campo
image:
  query_template: "greek statue dramatic"
  results_count: 3  # cuántas imágenes buscar antes de validar
```

Para una configuración que va a tener 20-30 campos por nicho, con criterios de validación de imágenes escritos en español natural, con notas de por qué se eligió cierto género de música — **YAML gana sin discusión**.

La dependencia es mínima: `PyYAML` ya está en el ecosistema Python, `pydantic-settings` lo soporta nativamente, y el resto del proyecto usa `pyproject.toml` con `uv` — agregar `pyyaml` es una línea.

**Decisión: YAML para configuración de nichos.**

JSON se mantiene para todo lo que genera el sistema (logs, manifests, tokens).

---

## 2. Bug crítico encontrado: el video 9:16 no existe realmente

Al leer `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py` líneas 97-114, el "TikTok video" actual es esto:

```python
# Step 3: TikTok clip (61 s with fade)
await self._run_ffmpeg(
    "-y",
    "-i", str(youtube_path),    # ← entrada: el 16:9 de 1920×1080
    "-t", str(clip_dur),        # ← corte a 61 segundos
    "-vf", f"fade=t=in:...",    # ← fade in/out visual
    "-af", f"afade=t=in:...",   # ← fade in/out audio
    str(tiktok_path),           # ← salida: MISMO 1920×1080, solo más corto
)
```

**No hay `-vf crop` ni `scale=1080:1920`**. El `tiktok_video.mp4` resultante tiene dimensiones **1920×1080** — es landscape (16:9), no vertical (9:16). Si se sube a TikTok o Instagram Reels, aparece en formato horizontal con barras negras arriba y abajo, o la plataforma lo rechaza.

Esto significa que el sistema **nunca ha generado un video 9:16 real** para Reels/TikTok. Es un bug de la implementación actual que hay que corregir como parte de este feature.

---

## 3. Los dos enfoques para 9:16 real

### Opción A — FFmpeg crop post-proceso (rápido, calidad media)

Convertir el 16:9 grabado a 9:16 cortando los lados:

```
Entrada: 1920×1080 (16:9)
             ┌─────────────────────────────┐
             │     ///  centro  ///        │
             │   ┌─────────┐              │
             │   │ 607×1080│              │  ← crop central de ancho 607px
             │   │  9:16   │              │
             │   └─────────┘              │
             └─────────────────────────────┘
Salida: 607×1080 → escalar a 1080×1920
```

FFmpeg command: `-vf "crop=607:1080:(iw-607)/2:0,scale=1080:1920"`

**Ventaja:** cero cambios en el grabador, solo una línea FFmpeg extra.
**Desventaja:** el HTML fue diseñado para 16:9. Los elementos visuales en los extremos se pierden. Para ambient music con canvas centrado suele funcionar, pero para diseños con texto en los bordes es un problema.

### Opción B — Segunda grabación con viewport 9:16 (calidad máxima)

Playwright hace una segunda pasada del mismo HTML pero con `viewport = {width: 1080, height: 1920}`:

```
Primera grabación:  viewport 1920×1080  →  youtube_video.mp4  (16:9)
Segunda grabación:  viewport 1080×1920  →  reels_video.mp4    (9:16)
```

**Ventaja:** el HTML responde al viewport. Los canvas y animaciones CSS se adaptan si usan `100vw / 100vh`. El resultado es nativo 9:16, no un recorte.
**Desventaja:** el tiempo de grabación se duplica. Un video de 60 segundos pasa de ~3 min a ~6 min de procesamiento.

**El HTML ya responde — o debería.** El skill `src/skills/html/html_design.md` instruye al DeepSeek a usar `width: 100%; height: 100%` en el canvas. Si esa instrucción es correcta, la Opción B produce resultados superiores sin modificar el HTML generado.

### Decisión

**Fase inmediata:** Opción A (crop FFmpeg) para tener 9:16 real funcionando en horas, sin cambiar el recorder.

**Fase siguiente:** Opción B (segunda grabación) cuando se implemente el sistema de formatos en el niche config. El niche config dirá `formats: [16:9, 9:16]` y el recorder hará dos pasadas.

---

## 4. El flujo de validación de imágenes — cómo se inserta en el código

### Estado actual (resource_fetcher.py línea 36-38)

```python
img_result = await fetch_image(
    query=analyzed.image_query,
    dest_path=output_dir / "bg.jpg",   # ← 1 imagen, nombre fijo
)
```

`fetch_image()` ya busca hasta `max_image_results=10` resultados en Unsplash/Pexels pero devuelve solo el primero que cumple dimensiones mínimas. La infraestructura para N resultados ya existe en la API de Unsplash (`per_page=10`) — solo falta devolverlos todos.

### Nuevo flujo diseñado

```
resource_fetcher.py
    ↓
1. fetch_images_batch(query, count=3) → [img_candidate_1, img_candidate_2, img_candidate_3]
    ↓
2. image_validator.run(candidates, criteria) → validation result
    ├── Para cada imagen: llamar Gemini Flash con la imagen + criterios
    │       Gemini devuelve: { "passes": bool, "score": float, "reason": str }
    ├── Tomar la imagen con mayor score que pasa el umbral
    └── Si ninguna pasa: retry con query_fallback
    ↓
3. Imagen seleccionada → bg.jpg  (igual que hoy)
```

### Dónde toca el código existente

**`src/core/ports/image_port.py`** — agregar método `fetch_batch`:
```
ImagePort.fetch(query, dest_path, min_width, min_height) → ImageFetchResult  ← EXISTENTE
ImagePort.fetch_batch(query, dest_paths, count, ...)     → list[ImageFetchResult]  ← NUEVO
```

**`src/adapters/image/infrastructure/unsplash_adapter.py`** — el adapter ya tiene el loop de resultados. Solo necesita devolver los N primeros en lugar del primero que cumple dimensiones. Actualmente línea 34-37:
```python
photo = next(
    (p for p in results if p["width"] >= min_width ...),
    results[0],
)
```
Cambiar a: devolver los top-N que cumplen dimensiones, guardar cada uno en `bg_candidate_0.jpg`, `bg_candidate_1.jpg`, etc.

**`src/core/ports/ai_port.py`** — agregar tercer método abstracto:
```python
@abstractmethod
async def analyze_image(
    self,
    image_path: Path,
    criteria: list[str],
) -> dict:   # {"passes": bool, "score": float, "reason": str}
    ...
```

**`src/adapters/ai/infrastructure/gemini_flash_adapter.py`** — implementar `analyze_image()`. El SDK de `google-genai` ya soporta multimodal:
```python
# El cliente ya existe: self._client = genai.Client(api_key=...)
# La llamada multimodal es:
response = await self._client.aio.models.generate_content(
    model=self._model,
    contents=[
        types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
        "Analiza esta imagen según los criterios: ..."
    ],
    config=types.GenerateContentConfig(response_mime_type="application/json", ...)
)
```

**Nuevo módulo: `src/modules/image_validator.py`** — Stage 3.5 (opcional, activado por niche config):
```python
async def run(job: Job, candidates: list[Path], analysis_ai: AIPort) -> Path:
    # Analiza cada candidato, devuelve la mejor imagen que pasa
    # Si ninguna pasa: lanza excepción → resource_fetcher reintenta con query alternativa
```

**`src/modules/resource_fetcher.py`** — el cambio principal:
- Lee `niche_config.image.results_count` y `niche_config.image.validation.enabled`
- Si `enabled=False`: comportamiento actual idéntico (1 imagen, sin validar)
- Si `enabled=True`: busca N candidatos → valida → selecciona → reintenta si falla

---

## 5. El modelo de validación — Gemini Flash 3.1 Lite

El modelo ya configurado en `settings.py` es `gemini-3.1-flash-lite-preview`. Es el mismo que usa el sistema para análisis. Para validación de imágenes, **el mismo modelo hace las dos cosas** — análisis de texto Y análisis de imágenes. Gemini Flash es multimodal por diseño.

El análisis de una imagen cuesta ~0.0001 USD (Flash Lite es el más barato de la familia Gemini). Validar 3 imágenes por job = 3 llamadas = ~$0.0003. Con 60 jobs/mes = ~$0.018 — despreciable.

**No hay que configurar un modelo diferente. El mismo adaptador existente de Gemini hace la validación de imágenes** con el tercer método `analyze_image()`.

---

## 6. Estructura del niche config YAML

Ubicación: `src/config/niches/{niche_id}.yaml`

Primera instancia: `src/config/niches/ambient.yaml`

```yaml
# ─────────────────────────────────────────────────────────────
# Configuración del nicho: Ambient Music — @DrovaSoft
# ─────────────────────────────────────────────────────────────

niche:
  id: ambient
  display_name: "Ambient Music — @DrovaSoft"
  active: true
  description: "Música ambiente con estética B&W, imágenes de estatuas griegas"


# ── Búsqueda y validación de imágenes ────────────────────────

image:
  # Query principal que va a Unsplash/Pexels
  query_template: "greek god statue dramatic dark background"

  # Filtro de color nativo de la API (unsplash/pexels lo soportan)
  # Opciones: "black_and_white" | "natural" | null
  color_filter: "black_and_white"

  # Cuántas imágenes candidatas buscar antes de validar
  results_count: 3

  # Orientación preferida para la búsqueda
  orientation: "landscape"  # landscape | portrait | squarish

  # Validación con Gemini multimodal
  validation:
    enabled: true
    model: "gemini"  # usa el analysis_ai del niche (ver sección ai:)
    min_score: 0.70  # umbral mínimo (0.0 - 1.0)
    max_retries: 2   # reintentos si ningún candidato pasa

    # Criterios que Gemini evaluará por cada imagen
    # Escríbelos como instrucciones claras — Gemini los leerá literalmente
    criteria:
      - "La imagen muestra una estatua, escultura o figura humana imponente"
      - "El fondo es oscuro, dramático o neutro — sin colores vivos"
      - "Alta resolución y calidad fotográfica — sin pixelación ni ruido"
      - "Composición que transmite poder, eternidad o monumentalidad"
      - "Sin texto, marcas de agua ni logos visibles"

    # Query alternativa si ningún candidato de la query principal pasa
    fallback_query: "classical sculpture marble dramatic lighting"


# ── Música ───────────────────────────────────────────────────

music:
  genre: "ambient"

  # Orden de adaptadores — el sistema los intenta en este orden
  # Opciones disponibles: pixabay, jamendo, ytdlp
  adapter_order:
    - pixabay
    - jamendo

  # Tags específicos por adaptador (override del mapeo global)
  # Si null, usa el _GENRE_MAP interno del adaptador
  tags_override:
    jamendo: "ambient"
    pixabay: "ambient"


# ── Generación de video ───────────────────────────────────────

video:
  duration_seconds: 60

  # Formatos a generar — el recorder produce uno por cada entrada
  formats:
    - id: "youtube"
      aspect_ratio: "16:9"
      width: 1920
      height: 1080
      output_filename: "youtube_video.mp4"
      crf: 18
      preset: "fast"

    - id: "reels"
      aspect_ratio: "9:16"
      width: 1080
      height: 1920
      output_filename: "reels_video.mp4"
      crf: 20
      preset: "fast"
      # Cómo obtener el 9:16:
      # "crop"      → recorta el centro del 16:9 ya grabado (rápido)
      # "rerecord"  → segunda grabación Playwright con viewport 9:16 (calidad máxima)
      method: "crop"


# ── Modelos de IA ─────────────────────────────────────────────

ai:
  # Modelo para análisis, diseño visual, validación de imágenes y resumen SEO
  analysis_model: "gemini"   # usa GeminiFlashAdapter

  # Modelo para generación de HTML
  codegen_model: "deepseek"  # usa DeepSeekAdapter

  # En el futuro: "custom_gemini_pro" | "openai_gpt4o" para nichos premium


# ── Skills / prompts ──────────────────────────────────────────

skills:
  # Skill de perfil visual (cargado en Stage 2 - visual_designer)
  profile: "src/skills/profiles/ambient.md"

  # Skill de género musical (cargado en Stage 2 como contexto adicional)
  genre: "src/skills/genres/ambient.md"

  # Skill de diseño HTML (cargado en Stage 4 - prompt_architect)
  html_design: "src/skills/html/html_design.md"

  # Skill de copy SEO (cargado en Stage 7 - result_summarizer)
  output_copy: "src/skills/output/youtube_tiktok_copy.md"


# ── Publicación ───────────────────────────────────────────────

publishing:
  # Lista de cuentas donde publicar — formato "plataforma:alias"
  accounts:
    - "youtube:canal_1"
  # Nota: para publicar Reels en Instagram, agregar: "facebook:pagina_1"
  # Nota: para TikTok (cuando se apruebe): "tiktok:cuenta_1"

  # Playlist de YouTube donde agregar el video (null = no agregar)
  youtube_playlist_id: "PLRuOc7_kjUZs"

  # Publicar como YouTube Short (agrega #Shorts al título)
  youtube_as_short: true

  # Horario de publicación automática
  schedule:
    enabled: true
    time: "09:00"          # hora local del servidor
    timezone: "America/New_York"
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]  # todos los días


# ── Workflow — etapas activas ─────────────────────────────────
# Define exactamente qué etapas corren para este nicho.
# Desactivar una etapa la salta completamente.
# El orden aquí ES el orden de ejecución.

workflow:
  stages:
    - name: input_analyzer
      enabled: true

    - name: visual_designer
      enabled: true

    - name: resource_fetcher
      enabled: true
      # Configuración específica de esta etapa:
      image_validation: true   # activa el sub-flujo de validación de imágenes

    - name: prompt_architect
      enabled: true

    - name: html_generator
      enabled: true

    - name: video_recorder
      enabled: true
      # El recorder genera los formatos definidos en video.formats

    - name: result_summarizer
      enabled: true

    - name: packager
      enabled: true

    - name: social_publisher
      enabled: true   # se activa si publishing.accounts no está vacío
```

---

## 7. Cómo el pipeline.py consume el niche config

Actualmente `pipeline.py` es una lista fija (líneas 49-58):

```python
stages = [
    ("input_analyzer",    lambda j: input_analyzer.run(j, analysis_ai)),
    ("visual_designer",   lambda j: visual_designer.run(j, analysis_ai)),
    ("resource_fetcher",  lambda j: resource_fetcher.run(j)),
    ...
]
```

Con el niche config, el pipeline se construye dinámicamente:

```
pipeline.run(job)
    ↓
1. Cargar niche config: src/config/niches/{job.input.category_name}.yaml
2. Construir lista de stages desde workflow.stages (filtrando enabled=false)
3. Pasar niche_config como argumento a los stages que lo necesitan
4. Ejecutar stages en orden
```

El `pipeline.py` cambia de tener una lista hardcodeada a construir la lista desde el YAML. El cambio es en el pipeline — los módulos de stage individuales (input_analyzer, visual_designer, etc.) reciben el niche_config como argumento adicional opcional.

### Nuevo objeto en el pipeline

Se necesita una clase Pydantic para el niche config:

**Nuevo archivo: `src/config/niche_config.py`**

```python
class ImageValidationConfig(BaseModel):
    enabled: bool = False
    model: str = "gemini"
    min_score: float = 0.70
    max_retries: int = 2
    criteria: list[str] = []
    fallback_query: str | None = None

class ImageConfig(BaseModel):
    query_template: str
    color_filter: str | None = None
    results_count: int = 1
    orientation: str = "landscape"
    validation: ImageValidationConfig = ImageValidationConfig()

class VideoFormat(BaseModel):
    id: str
    aspect_ratio: str
    width: int
    height: int
    output_filename: str
    crf: int = 18
    preset: str = "fast"
    method: str = "crop"  # "crop" | "rerecord"

class WorkflowStage(BaseModel):
    name: str
    enabled: bool = True
    image_validation: bool = False

class NicheConfig(BaseModel):
    niche_id: str
    ...

def load_niche_config(niche_id: str) -> NicheConfig:
    path = settings.BASE_DIR / "src" / "config" / "niches" / f"{niche_id}.yaml"
    if not path.exists():
        return NicheConfig.default()  # comportamiento actual si no hay config
    return NicheConfig.model_validate(yaml.safe_load(path.read_text()))
```

El `load_niche_config()` tiene un fallback a comportamiento por defecto si no existe el archivo YAML para un nicho. Esto garantiza retrocompatibilidad.

---

## 8. Cómo se inserta el video 9:16 con método "crop"

### Cambio mínimo en playwright_ffmpeg_adapter.py

Actualmente el Step 3 (líneas 97-114) genera el TikTok como recorte temporal sin cambio de dimensiones. El fix es agregar el filtro de crop+scale:

**Antes (bug actual):**
```python
"-vf", f"fade=t=in:st=0:d={fi},fade=t=out:st={fade_out_start}:d={fo}",
```

**Después (con 9:16 real por crop):**
```python
# Crop central de 607px de ancho del 1920×1080, escalar a 1080×1920
"-vf", f"crop=607:1080:(iw-607)/2:0,scale=1080:1920,fade=t=in:st=0:d={fi},fade=t=out:st={fade_out_start}:d={fo}",
```

Resultado: `reels_video.mp4` → **1080×1920** (9:16 nativo), listo para TikTok e Instagram Reels.

### Cambio para el método "rerecord" (segunda grabación)

El recorder necesita dos pasadas de Playwright. La segunda pasada usa el mismo `html_path` pero con viewport diferente:

```
Pasada 1: viewport {width: 1920, height: 1080} → _raw_16_9.webm → youtube_video.mp4
Pasada 2: viewport {width: 1080, height: 1920} → _raw_9_16.webm  → reels_video.mp4
```

El `RecordingResult` en `src/core/ports/recorder_port.py` actualmente tiene `youtube_path` y `tiktok_path`. Con el niche config, tendría una lista de outputs:

```python
class RecordingResult(BaseModel):
    youtube_path: Path                     # existente (retrocompat)
    tiktok_path: Path                      # existente (retrocompat)
    outputs: dict[str, Path] = {}          # nuevo: {"youtube": ..., "reels": ...}
    stats: dict = {}
```

---

## 9. El objeto `workflow` en el niche config — por qué es la clave

El `workflow.stages` en el YAML no es solo una lista de stages activos. Es la forma en que cada nicho define exactamente su pipeline sin tocar código.

Ejemplo de un nicho de historia diferente al de ambient:

```yaml
# src/config/niches/historia.yaml
workflow:
  stages:
    - name: input_analyzer
      enabled: true

    - name: research_fetcher      # ← stage nuevo, solo existe en historia
      enabled: true
      api: "wikipedia"
      topics_per_job: 1

    - name: visual_designer
      enabled: true

    - name: resource_fetcher
      enabled: true
      image_validation: true

    - name: prompt_architect
      enabled: true
      mode: "research_video"      # ← rama diferente del prompt

    - name: html_generator
      enabled: true

    - name: video_recorder
      enabled: true

    - name: markdown_writer       # ← stage nuevo, solo en historia
      enabled: true               #   exporta el research como .md

    - name: result_summarizer
      enabled: true

    - name: packager
      enabled: true

    - name: social_publisher
      enabled: true
```

El pipeline lee el workflow del YAML, construye solo los stages activos, y los ejecuta en ese orden. Si `research_fetcher` no existe como módulo Python, el pipeline lanza un error de configuración. Esto es intencional — el YAML define el contrato, el código debe cumplirlo.

---

## 10. Mapa de archivos a crear y modificar

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/config/niches/ambient.yaml` | Primera configuración de nicho |
| `src/config/niche_config.py` | Modelos Pydantic + `load_niche_config()` |
| `src/modules/image_validator.py` | Stage 3.5 — valida imágenes con Gemini |

### Archivos a modificar

| Archivo | Qué cambia | Por qué |
|---------|-----------|---------|
| `src/core/ports/ai_port.py` | Agregar método abstracto `analyze_image(path, criteria)` | Gemini necesita un contrato para análisis multimodal |
| `src/adapters/ai/infrastructure/gemini_flash_adapter.py` | Implementar `analyze_image()` usando google-genai multimodal | El SDK ya soporta imágenes |
| `src/core/ports/image_port.py` | Agregar `fetch_batch(query, dest_dir, count)` | Necesitamos N candidatos, no 1 |
| `src/adapters/image/infrastructure/unsplash_adapter.py` | Implementar `fetch_batch()` — ya tiene los N resultados en memoria | 3 líneas de cambio |
| `src/adapters/image/infrastructure/pexels_adapter.py` | Implementar `fetch_batch()` | Misma lógica |
| `src/adapters/image/factory.py` | Agregar `fetch_image_batch()` | Factory pública para el recurso_fetcher |
| `src/modules/resource_fetcher.py` | Leer niche_config, llamar batch + validator si activado | Es el punto central de este flujo |
| `src/core/pipeline.py` | Cargar niche config, construir stages desde workflow | El cambio más estructural |
| `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py` | Agregar crop+scale para 9:16 (fix inmediato) + soporte multi-format (después) | El bug de 9:16 se corrige aquí |
| `src/core/ports/recorder_port.py` | Agregar `outputs: dict[str, Path]` a `RecordingResult` | Para manejar N formatos |
| `src/modules/packager.py` | Cambiar `_REQUIRED_FILES` de lista fija a dinámica desde niche config | Nuevos artefactos de salida |
| `src/config/settings.py` | Agregar `niches_dir: Path` | Path al directorio de configs de nicho |

### Archivos que NO cambian

- `src/modules/input_analyzer.py` — Stage 1 sin cambios
- `src/modules/visual_designer.py` — ya carga skills por nombre, el skill_path viene del niche config
- `src/modules/html_generator.py` — DeepSeek no sabe del niche config, solo recibe el prompt
- `src/modules/result_summarizer.py` — carga su skill por path, que vendrá del niche config
- `src/adapters/publishing/` — la publicación no cambia
- `src/presentation/api/` — los routers no cambian

---

## 11. Orden de implementación para este sprint

**Objetivo:** sistema generando 16:9 y 9:16 real, con validación de imágenes de estatuas griegas, todo configurable desde YAML.

### Paso 1 — Fix inmediato del 9:16 (1-2 horas)

Corregir `playwright_ffmpeg_adapter.py` línea 106: agregar el crop+scale filter al comando FFmpeg del TikTok video. Sin YAML, sin validación, solo el bug más urgente.

Verificación: el `reels_video.mp4` generado debe medir **1080×1920** (confirmar con `ffprobe output/*/reels_video.mp4`).

### Paso 2 — Estructura base del niche config (2-3 horas)

1. Crear `src/config/niche_config.py` con los modelos Pydantic
2. Crear `src/config/niches/ambient.yaml` con la estructura completa (sin activar validación de imágenes aún)
3. Modificar `pipeline.py` para cargar el niche config al inicio y pasarlo a los stages
4. Verificar: el pipeline corre igual que antes con el YAML cargado

### Paso 3 — Multi-formato en el recorder (2-3 horas)

1. Leer `video.formats` del niche config en el recorder
2. Implementar el bucle de formatos en `playwright_ffmpeg_adapter.py`
3. Actualizar `packager.py` para verificar los archivos definidos en `video.formats`
4. Verificar: el job produce `youtube_video.mp4` (16:9) y `reels_video.mp4` (9:16 crop) simultáneamente

### Paso 4 — Validación de imágenes (3-4 horas)

1. Agregar `analyze_image()` a `AIPort` y `GeminiFlashAdapter`
2. Agregar `fetch_batch()` a `ImagePort`, `UnsplashAdapter`, `PexelsAdapter`
3. Crear `src/modules/image_validator.py`
4. Modificar `resource_fetcher.py` para el flujo batch + validación
5. Activar `image.validation.enabled: true` en `ambient.yaml`
6. Verificar: el log `05_imagen_seleccionada.json` muestra los 3 candidatos y el score de cada uno

### Verificación final

Con todo implementado, un job de `category_name: "ambient"` debe:
1. Cargar `ambient.yaml`
2. Buscar 3 imágenes B&W de estatuas griegas en Unsplash/Pexels
3. Validar las 3 con Gemini — elegir la mejor (score > 0.70)
4. Si ninguna pasa: reintentar con `fallback_query`
5. Generar HTML con fondo B&W, estética del perfil ambient
6. Grabar 2 archivos: `youtube_video.mp4` (1920×1080) y `reels_video.mp4` (1080×1920)
7. Subir `youtube_video.mp4` a @DrovaSoft y `reels_video.mp4` a Reels (cuando esté configurado)
