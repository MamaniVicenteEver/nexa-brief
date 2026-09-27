"""Application services for the planning conversation and curriculum plan."""

from __future__ import annotations

import re
from datetime import datetime, timezone

import structlog

from src.academy.catalog import get_category, get_level, list_categories
from src.academy.template_catalog import default_template_id
from src.academy.models import (
    ConversationMessage,
    CurriculumPhase,
    CurriculumPlan,
    LessonSpec,
    MessageRole,
    PlanningSession,
)
from src.academy.repository import JsonAcademyRepository


logger = structlog.get_logger(__name__)


class AcademyPlanningService:
    def __init__(self, repository: JsonAcademyRepository | None = None) -> None:
        self.repository = repository or JsonAcademyRepository()

    def new_session(self) -> PlanningSession:
        session = PlanningSession()
        session.messages.append(
            ConversationMessage(
                role=MessageRole.ASSISTANT,
                content=(
                    "Comencemos la planificación. Elige una materia, un nivel y "
                    "el perfil del estudiante. Después definiremos objetivo, "
                    "cantidad de lecciones, duración, voz y plantilla."
                ),
            )
        )
        return self.repository.save_session(session)

    def add_message(self, session: PlanningSession, content: str) -> PlanningSession:
        clean = content.strip()
        session.messages.append(ConversationMessage(role=MessageRole.USER, content=clean))
        lowered = clean.casefold()

        for category in list_categories():
            if category.id.casefold() in lowered or category.name.casefold() in lowered:
                session.category_id = category.id
                break
        if session.category_id is None and any(word in lowered for word in ("inglés", "ingles", "english")):
            session.category_id = "english"
        if session.category_id is None and any(word in lowered for word in ("matemática", "matematica", "math")):
            session.category_id = "mathematics"

        level_match = re.search(r"\b(a1|a2|b1|b2|c1|primaria|inicial|secundaria)\b", lowered)
        if level_match and session.category_id:
            category = get_category(session.category_id)
            normalized = level_match.group(1)
            for level in category.levels:
                if normalized in {level.id.casefold(), level.title.casefold()}:
                    session.level_id = level.id
                    break

        if session.learner_profile is None and any(
            marker in lowered for marker in ("niño", "niña", "niños", "adulto", "estudiante", "primaria")
        ):
            session.learner_profile = clean

        if session.category_id and session.level_id and session.learner_profile:
            session.ready_for_plan = True

        response = self._next_response(session)
        session.messages.append(ConversationMessage(role=MessageRole.ASSISTANT, content=response))
        session.updated_at = datetime.now(timezone.utc)
        logger.info(
            "academy_planning_message",
            session_id=session.id,
            category_id=session.category_id,
            level_id=session.level_id,
            ready_for_plan=session.ready_for_plan,
        )
        return self.repository.save_session(session)

    @staticmethod
    def _next_response(session: PlanningSession) -> str:
        if not session.category_id:
            options = ", ".join(category.name for category in list_categories())
            return f"¿Qué materia quieres planificar primero? Opciones: {options}."
        if not session.level_id:
            category = get_category(session.category_id)
            options = ", ".join(level.id.upper() for level in category.levels)
            return f"Materia seleccionada: {category.name}. ¿Qué nivel quieres usar? Opciones: {options}."
        if not session.learner_profile:
            return "¿Para qué perfil de estudiante se creará el curso? Indica edad, experiencia y objetivo."
        return (
            "Ya tengo materia, nivel y perfil. Puedes crear una propuesta de "
            "10 lecciones piloto o indicarme cambios de objetivo, duración, voz "
            "y plantilla antes de generarla."
        )

    def create_plan(
        self,
        *,
        category_id: str,
        level_id: str,
        learner_profile: str,
        lesson_count: int = 10,
        target_duration_seconds: int = 900,
        pilot_duration_seconds: int = 15,
        pilot_count: int = 3,
        voice_provider: str = "gemini",
        voice_model: str = "gemini-2.5-flash-preview-tts",
        template_id: str | None = None,
        language: str = "es",
    ) -> CurriculumPlan:
        category = get_category(category_id)
        level = get_level(category_id, level_id)
        selected_template = template_id or default_template_id(category.id)
        blueprints = [
            (topic, blueprint)
            for topic in level.topics
            for blueprint in topic.lesson_blueprints
        ]
        if not blueprints:
            raise ValueError(f"Level '{level_id}' has no lesson blueprints")

        lessons: list[LessonSpec] = []
        for index in range(lesson_count):
            topic, blueprint = blueprints[index % len(blueprints)]
            title = str(blueprint.get("title", topic.title))
            description = str(blueprint.get("description", topic.description))
            objectives = [str(item) for item in blueprint.get("objectives", topic.objectives)]
            lessons.append(
                LessonSpec(
                    id=f"{category.id}-{level.id}-lesson-{index + 1:02d}",
                    order=index + 1,
                    phase_id=level.id,
                    topic_id=topic.id,
                    title=title,
                    description=description,
                    objectives=objectives,
                    scope_in=[topic.title, *objectives],
                    scope_out=["Temas de niveles posteriores", "Contenido no relacionado con el objetivo"],
                    target_duration_seconds=target_duration_seconds,
                    pilot_duration_seconds=pilot_duration_seconds,
                    template_id=selected_template,
                    voice_provider=voice_provider,
                    voice_model=voice_model,
                    script_text=(
                        f"En esta lección aprenderás: {title}. "
                        f"Objetivo: {description}."
                    ),
                )
            )

        phase = CurriculumPhase(
            id=level.id,
            title=level.title,
            description=level.description,
            level_id=level.id,
            lesson_ids=[lesson.id for lesson in lessons],
        )
        plan = CurriculumPlan(
            category_id=category.id,
            category_name=category.name,
            level_id=level.id,
            level_name=level.title,
            title=f"{category.name}: {level.title}",
            purpose="Crear una base educativa clara, progresiva y verificable.",
            learner_profile=learner_profile,
            language=language,
            template_family=category.template_family,
            template_id=selected_template,
            voice_provider=voice_provider,
            voice_model=voice_model,
            target_duration_seconds=target_duration_seconds,
            pilot_duration_seconds=pilot_duration_seconds,
            lesson_count=len(lessons),
            pilot_count=min(pilot_count, len(lessons)),
            phases=[phase],
            lessons=lessons,
        )
        logger.info(
            "academy_plan_created",
            plan_id=plan.id,
            category_id=category.id,
            level_id=level.id,
            lesson_count=plan.lesson_count,
            pilot_count=plan.pilot_count,
        )
        return self.repository.save_plan(plan)
