"""Module 7a — Result Summarizer: the pipeline stage that writes the publishable copy.

Thin stage: resolves the song's language (content_language.py), asks
copy_writer.py for every platform's text using the strategies selected in
src/skills/output/copy/active.json, and stores the result. How the copy is
written lives in those strategy files, not here.
"""

from __future__ import annotations

import time
from dataclasses import asdict

import orjson
import structlog

from src.config.exceptions import AIValidationError
from src.config.niche_config import NicheConfig
from src.core.job import Job, JobStage, PlatformCopyText, VideoSummary
from src.core.metadata import CopyRenderError, StrategyError
from src.core.ports.ai_port import AIPort
from src.modules.content_language import resolve_content_language
from src.modules.copy_writer import CopyResult, build_facts, copy_language, copy_profile, write_copy

logger = structlog.get_logger(__name__)


def _to_summary(result: CopyResult, language: str) -> VideoSummary:
    copies = {
        platform: PlatformCopyText(
            title=c.title, description=c.description, tags=c.tags, strategy=c.strategy_id, pinned_comment=c.pinned_comment
        )
        for platform, c in result.copies.items()
    }
    youtube = copies.get("youtube")
    tiktok = copies.get("tiktok")
    return VideoSummary(
        youtube_title=youtube.title if youtube else "",
        youtube_description=youtube.description if youtube else "",
        youtube_tags=youtube.tags if youtube else [],
        tiktok_caption=tiktok.title if tiktok else "",
        tiktok_hashtags=tiktok.tags if tiktok else [],
        language=language,
        platform_copies=copies,
        pinned_comment=youtube.pinned_comment if youtube else "",
    )


def _write_prepared(job: Job) -> Job:
    """Textos preparados en el Sandbox (src/core/draft_details.py): se usan tal cual, sin IA."""
    summary = job.artifacts.summary
    logs_dir = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    final_summary = {
        **summary.model_dump(),
        "language_source": "prepared",
        "music": job.artifacts.music_meta,
        "image": job.artifacts.image_meta,
    }
    (logs_dir / "08_resumen_final.json").write_bytes(orjson.dumps(final_summary, option=orjson.OPT_INDENT_2))
    logger.info("result_summarizer_prepared", job_id=job.job_id, title=summary.youtube_title)
    return job.advance(JobStage.SUMMARY_GENERATED)


async def run(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    logger.info("result_summarizer_start", job_id=job.job_id)
    if job.artifacts.summary is not None and job.artifacts.summary.platform_copies:
        return _write_prepared(job)

    language = await resolve_content_language(job)
    profile = copy_profile(niche_cfg)
    language_code = copy_language(profile, language.code)
    try:
        result = await write_copy(ai, build_facts(job, niche_cfg), language_code, seed=job.job_id, profile=profile)
    except (StrategyError, CopyRenderError) as exc:
        raise AIValidationError(f"Copy generation failed: {exc}") from exc
    summary = _to_summary(result, language_code)

    logs_dir = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "08_prompt_metadata.txt").write_text(
        f"=== SYSTEM ===\n{result.system_prompt}\n\n=== USER ===\n{result.user_prompt}", encoding="utf-8"
    )
    final_summary = {
        **summary.model_dump(),
        "language_source": language.source,
        "language_confidence": language.confidence,
        "copy_pieces": asdict(result.pieces),
        "copy_unresolved_errors": result.unresolved_errors,
        "music": job.artifacts.music_meta,
        "image": job.artifacts.image_meta,
    }
    (logs_dir / "08_resumen_final.json").write_bytes(orjson.dumps(final_summary, option=orjson.OPT_INDENT_2))

    logger.info(
        "result_summarizer_done",
        job_id=job.job_id,
        title=summary.youtube_title,
        language=language_code,
        strategies={p: c.strategy for p, c in summary.platform_copies.items()},
        elapsed=round(time.monotonic() - t_start, 2),
    )

    artifacts = job.artifacts.model_copy(update={"summary": summary})
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.SUMMARY_GENERATED)
