"""Module 7a — Result Summarizer: generates YouTube/TikTok metadata via Gemini."""

from __future__ import annotations

import time

import orjson
import structlog

from src.config.exceptions import AIValidationError
from src.config.niche_config import NicheConfig
from src.config.settings import settings
from src.core.job import Job, JobStage, VideoSummary
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)


def _load_output_skill() -> str:
    skill_path = settings.skills_dir / "output" / "youtube_tiktok_copy.md"
    if skill_path.exists():
        return skill_path.read_text(encoding="utf-8")
    return "Soy un experto en copywriting para plataformas de video digital."


_SYSTEM_TEMPLATE = """\
{skill}

Eres un especialista en metadata y copywriting para YouTube y TikTok.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.
"""

_USER_TEMPLATE = """\
Genera los metadatos para este video musical:

Género: {genre}
Estilo visual: {style}
Descripción: {description}
Mood: {mood}
Duración: {duration} segundos

Devuelve un JSON con estos campos exactos:
- youtube_title: título atractivo para YouTube (máximo 70 caracteres)
- youtube_description: descripción detallada para YouTube (200-400 caracteres)
- youtube_tags: lista de 10-15 tags relevantes en inglés
- tiktok_caption: caption corto y atractivo para TikTok (máximo 150 caracteres)
- tiktok_hashtags: lista de 5-8 hashtags para TikTok (sin el #)
"""

# pipeline_type "config_driven_template": analyzed_input.genre/mood_tags/description
# pueden ser pura invención de Stage 1 (category_name es un id genérico de
# plantilla, no un género real) — acá se usa lo que SÍ es confiable: el
# análisis real de la imagen (Vision Extractor).
_USER_TEMPLATE_VISION = """\
Genera los metadatos para este video:

Sujeto de la imagen: {subject_label}
Descripción de la escena: {scene_description}
Estilo visual: {style}
{niche_metadata_block}
Duración: {duration} segundos

Devuelve un JSON con estos campos exactos:
- youtube_title: título atractivo para YouTube (máximo 70 caracteres)
- youtube_description: descripción detallada para YouTube (200-400 caracteres)
- youtube_tags: lista de 10-15 tags relevantes en inglés
- tiktok_caption: caption corto y atractivo para TikTok (máximo 150 caracteres)
- tiktok_hashtags: lista de 5-8 hashtags para TikTok (sin el #)
"""

_NICHE_METADATA_BLOCK = """\
Guía del nicho (curada, usarla para orientar tags/hashtags reales):
{lines}
"""


def _niche_metadata_block(niche_cfg: NicheConfig) -> str:
    meta = niche_cfg.metadata
    if not meta.genre and not meta.mood_tags and not meta.tag_hints:
        return ""
    lines = []
    if meta.genre:
        lines.append(f"- Género: {meta.genre}")
    if meta.mood_tags:
        lines.append(f"- Mood: {', '.join(meta.mood_tags)}")
    if meta.tag_hints:
        lines.append(f"- Tags/temas sugeridos: {', '.join(meta.tag_hints)}")
    return _NICHE_METADATA_BLOCK.format(lines="\n".join(lines))


async def run(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    analyzed = job.artifacts.analyzed_input
    design = job.artifacts.visual_design
    vision = job.artifacts.vision_analysis
    logger.info("result_summarizer_start", job_id=job.job_id)

    skill = _load_output_skill()
    system = _SYSTEM_TEMPLATE.format(skill=skill)

    if vision is not None:
        # pipeline_type="config_driven_template": usar el análisis REAL de la imagen
        # (siempre confiable) en vez de analyzed_input, que puede ser una invención
        # de Stage 1 sin relación con la imagen real cuando category_name es un id
        # genérico de plantilla.
        style = (vision.get("scene_overview") or {}).get("style") or "cinematic"
        subject_label = (vision.get("main_subject") or {}).get("label") or "el sujeto de la imagen"
        scene_description = (vision.get("scene_overview") or {}).get("short_description") or ""

        prompt = _USER_TEMPLATE_VISION.format(
            subject_label=subject_label,
            scene_description=scene_description,
            style=style,
            niche_metadata_block=_niche_metadata_block(niche_cfg),
            duration=analyzed.duration_seconds,
        )
    else:
        design_style = design.style if design else "cinematic"
        prompt = _USER_TEMPLATE.format(
            genre=analyzed.genre,
            style=design_style,
            description=analyzed.description,
            mood=", ".join(analyzed.mood_tags),
            duration=analyzed.duration_seconds,
        )

    raw = await ai.complete_json(system, prompt)

    try:
        summary = VideoSummary(**raw)
    except Exception as exc:
        raise AIValidationError(f"VideoSummary validation failed: {exc}\nRaw: {raw}") from exc

    logs_dir = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Build the enriched final summary combining AI-generated copy + resource metadata
    final_summary = {
        **summary.model_dump(),
        "audio": job.artifacts.audio_meta,
        "image": job.artifacts.image_meta,
    }
    (logs_dir / "08_resumen_final.json").write_bytes(
        orjson.dumps(final_summary, option=orjson.OPT_INDENT_2)
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info("result_summarizer_done", job_id=job.job_id, title=summary.youtube_title, elapsed=elapsed)

    artifacts = job.artifacts.model_copy(update={"summary": summary})
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.SUMMARY_GENERATED)
