"""Recoverable JSON persistence adapter for the Academy pilot.

The adapter keeps the first vertical slice easy to inspect and migrate. All
writes are atomic and the domain does not know that JSON is being used.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypeVar

from src.academy.models import CurriculumPlan, GenerationBatch, PlanningSession
from src.academy.ports import AcademyRepositoryPort
from src.config.settings import BASE_DIR


ModelT = TypeVar("ModelT")


class JsonAcademyRepository(AcademyRepositoryPort):
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or BASE_DIR / "data" / "academy"
        self.sessions_dir = self.root / "sessions"
        self.plans_dir = self.root / "plans"
        self.batches_dir = self.root / "batches"
        for directory in (self.sessions_dir, self.plans_dir, self.batches_dir):
            directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _write(path: Path, value: ModelT) -> ModelT:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(value.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary.replace(path)
        return value

    @staticmethod
    def _read(path: Path, model_type: type[ModelT]) -> ModelT | None:
        if not path.exists():
            return None
        return model_type.model_validate_json(path.read_text(encoding="utf-8"))

    def save_session(self, session: PlanningSession) -> PlanningSession:
        return self._write(self.sessions_dir / f"{session.id}.json", session)

    def get_session(self, session_id: str) -> PlanningSession | None:
        return self._read(self.sessions_dir / f"{session_id}.json", PlanningSession)

    def save_plan(self, plan: CurriculumPlan) -> CurriculumPlan:
        return self._write(self.plans_dir / f"{plan.id}.json", plan)

    def get_plan(self, plan_id: str) -> CurriculumPlan | None:
        return self._read(self.plans_dir / f"{plan_id}.json", CurriculumPlan)

    def save_batch(self, batch: GenerationBatch) -> GenerationBatch:
        return self._write(self.batches_dir / f"{batch.id}.json", batch)

    def get_batch(self, batch_id: str) -> GenerationBatch | None:
        return self._read(self.batches_dir / f"{batch_id}.json", GenerationBatch)
