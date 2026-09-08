"""Module 2 — Visual Designer.

Two completely different behaviors depending on niche_cfg.pipeline_type:

- "freeform_html" (default): produce el plan de diseño visual abstracto
  (VisualDesign: colores, fuentes, animación) via Gemini, ANTES de tener
  ninguna imagen real. Comportamiento original, sin cambios.

- "config_driven_template": ejecuta el Prompt 1 (Vision Extractor) de la
  plantilla contra la imagen REAL ya resuelta por resource_fetcher (que
  para este pipeline_type corre ANTES que este módulo). No produce
  VisualDesign — produce `vision_analysis`, el JSON crudo que prompt_architect
  + html_generator usarán para construir config.json.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import structlog

from src.config.exceptions import AIValidationError
from src.config.niche_config import NicheConfig
from src.config.settings import settings
from src.config.template_manifest import get_template_paths
from src.core.job import Job, JobStage, VisualDesign
from src.core.library import asset_library
from src.core.ports.ai_port import AIPort
from src.modules.image_rotation import apply_orientation_correction, verify_dimensions

logger = structlog.get_logger(__name__)


def _load_skill(genre: str) -> str:
    """Load the genre-specific design skill Markdown file."""
    skill_file = settings.skills_dir / "genres" / f"{genre.lower()}.md"
    fallback = settings.skills_dir / "genres" / "ambient.md"
    path = skill_file if skill_file.exists() else fallback
    return path.read_text(encoding="utf-8") if path.exists() else ""


_SYSTEM_TEMPLATE = """\
{skill}

Eres un diseñador visual senior especializado en experiencias audiovisuales de larga duración.
Tu tarea es crear un plano de diseño visual cohesivo para un video musical de {genre}.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.
"""

_USER_TEMPLATE = """\
Crea un plano de diseño visual para este video musical:

Género: {genre}
Mood: {mood}
Descripción: {description}
{niche_hints}
Devuelve un JSON con estos campos exactos:
- genre: el género musical
- style: nombre corto del estilo visual (e.g., "dark minimalist", "warm vintage", "neon noir")
- colors: lista de exactamente 3-4 colores en formato hexadecimal (paleta coherente y elegante)
- fonts: lista de 1-2 nombres de fuentes de Google Fonts (modernas, legibles)
- animation: tipo de animación principal ("gentle_pulse", "slow_drift", "breathing", "wave_ripple")
- background_style: cómo tratar el fondo ("blur_overlay", "gradient_overlay", "solid_dark", "frosted_glass")

