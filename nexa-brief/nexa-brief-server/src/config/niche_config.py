"""NicheConfig — modelos Pydantic para niches.json y función de carga.

niches.json (raíz del proyecto) define el comportamiento del pipeline por nicho:
  - Búsqueda y validación de imágenes (query, color_filter, criterios Gemini)
  - Configuración de audio (género, adaptadores)
  - Formatos de video de salida (16:9 youtube, 9:16 reels)
  - Instrucciones visuales para el HTML (filtros CSS, nivel de animación, template)
  - Publicación (cuentas, playlists) — activada por ENABLE_AUTO_PUBLISHING

Uso:
    from src.config.niche_config import get_niche_config
    cfg = get_niche_config("ambient_music")   # NicheConfig o default seguro
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, model_validator

from src.config.settings import BASE_DIR, settings

# ── Ruta al archivo de configuración ────────────────────────────────────────
_NICHES_PATH: Path = BASE_DIR / "niches.json"

# ── Cache en memoria (se carga una sola vez por proceso) ─────────────────────
_cache: dict[str, "NicheConfig"] | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Submodelos
# ─────────────────────────────────────────────────────────────────────────────

class ImageValidationConfig(BaseModel):
    enabled: bool = False
    min_score: float = 0.70
    max_retries: int = 2
    criteria: list[str] = Field(default_factory=list)
    fallback_query: str | None = None


class ImageConfig(BaseModel):
    query_template: str = ""                 # query fijo (sin IA); ignorado si niche tiene search_instructions
    color_filter: str | None = None          # "black_and_white" | null
    results_count: int = 1                   # cuántas imágenes buscar para validar
    orientation: str = "landscape"           # landscape | portrait | squarish
    validation: ImageValidationConfig = Field(default_factory=ImageValidationConfig)
    library_category: str | None = None      # carpeta en data/image_library/ para archivar/reutilizar assets


class AudioConfig(BaseModel):
    mode: str = "music_only"                 # "music_only" | "tts_with_bg_music"
    genre: str = "ambient"                   # fallback si no hay search_instructions
    adapter_order: list[str] = Field(default_factory=lambda: ["pixabay", "jamendo"])
    library_category: str | None = None      # carpeta en data/music_library/ para archivar/reutilizar assets


class SearchInstructionsConfig(BaseModel):
    """Instrucciones en lenguaje natural que la IA usa para generar queries de búsqueda.

    La IA lee estas instrucciones en input_analyzer y genera 4 queries de imagen
    y 4 de música diferentes, maximizando la variedad entre iteraciones.
    """
    image: str = ""  # qué tipo de imagen buscar (estilo, composición, fondo, etc.)
    music: str = ""  # qué tipo de música buscar (género, mood, tempo, etc.)


class VideoFormat(BaseModel):
    id: str                                  # "youtube" | "reels"
    aspect_ratio: str                        # "16:9" | "9:16"
    width: int
    height: int
    output_filename: str
    crf: int = 18
    preset: str = "fast"
    # "crop_safe_zone": una grabación maestra a viewport fijo + crop por FFmpeg (legado).
    # "rerecord": graba la DURACIÓN COMPLETA a este viewport — correcto pero lento,
    #   escala linealmente con duration_seconds (dos rerecord ⇒ ~2× la duración real
    #   solo en grabación).
    # "loop": graba solo `loop_seconds` a este viewport (rápido, constante sin
    #   importar duration_seconds) y estira ese clip corto con FFmpeg -stream_loop
    #   hasta cubrir duration_seconds completo, mezclado con el audio real completo.
    #   Mismo layout responsive correcto que "rerecord" (graba al viewport propio del
    #   formato), pero el video se repite en loop duro cada `loop_seconds` en vez de
    #   tener movimiento continuo distinto en toda su duración.
    generation_method: str = "crop_safe_zone"  # "crop_safe_zone" | "rerecord" | "loop"
    loop_seconds: int = Field(default=25, ge=5, le=120, description="Solo para generation_method='loop'.")
    # Solo tiene efecto si aspect_ratio == "9:16". En vez de usar width×height
    # directamente como viewport de Playwright (que no corresponde a ningún
    # dispositivo real), graba con el viewport CSS realista de
    # settings.mobile_reference_viewport_width/height para que el motor JS del
    # template decida su layout responsive con proporciones reales de celular.
    # El video final se escala a `width` de ancho (FFmpeg, no device_scale_factor
    # — Playwright no escala la captura con eso) y el alto sale de la proporción
    # real del viewport de referencia, no de `height` — no se recorta, para no
    # cortar texto que el layout haya posicionado cerca de un borde.
    use_device_viewport: bool = False


class VideoConfig(BaseModel):
    duration_seconds: int = 60
    # Segundos de silencio que se agregan al final de la canción para que la salida de la plantilla
    # («Gracias por ver · Suscríbete») se vea completa. None = 4 s si la plantilla tiene
    # components/outro.js, 0 si no (ver resource_fetcher._outro_tail_seconds).
    outro_tail_seconds: float | None = None
    formats: list[VideoFormat] = Field(default_factory=list)
    # tiktok_video.mp4 es un clip de 61s con fades DERIVADO del formato 9:16 (no es
    # una grabación aparte, es un recorte rápido por FFmpeg) — pero sigue siendo un
    # archivo redundante con reels_video.mp4 si el nicho no va a publicar en TikTok.
    # default=True reproduce el comportamiento anterior (siempre se generaba).
    generate_tiktok_clip: bool = True
    # Si True (nichos de letras), el pipeline ignora cualquier duration_config
    # que venga en el request y fuerza DurationConfig(mode=AUTO, repeat_count=1)
    # — la letra tiene que durar EXACTAMENTE lo que dura la canción real, nunca
    # loop ni una duración manual que la desincronice o corte.
    duration_locked_to_music: bool = False


class HtmlVisualizerConfig(BaseModel):
    template: str = "default"               # "minimal_grayscale" | "cozy_rain_particles" | etc.
    animation_level: str = "medium"         # "low" | "medium" | "high"
    filters: list[str] = Field(default_factory=list)  # CSS filter functions


class AiConfig(BaseModel):
    analysis_model: str = "gemini"
    codegen_model: str = "deepseek"


class NichePublishingConfig(BaseModel):
    accounts: list[str] = Field(default_factory=list)
    youtube_playlist_id: str | None = None
    youtube_as_short: bool = False


class NicheMetadata(BaseModel):
    """Género/tags curados a mano en niches.json — reemplaza depender de lo que
    Stage 1 (input_analyzer) pueda inventar sobre una imagen/canción sin relación
    real con el nicho, sobre todo en pipeline_type="config_driven_template" donde
    no siempre hay song_info."""
    genre: str = ""
    mood_tags: list[str] = Field(default_factory=list)
    tag_hints: list[str] = Field(default_factory=list)  # guía para youtube_tags/tiktok_hashtags


_DEFAULT_REQUIRED_CONFIG_KEYS = [
    "img", "colors", "bgMode", "zones", "subject", "keepOut",
    "texts", "eqPosition", "typography", "anchorPreference",
]


class ConfigDrivenTemplateConfig(BaseModel):
    """Referencia a una plantilla estática registrada en templates.json.

    Solo se usa cuando NicheConfig.pipeline_type == "config_driven_template".
    Las rutas de archivo (index.html, prompts) ya NO viven acá — se resuelven
    por template_id vía src/config/template_manifest.py, cuya fuente de
    verdad es src/templates/templates.json (nombre de carpeta física
    desacoplado de este template_id, que es el identificador lógico estable).
    """
    enabled: bool = False
    template_id: str = ""
    default_typography: str = "default"
    default_anchor_preference: str = "bottom"
    # Si False, pipeline.py NO corre el Vision Extractor (sin imagen que
    # analizar — caso de plantillas de letras, que solo dependen de la
    # canción). Default True reproduce el comportamiento actual (01/02/03/04).
    requires_vision_extraction: bool = True
    # Si True, pipeline.py inserta el stage lyrics_transcriber en vez del
    # Vision Extractor — ver src/modules/lyrics_transcriber.py.
    requires_lyrics: bool = False
    # Claves top-level mínimas que el config.json generado debe tener —
    # reemplaza la constante fija que antes vivía en html_generator.py, cada
    # plantilla tiene un schema distinto. Default = schema de 01-image-bg.
    required_config_keys: list[str] = Field(default_factory=lambda: list(_DEFAULT_REQUIRED_CONFIG_KEYS))
    # Qué clave top-level de config.json recibe el forzado de w/h desde
    # vision_analysis.image_dimensions ("img" en 01/03, "subject" en 02,
    # "video" en 04). None = saltear el forzado (plantillas sin vision, ej.
    # letras, donde no hay imagen analizada con ese sistema de coordenadas).
    media_dimension_key: str | None = "img"
    # Nombre de archivo real que se sirve/graba para el recurso visual
    # principal — "bg.jpg" (01/03), "subject.png" (02, necesita alfa),
    # "bg.mp4" (04, video).
    media_src_filename: str = "bg.jpg"
    # Si False, resource_fetcher NO resuelve ninguna imagen para este nicho
    # (caso 04: el fondo es un video, no una imagen; caso lyrics: puede haber
    # una imagen de fondo opcional pero no analizada con zonas/subject).
    requires_image: bool = True
    # Si True, resource_fetcher resuelve un video (job.input.video_source,
    # solo LIBRARY/URL — no hay AUTO) y lo copia a media_src_filename. Solo
    # motion-backdrop lo usa hoy.
    requires_video: bool = False
    # Si True, html_generator envuelve el objeto de config generado en
    # {"activeId": "active", "configs": [<objeto>]} antes de escribir
    # config.json — el motor de motion-backdrop espera una COLECCIÓN de
    # casos, no un solo objeto top-level (a diferencia de 01/02/03).
    wrap_as_case_collection: bool = False
    # Algunas plantillas — por ejemplo las promos comerciales — traen un
    # config.json curado y estable. En ese caso se reutiliza ese config como
    # base y no se invoca al modelo para reconstruirlo en cada job.
    static_config: bool = False
    # Claves que se copian SIEMPRE del config.json de la plantilla, aunque el config lo arme la IA
    # (ej. "layout" en Neón: la mezcla de estilos de letra se decide en la plantilla, no por video).
    locked_config_keys: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Modelo principal
# ─────────────────────────────────────────────────────────────────────────────

class NicheConfig(BaseModel):
    id: str
    display_name: str
    active: bool = True
    description: str = ""
    skip_visual_design: bool = False
    # "freeform_html" (default, DeepSeek genera HTML libre) |
    # "config_driven_template" (plantilla estática + config.json, ver `template`)
    pipeline_type: str = "freeform_html"
    # "remotion" (default, render frame-por-frame vía Node/React — mejor calidad)
    # | "hyperframes" (vía el CLI de nexa-brief-hyperframes — ver
    # infrastructure/hyperframes_adapter.py; hoy sin niches portados) |
    # "playwright" (grabación en vivo + ffmpeg — más rápido, para niches sin
    # composición portada en el motor elegido; ver src/adapters/recorder/factory.py).
    # Todo niche declara este valor explícitamente en niches.json — este
    # default solo aplica a un niche nuevo que todavía no lo declare.
    recorder_engine: str = "remotion"
    template: ConfigDrivenTemplateConfig = Field(default_factory=ConfigDrivenTemplateConfig)
    metadata: NicheMetadata = Field(default_factory=NicheMetadata)
    # Instrucciones de búsqueda en lenguaje natural → la IA genera queries en input_analyzer
    search_instructions: SearchInstructionsConfig = Field(default_factory=SearchInstructionsConfig)
    image: ImageConfig = Field(default_factory=ImageConfig)
    audio: AudioConfig = Field(default_factory=AudioConfig)
    video: VideoConfig = Field(default_factory=VideoConfig)
    html_visualizer: HtmlVisualizerConfig = Field(default_factory=HtmlVisualizerConfig)
    ai: AiConfig = Field(default_factory=AiConfig)
    publishing: NichePublishingConfig = Field(default_factory=NichePublishingConfig)

    @model_validator(mode="after")
    def _check_pipeline_type_consistency(self) -> "NicheConfig":
        # skip_visual_design es un concepto del flujo freeform legado (ambient_music/
        # animated_study) — para config_driven_template, el control real de si corre
        # el Vision Extractor es template.requires_vision_extraction, no este flag.
        if self.pipeline_type == "config_driven_template" and self.skip_visual_design:
            raise ValueError(
                f"Niche '{self.id}': pipeline_type='config_driven_template' and "
                f"skip_visual_design=True son contradictorios — usar "
                f"template.requires_vision_extraction=False en su lugar (ver "
                f"plantillas de letras, que no analizan ninguna imagen)."
            )
        return self

    def get_9x16_format(self) -> VideoFormat | None:
        """Devuelve el primer formato 9:16 definido, o None."""
        return next((f for f in self.video.formats if f.aspect_ratio == "9:16"), None)

    def get_16x9_format(self) -> VideoFormat | None:
        """Devuelve el primer formato 16:9 definido, o None."""
        return next((f for f in self.video.formats if f.aspect_ratio == "16:9"), None)

    def css_filters_string(self) -> str:
        """Devuelve los filtros CSS como string para inyectar en el HTML prompt."""
        if not self.html_visualizer.filters:
            return ""
        return " ".join(self.html_visualizer.filters)

    def has_reels_format(self) -> bool:
        return self.get_9x16_format() is not None


# ─────────────────────────────────────────────────────────────────────────────
# Loader
# ─────────────────────────────────────────────────────────────────────────────

def _load_all() -> dict[str, NicheConfig]:
    """Carga niches.json una vez y cachea en memoria."""
    global _cache
    if _cache is not None:
        return _cache

    if not _NICHES_PATH.exists():
        _cache = {}
        return _cache

    try:
        raw: dict[str, Any] = json.loads(_NICHES_PATH.read_text(encoding="utf-8"))
        _cache = {
            key: NicheConfig.model_validate(value)
            for key, value in raw.get("niches", {}).items()
        }
    except Exception:
        _cache = {}

    return _cache


def list_all_niches() -> list[NicheConfig]:
    """Devuelve todas las NicheConfig definidas en niches.json (activas e inactivas)."""
    return list(_load_all().values())


def find_niche_by_template_id(template_id: str) -> NicheConfig | None:
    """Busca el niche activo cuyo `template.template_id` matchea (relación 1:1
    hoy en niches.json). Usado por el endpoint de preview de plantillas, que
    navega por `template_id` (la carpeta en src/templates/) en vez de por niche."""
    for niche in list_all_niches():
        if (
            niche.active
            and niche.pipeline_type == "config_driven_template"
            and niche.template.template_id == template_id
        ):
            return niche
    return None


def get_niche_config(niche_id: str) -> NicheConfig:
    """Devuelve la NicheConfig para el niche_id dado.

    Si no existe en niches.json, devuelve una configuración por defecto segura
    que produce el comportamiento anterior del pipeline (retrocompatibilidad).
    """
    cfg = _load_all().get(niche_id)
    if cfg is not None:
        return cfg
    return _default_niche_config(niche_id)


def _default_niche_config(niche_id: str) -> NicheConfig:
    """Configuración por defecto — reproduce el comportamiento anterior del pipeline."""
    return NicheConfig(
        id=niche_id,
        display_name=niche_id,
        active=True,
        description="Configuración por defecto — sin niches.json",
        image=ImageConfig(
            query_template=niche_id,
            results_count=1,
            validation=ImageValidationConfig(enabled=False),
        ),
        audio=AudioConfig(genre="ambient", adapter_order=["pixabay", "jamendo"]),
        video=VideoConfig(
            duration_seconds=settings.video_min_duration_seconds,
            formats=[
                VideoFormat(
                    id="youtube",
                    aspect_ratio="16:9",
                    width=settings.video_width,
                    height=settings.video_height,
                    output_filename="youtube_video.mp4",
                ),
                VideoFormat(
                    id="reels",
                    aspect_ratio="9:16",
                    width=1080,
                    height=1920,
                    output_filename="reels_video.mp4",
                    generation_method="crop_safe_zone",
                ),
            ],
        ),
        html_visualizer=HtmlVisualizerConfig(
            template="default",
            animation_level="medium",
            filters=[],
        ),
    )


def reload_niches() -> None:
    """Fuerza la recarga del cache (útil en tests o hot-reload)."""
    global _cache
    _cache = None
