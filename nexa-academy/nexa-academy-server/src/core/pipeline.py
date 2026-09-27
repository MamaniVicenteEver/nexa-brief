"""Pipeline — ejecuta los 8 stages secuencialmente para un Job."""

from __future__ import annotations

import time
from typing import Awaitable, Callable

import structlog

from src.adapters.ai.factory import get_analysis_ai, get_codegen_ai
from src.config.exceptions import NexaBriefError
from src.config.niche_config import get_niche_config
from src.config.settings import settings
from src.core.job import Job, JobStage, VisualDesign
from src.modules import (
    html_generator,
    input_analyzer,
    packager,
    prompt_architect,
    resource_fetcher,
    result_summarizer,
    video_recorder,
    visual_designer,
    voice_narrator,
)

logger = structlog.get_logger(__name__)


async def run(
    job: Job,
    on_stage: Callable[[Job], Awaitable[None]] | None = None,
    stop_after: JobStage | None = None,
) -> Job:
    """Ejecuta el pipeline completo de 8 stages para un video job.

    `on_stage`, si se da, se llama con el Job actualizado después de cada
    stage (y en caso de fallo) — usado por el job tracker (fire-and-forget)
    para persistir el progreso mientras el pipeline corre en background.

    `stop_after`, si se da, corta la ejecución apenas el Job llega a ese
    stage — usado por el preview de plantillas para parar en HTML_GENERATED,
    antes de video_recorder/packager (ver `src/presentation/api/routers/templates.py`).

    Retorna el Job final (stage=PACKAGED en éxito, FAILED en error, o el
    stage indicado en `stop_after` si se cortó ahí).
    """
    # ── Directorio de salida ──────────────────────────────────────────────────
    output_dir = settings.output_dir / job.job_id
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "logs").mkdir(exist_ok=True)

    artifacts = job.artifacts.model_copy(update={"output_dir": output_dir})
    job = job.model_copy(update={"artifacts": artifacts})
    if on_stage is not None:
        await on_stage(job)
    if stop_after is not None and job.stage == stop_after:
        return job

    # ── Cargar configuración del nicho ────────────────────────────────────────
    niche_cfg = get_niche_config(job.input.category_name)

    # ── Resolver adaptadores AI una sola vez por job ──────────────────────────
    analysis_ai = get_analysis_ai()
    codegen_ai = get_codegen_ai()

    t_start = time.monotonic()
    logger.info(
        "pipeline_start",
        job_id=job.job_id,
        category=job.input.category_name,
        niche=niche_cfg.display_name,
        has_reels=niche_cfg.has_reels_format(),
        image_validation=niche_cfg.image.validation.enabled,
    )

    # ── Construcción de la lista de stages (3 ramas) ──────────────────────────
    if niche_cfg.pipeline_type == "config_driven_template":
        # Plantilla estática (src/templates/<id>/) + config.json (ver src/templates/01-image-bg/).
        # resource_fetcher se adelanta: visual_designer necesita la imagen REAL
        # (ya descargada/provista) para poder analizarla con el Vision Extractor —
        # a diferencia del orden por defecto, donde visual_designer corre primero
        # sobre un diseño abstracto sin ninguna imagen todavía.
        analysis_stage = ("visual_designer", lambda j: visual_designer.run(j, analysis_ai, niche_cfg))
        stages = [
            ("input_analyzer",    lambda j: input_analyzer.run(j, analysis_ai, niche_cfg)),
            ("resource_fetcher",  lambda j: resource_fetcher.run(j, niche_cfg, analysis_ai)),
            analysis_stage,
            ("prompt_architect",  lambda j: prompt_architect.run(j, niche_cfg)),
            ("html_generator",    lambda j: html_generator.run(j, codegen_ai, niche_cfg)),
            ("voice_narrator",    lambda j: voice_narrator.run(j, niche_cfg)),
            ("video_recorder",    lambda j: video_recorder.run(j, niche_cfg)),
            ("result_summarizer", lambda j: result_summarizer.run(j, analysis_ai, niche_cfg)),
            ("packager",          lambda j: packager.run(j, niche_cfg)),
        ]
        logger.info(
            "pipeline_config_driven_template",
            job_id=job.job_id,
            niche=niche_cfg.id,
            template=niche_cfg.template.template_id,
        )
    else:
        # Orden por defecto (sin cambios): visual_designer corre ANTES que
        # resource_fetcher porque produce un diseño abstracto independiente
        # de cualquier imagen real.
        if niche_cfg.skip_visual_design:
            # Cuando skip_visual_design=True, inyectamos un VisualDesign mínimo y salteamos Gemini
            _static_design = VisualDesign(
                genre="ambient",
                style="image_only",
                colors=["#000000", "#FFFFFF"],
                fonts=["Inter"],
                animation="none",
                background_style="full_screen_cover",
            )

            async def _inject_design(j: Job) -> Job:
                a = j.artifacts.model_copy(update={"visual_design": _static_design})
                return j.model_copy(update={"artifacts": a}).advance(JobStage.DESIGN_COMPLETE)

            visual_designer_stage = ("visual_designer", _inject_design)
            logger.info("pipeline_skip_visual_design", job_id=job.job_id, niche=niche_cfg.id)
        else:
            visual_designer_stage = (
                "visual_designer", lambda j: visual_designer.run(j, analysis_ai, niche_cfg)
            )

        stages = [
            ("input_analyzer",    lambda j: input_analyzer.run(j, analysis_ai, niche_cfg)),
            visual_designer_stage,
            ("resource_fetcher",  lambda j: resource_fetcher.run(j, niche_cfg, analysis_ai)),
            ("prompt_architect",  lambda j: prompt_architect.run(j, niche_cfg)),
            ("html_generator",    lambda j: html_generator.run(j, codegen_ai, niche_cfg)),
            ("voice_narrator",    lambda j: voice_narrator.run(j, niche_cfg)),
            ("video_recorder",    lambda j: video_recorder.run(j, niche_cfg)),
            ("result_summarizer", lambda j: result_summarizer.run(j, analysis_ai, niche_cfg)),
            ("packager",          lambda j: packager.run(j, niche_cfg)),
        ]

    # ── Stage 9 — Publicación (opcional) ─────────────────────────────────────
    # El request puede desactivar publishing aunque ENABLE_AUTO_PUBLISHING=true en .env
    request_explicitly_disabled = (
        job.input.publishing and not job.input.publishing.enabled
    )
    is_publishing_enabled = (
        settings.enable_auto_publishing or job.input.publishing.enabled
    ) and not request_explicitly_disabled
    if is_publishing_enabled:
        from src.modules import social_publisher
        from src.adapters.publishing.factory import get_publisher_facade
        stages.append(
            ("social_publisher", lambda j: social_publisher.run(j, get_publisher_facade()))
        )
        logger.info(
            "pipeline_publishing_enabled",
            job_id=job.job_id,
            active_account=settings.active_account,
        )
    else:
        logger.info("pipeline_publishing_disabled", job_id=job.job_id)

    for stage_name, stage_fn in stages:
        try:
            logger.info("stage_start", stage=stage_name, job_id=job.job_id)
            job = await stage_fn(job)
            logger.info("stage_done", stage=stage_name, job_id=job.job_id, stage_state=job.stage)
            if on_stage is not None:
                await on_stage(job)
            if stop_after is not None and job.stage == stop_after:
                logger.info("pipeline_stopped_early", job_id=job.job_id, stop_after=stop_after.value)
                return job
        except NexaBriefError as exc:
            logger.error("stage_failed", stage=stage_name, job_id=job.job_id, error=str(exc))
            failed_job = job.fail(f"[{stage_name}] {exc}")
            if on_stage is not None:
                await on_stage(failed_job)
            return failed_job
        except Exception as exc:
            logger.exception("stage_unexpected_error", stage=stage_name, job_id=job.job_id)
            failed_job = job.fail(f"[{stage_name}] Unexpected: {exc}")
            if on_stage is not None:
                await on_stage(failed_job)
            return failed_job

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "pipeline_complete",
        job_id=job.job_id,
        elapsed=elapsed,
        output=str(job.artifacts.output_dir),
    )
    return job
