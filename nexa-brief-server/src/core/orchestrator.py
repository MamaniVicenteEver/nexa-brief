"""Orchestrator (Microkernel) — manages a batch of jobs with concurrency control."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

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

    async def _run_one(self, job: Job) -> Job:
        async with self._sem:
            logger.info("orchestrator_job_start", job_id=job.job_id, category=job.input.category_name)
            result = await pipeline.run(job)
            status = "success" if result.stage == JobStage.PACKAGED else "failed"
            logger.info("orchestrator_job_done", job_id=job.job_id, status=status)
            return result

    async def run_batch(
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
    ) -> BatchResult:
        """Generate *quantity* videos for the given category in parallel."""
        jobs = [
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
            ))
            for _ in range(quantity)
        ]

        logger.info(
            "orchestrator_batch_start",
            category=category_name,
            quantity=quantity,
            duration=duration_seconds,
            has_user_context=bool(user_context),
            max_parallel=self._sem._value,
        )

        t_start = time.monotonic()
        results = await asyncio.gather(*[self._run_one(j) for j in jobs])
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
