"""Persistent lesson queue for the Academy pilot."""

from __future__ import annotations

from datetime import datetime, timezone

import structlog

from src.academy.models import GenerationBatch, QueueItem, QueueItemStatus
from src.academy.repository import JsonAcademyRepository


logger = structlog.get_logger(__name__)


class AcademyGenerationQueue:
    def __init__(self, repository: JsonAcademyRepository | None = None) -> None:
        self.repository = repository or JsonAcademyRepository()

    def enqueue(self, plan_id: str, *, count: int | None = None) -> GenerationBatch:
        plan = self.repository.get_plan(plan_id)
        if plan is None:
            raise KeyError(f"Unknown Academy plan: {plan_id}")
        requested_count = count or plan.lesson_count
        requested_count = min(requested_count, plan.lesson_count)
        items = [
            QueueItem(lesson_id=lesson.id, order=index + 1)
            for index, lesson in enumerate(plan.lessons[:requested_count])
        ]
        batch = GenerationBatch(
            plan_id=plan.id,
            requested_count=requested_count,
            pilot_count=min(plan.pilot_count, requested_count),
            items=items,
        )
        logger.info(
            "academy_batch_enqueued",
            batch_id=batch.id,
            plan_id=plan.id,
            requested_count=requested_count,
            pilot_count=batch.pilot_count,
        )
        return self.repository.save_batch(batch)

    def update_item(
        self,
        batch_id: str,
        item_id: str,
        *,
        status: QueueItemStatus,
        output_path: str | None = None,
        error: str | None = None,
    ) -> GenerationBatch:
        batch = self.repository.get_batch(batch_id)
        if batch is None:
            raise KeyError(f"Unknown Academy batch: {batch_id}")
        for item in batch.items:
            if item.id == item_id:
                item.status = status
                item.output_path = output_path
                item.error = error
                item.attempts += 1 if status in {QueueItemStatus.RUNNING, QueueItemStatus.FAILED} else 0
                item.updated_at = datetime.now(timezone.utc)
                break
        else:
            raise KeyError(f"Unknown batch item: {item_id}")
        if all(item.status == QueueItemStatus.COMPLETED for item in batch.items):
            batch.status = QueueItemStatus.COMPLETED
        elif any(item.status == QueueItemStatus.FAILED for item in batch.items):
            batch.status = QueueItemStatus.FAILED
        elif any(item.status == QueueItemStatus.RUNNING for item in batch.items):
            batch.status = QueueItemStatus.RUNNING
        batch.updated_at = datetime.now(timezone.utc)
        return self.repository.save_batch(batch)
