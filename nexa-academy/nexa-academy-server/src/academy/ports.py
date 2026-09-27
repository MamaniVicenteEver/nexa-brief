"""Hexagonal ports for the Academy micro-kernel."""

from __future__ import annotations

from abc import ABC, abstractmethod

from src.academy.models import (
    AcademyCatalog,
    CurriculumPlan,
    GenerationBatch,
    PlanningSession,
)


class AcademyCatalogPort(ABC):
    @abstractmethod
    def load(self) -> AcademyCatalog:
        """Return the versioned curriculum catalog."""


class AcademyRepositoryPort(ABC):
    @abstractmethod
    def save_session(self, session: PlanningSession) -> PlanningSession:
        """Persist a planning conversation."""

    @abstractmethod
    def get_session(self, session_id: str) -> PlanningSession | None:
        """Load a planning conversation."""

    @abstractmethod
    def save_plan(self, plan: CurriculumPlan) -> CurriculumPlan:
        """Persist a curriculum version."""

    @abstractmethod
    def get_plan(self, plan_id: str) -> CurriculumPlan | None:
        """Load a curriculum version."""

    @abstractmethod
    def save_batch(self, batch: GenerationBatch) -> GenerationBatch:
        """Persist a generation batch."""

    @abstractmethod
    def get_batch(self, batch_id: str) -> GenerationBatch | None:
        """Load a generation batch."""
