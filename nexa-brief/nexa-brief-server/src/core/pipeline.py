"""Pipeline — ejecuta los 8 stages secuencialmente para un Job."""

from __future__ import annotations

import time
from typing import Awaitable, Callable

import structlog

from src.adapters.ai.factory import get_analysis_ai, get_codegen_ai
from src.config.exceptions import NexaBriefError
from src.config.niche_config import get_niche_config
from src.config.settings import settings
from src.core.job import DurationConfig, DurationMode, Job, JobStage, VisualDesign
from src.core.progress import (
    ProgressTracker,
    bind_tracker,
    get_or_create_tracker,
    recorder_key,
    release_tracker,
)
from src.modules import (
    html_generator,
    input_analyzer,
    lyrics_transcriber,
    packager,
    prompt_architect,
    resource_fetcher,
    result_summarizer,
    video_recorder,
    visual_designer,
)

logger = structlog.get_logger(__name__)

# JobStage en que deja el Job cada stage al terminar bien. Es lo que permite
# retomar (`resume=True`): el orden de los stages cambia según la rama (en
# config_driven_template resource_fetcher va antes que visual_designer), así
# que no alcanza con comparar el orden del enum — se busca en la lista REAL de
# stages de esta corrida cuál produjo `job.stage` y se sigue desde el próximo.
_STAGE_RESULT: dict[str, JobStage] = {
    "input_analyzer": JobStage.INPUT_ANALYZED,
    "visual_designer": JobStage.DESIGN_COMPLETE,
    "lyrics_transcriber": JobStage.DESIGN_COMPLETE,
    "resource_fetcher": JobStage.RESOURCES_FETCHED,
    "prompt_architect": JobStage.PROMPT_BUILT,
    "html_generator": JobStage.HTML_GENERATED,
    "video_recorder": JobStage.VIDEO_RECORDED,
    "result_summarizer": JobStage.SUMMARY_GENERATED,
    "packager": JobStage.PACKAGED,
    "social_publisher": JobStage.PUBLISHED,
}

Stage = tuple[str, Callable[[Job], Awaitable[Job]]]


def _remaining_stages(stages: list[Stage], current: JobStage) -> list[Stage]:
    """Los stages que faltan para un Job que ya llegó a `current`."""
    if current == JobStage.PENDING:
        return stages
    # PUBLISHING = quedó a mitad de publicar: se reintenta social_publisher.
    if current == JobStage.PUBLISHING:
        current = JobStage.PACKAGED
    for index, (name, _) in enumerate(stages):
        if _STAGE_RESULT.get(name) == current:
            return stages[index + 1:]
    raise ValueError(f"No se puede retomar un Job en stage '{current.value}' con estos stages")


