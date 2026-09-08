"""Orchestrator (Microkernel) — manages a batch of jobs with concurrency control."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

import structlog

from src.config.settings import settings
from src.core import pipeline
from src.core.job import (
    DurationConfig,
    ImageSource,
    Job,
    JobInput,
    JobPublishingConfig,
    JobStage,
    MusicSource,
    SongInfo,
    VideoSource,
)

logger = structlog.get_logger(__name__)


@dataclass
class BatchResult:
    total: int
    elapsed_seconds: float = 0.0
    succeeded: list[Job] = field(default_factory=list)
    failed: list[Job] = field(default_factory=list)

    @property
    def success_count(self) -> int:
        return len(self.succeeded)

    @property
    def failure_count(self) -> int:
        return len(self.failed)


class Orchestrator:
    """Controls parallel execution of video jobs using an asyncio.Semaphore."""

    def __init__(self, max_parallel: int | None = None) -> None:
        self._sem = asyncio.Semaphore(max_parallel or settings.max_parallel_jobs)

    def build_jobs(
        self,
        category_name: str,
        quantity: int = 1,
        duration_seconds: int = 60,
        user_context: str | None = None,
        publishing: JobPublishingConfig | None = None,
        image_source: ImageSource | None = None,
        music_source: MusicSource | None = None,
        video_source: VideoSource | None = None,
        song_info: SongInfo | None = None,
        duration_config: DurationConfig | None = None,
        render_target: str | None = None,
        recorder_engine_override: str | None = None,
    ) -> list[Job]:
        """Construye los `Job` (con sus `job_id` ya asignados) sin correrlos.

        Separado de `run_batch` para el modelo fire-and-forget: el caller
        (router) necesita conocer los `job_id` de inmediato, antes de lanzar
        la ejecución real en background.
        """
        return [
            Job(input=JobInput(
                category_name=category_name,
                quantity=1,
                duration_seconds=duration_seconds,
                duration_config=duration_config,
                user_context=user_context,
                publishing=publishing or JobPublishingConfig(),
                image_source=image_source or ImageSource(),
                music_source=music_source or MusicSource(),
                video_source=video_source,
                song_info=song_info,
                render_target=render_target,
                recorder_engine_override=recorder_engine_override,
            ))
            for _ in range(quantity)
        ]

    async def _run_one(
        self, job: Job, on_stage: Callable[[Job], Awaitable[None]] | None = None
    ) -> Job:
        async with self._sem:
            logger.info("orchestrator_job_start", job_id=job.job_id, category=job.input.category_name)
            result = await pipeline.run(job, on_stage=on_stage)
            status = "success" if result.stage == JobStage.PACKAGED else "failed"
            logger.info("orchestrator_job_done", job_id=job.job_id, status=status)
            return result

    async def run_batch(
        self,
        jobs: list[Job] | None = None,
        on_stage: Callable[[Job], Awaitable[None]] | None = None,
        **build_kwargs,
    ) -> BatchResult:
        """Corre *jobs* en paralelo (acotado por el semáforo). Si `jobs` es
        `None`, los construye con `build_jobs(**build_kwargs)` — mantiene el
        comportamiento anterior para cualquier caller que no conozca el flujo
        de dos pasos (build_jobs temprano + run_batch en background)."""
        if jobs is None:
            jobs = self.build_jobs(**build_kwargs)
        quantity = len(jobs)
        category_name = jobs[0].input.category_name if jobs else build_kwargs.get("category_name", "")

        logger.info(
            "orchestrator_batch_start",
            category=category_name,
            quantity=quantity,
            max_parallel=self._sem._value,
        )

        t_start = time.monotonic()
        results = await asyncio.gather(*[self._run_one(j, on_stage=on_stage) for j in jobs])
        elapsed = round(time.monotonic() - t_start, 2)

        batch = BatchResult(total=quantity, elapsed_seconds=elapsed)
        for r in results:
            if r.stage == JobStage.PACKAGED:
                batch.succeeded.append(r)
            else:
                batch.failed.append(r)

        logger.info(
            "orchestrator_batch_done",
            category=category_name,
            succeeded=batch.success_count,
            failed=batch.failure_count,
            elapsed_seconds=elapsed,
        )
        return batch