Prioriza: minimalismo, elegancia, contraste equilibrado, espacios negativos.
Evita: colores saturados o carnavalescos, efectos agresivos.
"""

_ANIMATION_HINTS = {
    "low": "Nivel de animación: BAJO — movimientos muy sutiles, casi estáticos. Prefiere breathing o gentle_pulse.",
    "medium": "Nivel de animación: MEDIO — animaciones suaves y fluidas. Prefiere slow_drift o wave_ripple.",
    "high": "Nivel de animación: ALTO — animaciones ricas y variadas. Puede combinar múltiples efectos.",
}

_TEMPLATE_HINTS = {
    "minimal_grayscale": "Template: minimalista blanco y negro — sin colores saturados, máximo contraste.",
    "cozy_rain_particles": "Template: cozy rain & particles — ambiente íntimo, lluvia, partículas flotantes.",
    "financial_infographics": "Template: infografías financieras — limpio, corporativo, con elementos de datos.",
}


def _build_niche_hints(niche_cfg: NicheConfig) -> str:
    hints: list[str] = []
    template = niche_cfg.html_visualizer.template
    animation = niche_cfg.html_visualizer.animation_level
    if template in _TEMPLATE_HINTS:
        hints.append(_TEMPLATE_HINTS[template])
    if animation in _ANIMATION_HINTS:
        hints.append(_ANIMATION_HINTS[animation])
    if not hints:
        return ""
    return "\nHints del nicho:\n" + "\n".join(f"- {h}" for h in hints) + "\n"


async def run(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    if niche_cfg.pipeline_type == "config_driven_template":
        return await _run_vision_extraction(job, ai, niche_cfg)

    t_start = time.monotonic()
    analyzed = job.artifacts.analyzed_input
    logger.info("visual_designer_start", job_id=job.job_id, genre=analyzed.genre)

    skill = _load_skill(analyzed.genre)
    system = _SYSTEM_TEMPLATE.format(skill=skill, genre=analyzed.genre)
    prompt = _USER_TEMPLATE.format(
        genre=analyzed.genre,
        mood=", ".join(analyzed.mood_tags),
        description=analyzed.description,
        niche_hints=_build_niche_hints(niche_cfg),
    )
    raw = await ai.complete_json(system, prompt)

    try:
        design = VisualDesign(**raw)
    except Exception as exc:
        raise AIValidationError(f"VisualDesign validation failed: {exc}\nRaw: {raw}") from exc

    logs_dir: Path = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "02_diseno_visual.json").write_text(design.model_dump_json(indent=2), encoding="utf-8")

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info("visual_designer_done", job_id=job.job_id, style=design.style, elapsed=elapsed)

    artifacts = job.artifacts.model_copy(update={"visual_design": design})
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.DESIGN_COMPLETE)


# ─────────────────────────────────────────────────────────────────────────────
# pipeline_type == "config_driven_template"
# ─────────────────────────────────────────────────────────────────────────────

async def _run_vision_extraction(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    """Ejecuta el Prompt 1 (Vision Extractor) de la plantilla contra la imagen real.

    Requiere que job.artifacts.image_path ya exista — para pipeline_type
    "config_driven_template", pipeline.py corre resource_fetcher ANTES de
    este módulo (a diferencia del orden por defecto).
    """
    t_start = time.monotonic()
    artifacts = job.artifacts
    image_path = artifacts.image_path
    if image_path is None:
        raise AIValidationError(
            "visual_designer(config_driven_template): job.artifacts.image_path es None. "
            "resource_fetcher debe ejecutarse ANTES que visual_designer para este pipeline_type "
            "— revisar el orden de stages en pipeline.py."
        )

    logger.info(
        "visual_designer_vision_start",
        job_id=job.job_id,
        image=str(image_path),
        template=niche_cfg.template.template_id,
        asset_id=artifacts.image_asset_id,
    )

    logs_dir: Path = artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Nichos con template.requires_video=True (ej. motion-backdrop): no hay
    # image_asset_id real — image_path es un frame extraído del video, y el
    # cache/análisis se cachea por video_asset_id en su lugar.
    is_video_frame = artifacts.video_asset_id is not None

    # Reutilizar el análisis si esta misma imagen/video (asset_id) ya fue
    # analizada antes — el Prompt 1 es una llamada multimodal larga y costosa,
    # no vale la pena repetirla para un recurso que ya se procesó antes.
    vision_json: dict | None = None
    cache_hit = False
    if is_video_frame:
        vision_json = asset_library.get_video_vision_cache(artifacts.video_asset_id)
        cache_hit = vision_json is not None
    elif artifacts.image_asset_id:
        vision_json = asset_library.get_vision_cache(artifacts.image_asset_id)
        cache_hit = vision_json is not None

    if vision_json is None:
        prompt_path = get_template_paths(niche_cfg.template.template_id)["vision_prompt"]
        system_prompt = prompt_path.read_text(encoding="utf-8")
        vision_json = await ai.analyze_image_full(image_path, system_prompt)

    logger.info("visual_designer_vision_analyzed", job_id=job.job_id, cache_hit=cache_hit)

    # Rotación física si el JSON la pide — NUNCA para video: el motor de
    # motion-backdrop aplica la rotación en runtime vía CSS a partir de
    # video.rotation (re-encodear un video es lento y con pérdida); acá
    # image_path es solo un frame extraído descartable, rotarlo no cambia
    # nada del video real servido. Se aplica SIEMPRE sobre el archivo actual,
    # incluso en cache_hit: la copia física de bg.jpg de este job es nueva
    # cada vez, aunque el asset_id (y por lo tanto el análisis) se reutilice.
    if not is_video_frame:
        orientation = vision_json.get("orientation_check")
        rotation_deg = orientation.get("rotation_to_correct_deg", 0) if isinstance(orientation, dict) else 0
        if rotation_deg:
            apply_orientation_correction(image_path, rotation_deg)
            dims = vision_json.get("image_dimensions") or {}
            if dims.get("width_px") and dims.get("height_px"):
                verify_dimensions(image_path, dims["width_px"], dims["height_px"])

    if not cache_hit and is_video_frame:
        await asset_library.save_video_vision_cache(artifacts.video_asset_id, vision_json)
    elif not cache_hit and artifacts.image_asset_id:
        await asset_library.save_vision_cache(artifacts.image_asset_id, vision_json)

    if not is_video_frame and artifacts.image_asset_id:
        subject_label = (vision_json.get("main_subject") or {}).get("label", "")
        short_description = (vision_json.get("scene_overview") or {}).get("short_description", "")
        label = " — ".join(part for part in (subject_label, short_description) if part)
        await asset_library.update_image_label(artifacts.image_asset_id, label)

    (logs_dir / "02_vision_extraction.json").write_text(
        json.dumps(vision_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info("visual_designer_vision_done", job_id=job.job_id, elapsed=elapsed, cache_hit=cache_hit)

    new_artifacts = artifacts.model_copy(update={"vision_analysis": vision_json, "visual_design": None})
    return job.model_copy(update={"artifacts": new_artifacts}).advance(JobStage.DESIGN_COMPLETE)
