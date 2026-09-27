"""Academy API: planning conversation, curriculum JSON and lesson queue."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.academy.agent_runner import AcademyAgentRunner
from src.academy.agents import get_agent, list_agents
from src.academy.catalog import catalog_as_dict
from src.academy.models import PlanStatus
from src.academy.planning import AcademyPlanningService
from src.academy.queue import AcademyGenerationQueue
from src.academy.repository import JsonAcademyRepository
from src.academy.template_catalog import load_template_catalog, load_template_manifest, list_templates
from src.config.settings import settings
from src.presentation.api.schemas.academy_schema import (
    BatchResponse,
    AgentRunRequest,
    AgentRunResponse,
    ConversationMessageRequest,
    CreatePlanRequest,
    EnqueueBatchRequest,
    PlanResponse,
    SessionResponse,
)


router = APIRouter(prefix="/academy", tags=["academy"])
logger = structlog.get_logger(__name__)
repository = JsonAcademyRepository()
planning = AcademyPlanningService(repository)
generation_queue = AcademyGenerationQueue(repository)
agent_runner = AcademyAgentRunner()


@router.get("/catalog")
async def get_catalog() -> dict:
    """Return categories, levels, topics and lesson blueprints."""
    return catalog_as_dict()


@router.get("/templates")
async def get_template_catalog(category_id: str | None = None) -> dict:
    """Return approved teaching scenarios and their physical source files."""
    catalog = load_template_catalog()
    templates = list_templates(category_id)
    enriched_templates = []
    for template in templates:
        item = dict(template)
        item["file_urls"] = {
            kind: f"/api/v1/academy/templates/{template['id']}/files/{Path(path).name}"
            for kind, path in template.get("template_files", {}).items()
        }
        enriched_templates.append(item)

    categories = [
        {
            "id": category["id"],
            "name": category["name"],
            "readme_url": f"/api/v1/academy/categories/{category['id']}/readme",
            "template_count": len(category.get("templates", [])),
        }
        for category in load_template_manifest().get("categories", [])
    ]
    return {
        "schema_version": catalog["schema_version"],
        "render_contract": catalog["render_contract"],
        "categories": categories,
        "templates": enriched_templates,
    }


def _resolve_academy_file(template_id: str, filename: str) -> Path:
    template = next((item for item in list_templates() if item["id"] == template_id), None)
    if template is None:
        raise HTTPException(status_code=404, detail=f"Academy template '{template_id}' not found")

    allowed_paths = {
        Path(path).name: path for path in template.get("template_files", {}).values()
    }
    relative_path = allowed_paths.get(filename)
    if relative_path is None:
        raise HTTPException(status_code=404, detail=f"File '{filename}' is not part of this template")

    path = (settings.templates_dir / relative_path).resolve()
    if not path.is_relative_to(settings.templates_dir.resolve()) or not path.is_file():
        raise HTTPException(status_code=404, detail=f"File '{filename}' is not available")
    return path


@router.get("/templates/{template_id}/files/{filename}")
async def get_academy_template_file(template_id: str, filename: str) -> FileResponse:
    """Serve the approved HTML, CSS, JS or manifest for an Academy template."""
    path = _resolve_academy_file(template_id, filename)
    return FileResponse(path)


@router.get("/categories/{category_id}/readme")
async def get_academy_category_readme(category_id: str) -> FileResponse:
    """Serve the short authoring guide for one Academy category."""
    category = next(
        (item for item in load_template_manifest().get("categories", []) if item["id"] == category_id),
        None,
    )
    if category is None:
        raise HTTPException(status_code=404, detail=f"Academy category '{category_id}' not found")
    path = (settings.templates_dir / category["readme"]).resolve()
    if not path.is_relative_to(settings.templates_dir.resolve()) or not path.is_file():
        raise HTTPException(status_code=404, detail="Category README not available")
    return FileResponse(path, media_type="text/markdown")


@router.get("/agents")
async def get_agents() -> list[dict]:
    """Return the registered agents and their contracts for the UI and audit log."""
    return [asdict(agent) for agent in list_agents()]


@router.get("/agents/{agent_id}")
async def get_agent_prompt(agent_id: str) -> dict:
    try:
        return asdict(get_agent(agent_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/agents/{agent_id}/run", response_model=AgentRunResponse)
async def run_agent(agent_id: str, request: AgentRunRequest) -> AgentRunResponse:
    """Execute one scoped agent through the configured analysis adapter."""
    try:
        result = await agent_runner.run(agent_id, request.context, request.user_prompt)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("academy_agent_run_failed", agent_id=agent_id, error=str(exc))
        raise HTTPException(status_code=502, detail="Academy agent execution failed") from exc
    return AgentRunResponse(**result)


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_planning_session() -> SessionResponse:
    session = planning.new_session()
    return SessionResponse(session=session, next_action="Enviar el primer mensaje de planificación.")


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_planning_session(session_id: str) -> SessionResponse:
    session = repository.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Planning session not found")
    return SessionResponse(
        session=session,
        next_action="Crear plan" if session.ready_for_plan else "Completar datos de planificación",
    )


@router.post("/sessions/{session_id}/messages", response_model=SessionResponse)
async def send_planning_message(
    session_id: str,
    request: ConversationMessageRequest,
) -> SessionResponse:
    session = repository.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Planning session not found")
    updated = planning.add_message(session, request.content)
    return SessionResponse(
        session=updated,
        next_action="Crear plan" if updated.ready_for_plan else "Responder las preguntas pendientes",
    )


@router.post("/plans", response_model=PlanResponse, status_code=201)
async def create_curriculum_plan(request: CreatePlanRequest) -> PlanResponse:
    try:
        plan = planning.create_plan(**request.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return PlanResponse(plan=plan)


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_curriculum_plan(plan_id: str) -> PlanResponse:
    plan = repository.get_plan(plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Academy plan not found")
    return PlanResponse(plan=plan)


@router.post("/plans/{plan_id}/queue", response_model=BatchResponse, status_code=201)
async def enqueue_curriculum_plan(
    plan_id: str,
    request: EnqueueBatchRequest,
) -> BatchResponse:
    try:
        batch = generation_queue.enqueue(plan_id, count=request.count)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    plan = repository.get_plan(plan_id)
    if plan is not None:
        plan.status = PlanStatus.QUEUED
        repository.save_plan(plan)
    logger.info("academy_plan_queued", plan_id=plan_id, batch_id=batch.id)
    return BatchResponse(batch=batch)


@router.get("/batches/{batch_id}", response_model=BatchResponse)
async def get_generation_batch(batch_id: str) -> BatchResponse:
    batch = repository.get_batch(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Academy generation batch not found")
    return BatchResponse(batch=batch)