async def run(
    job: Job,
    on_stage: Callable[[Job], Awaitable[None]] | None = None,
    stop_after: JobStage | None = None,
    resume: bool = False,
) -> Job:
    """Ejecuta el pipeline completo de 8 stages para un video job.

    `on_stage`, si se da, se llama con el Job actualizado después de cada
    stage (y en caso de fallo) — usado por el job tracker (fire-and-forget)
    para persistir el progreso mientras el pipeline corre en background.

    `stop_after`, si se da, corta la ejecución apenas el Job llega a ese
    stage — usado por el preview de plantillas para parar en HTML_GENERATED,
    antes de video_recorder/packager (ver `src/presentation/api/routers/templates.py`).

    `resume=True` retoma un Job que ya avanzó (ej. un draft que quedó en
    HTML_GENERATED, ver `src/core/drafts.py`): saltea los stages ya hechos —
    sus artifacts viajan en el Job — y sigue con video_recorder → ... →
    social_publisher. Sin `resume` el Job siempre corre desde el primer stage.
    Un Job FAILED no se retoma (no se sabe qué quedó a medias): ValueError.

    Retorna el Job final (stage=PACKAGED en éxito, FAILED en error, o el
    stage indicado en `stop_after` si se cortó ahí).
    """
    if resume and job.stage == JobStage.FAILED:
        raise ValueError(f"Job '{job.job_id}' está FAILED: retomar desde el último stage sano")

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

    # Nichos con video.duration_locked_to_music=True (ej. lyrics_video_*): la
    # duración del video TIENE que ser la duración real de la canción — nunca
    # loop, nunca manual, nunca el default de 60s — o la letra queda cortada o
    # desincronizada. Se fuerza ACÁ, antes de que resource_fetcher la use,
    # ignorando cualquier duration_config que haya venido en el request (así
    # un request mal formado no puede saltarse la regla).
    if niche_cfg.video.duration_locked_to_music:
        job = job.model_copy(update={
            "input": job.input.model_copy(update={
                "duration_config": DurationConfig(mode=DurationMode.AUTO, repeat_count=1)
            })
        })

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
        # Plantilla estática registrada en templates.json + config.json.
        # resource_fetcher se adelanta: visual_designer necesita la imagen REAL
        # (ya descargada/provista) para poder analizarla con el Vision Extractor —
        # a diferencia del orden por defecto, donde visual_designer corre primero
        # sobre un diseño abstracto sin ninguna imagen todavía.
        if niche_cfg.template.requires_lyrics:
            # Nichos de letras (lyrics_video_*): no hay imagen que analizar — en
            # el lugar del Vision Extractor va lyrics_transcriber, que transcribe
            # la canción real ya resuelta por resource_fetcher.
            analysis_stage = ("lyrics_transcriber", lambda j: lyrics_transcriber.run(j, niche_cfg))
        else:
            analysis_stage = ("visual_designer", lambda j: visual_designer.run(j, analysis_ai, niche_cfg))
        stages = [
            ("input_analyzer",    lambda j: input_analyzer.run(j, analysis_ai, niche_cfg)),
            ("resource_fetcher",  lambda j: resource_fetcher.run(j, niche_cfg, analysis_ai)),
            analysis_stage,
            ("prompt_architect",  lambda j: prompt_architect.run(j, niche_cfg)),
            ("html_generator",    lambda j: html_generator.run(j, codegen_ai, niche_cfg)),
            ("video_recorder",    lambda j: video_recorder.run(j, niche_cfg)),
            ("result_summarizer", lambda j: result_summarizer.run(j, analysis_ai, niche_cfg)),
            ("packager",          lambda j: packager.run(j, niche_cfg)),
        ]
        logger.info(
            "pipeline_config_driven_template",
            job_id=job.job_id,
            niche=niche_cfg.id,
            template=niche_cfg.template.template_id,
            requires_lyrics=niche_cfg.template.requires_lyrics,
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

    if resume:
        stages = _remaining_stages(stages, job.stage)
        logger.info(
            "pipeline_resume",
            job_id=job.job_id,
            from_stage=job.stage.value,
            remaining=[name for name, _ in stages],
        )

    tracker = get_or_create_tracker(job.job_id)
    engine = job.input.recorder_engine_override or niche_cfg.recorder_engine
    tracker.set_plan(
        [(name, recorder_key(engine) if name == "video_recorder" else name) for name, _ in stages],
        video_seconds=job.input.duration_seconds,
    )

    try:
        for stage_name, stage_fn in stages:
            try:
                logger.info("stage_start", stage=stage_name, job_id=job.job_id)
                await tracker.start_step(stage_name)
                with bind_tracker(tracker):
                    job = await stage_fn(job)
                logger.info("stage_done", stage=stage_name, job_id=job.job_id, stage_state=job.stage)
                if job.artifacts.analyzed_input is not None:
                    tracker.update_video_seconds(job.artifacts.analyzed_input.duration_seconds)
                if on_stage is not None:
                    await on_stage(job)
                if stop_after is not None and job.stage == stop_after:
                    logger.info("pipeline_stopped_early", job_id=job.job_id, stop_after=stop_after.value)
                    await tracker.finish(success=True)
                    return job
            except NexaBriefError as exc:
                logger.error("stage_failed", stage=stage_name, job_id=job.job_id, error=str(exc))
                return await _fail(job, tracker, on_stage, f"[{stage_name}] {exc}")
            except Exception as exc:
                logger.exception("stage_unexpected_error", stage=stage_name, job_id=job.job_id)
                return await _fail(job, tracker, on_stage, f"[{stage_name}] Unexpected: {exc}")
        await tracker.finish(success=True)
    finally:
        release_tracker(job.job_id)

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "pipeline_complete",
        job_id=job.job_id,
        elapsed=elapsed,
        output=str(job.artifacts.output_dir),
    )
    return job


async def _fail(job: Job, tracker: ProgressTracker, on_stage: Callable[[Job], Awaitable[None]] | None, error: str) -> Job:
    failed_job = job.fail(error)
    await tracker.finish(success=False)
    if on_stage is not None:
        await on_stage(failed_job)
    return failed_job
