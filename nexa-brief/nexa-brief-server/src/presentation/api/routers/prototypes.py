"""Lectura de instrucciones y gestión de ideas para nuevos prototipos."""

from __future__ import annotations

from urllib.parse import urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Literal

from src.config.settings import settings
from src.core.prototypes import briefs, ideas, runs
from src.presentation.api.security import require_internal, sign_link, verify_link

router = APIRouter(tags=["prototypes"])
LINK_TTL_SECONDS = 7 * 24 * 60 * 60
_run_service: runs.PrototypeRunService | None = None


class PrototypeRunRequest(BaseModel):
    agent: Literal["claude", "codex"]
    template_id: str
    mode: Literal["full", "smoke"]


def get_prototype_run_service() -> runs.PrototypeRunService:
    global _run_service
    if _run_service is None:
        _run_service = runs.PrototypeRunService()
    return _run_service


def _run_response(record: dict, *, with_log: bool = False) -> dict:
    result = {
        key: value for key, value in record.items()
        if key not in {"log_path", "prompt"}
    }
    template_path = (
        settings.templates_dir / "sandbox" / record["category"] / record["template_id"] / "index.html"
    )
    result["template_url"] = (
        f"/api/v1/explainer/files/sandbox/{record['category']}/{record['template_id']}/index.html?controls=1"
        if template_path.is_file()
        else None
    )
    if with_log:
        result["log_tail"] = get_prototype_run_service().log_tail(record["run_id"])
    return result


def _idea_or_404(category: str, slug: str) -> ideas.Idea:
    try:
        return ideas.get_idea(category, slug)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="referencia no encontrada") from exc


def _signed_or_internal(request: Request, k: str | None = None) -> None:
    if k and verify_link(request.url.path, k):
        return
    try:
        require_internal(request.headers.get("X-Nexa-Internal"))
    except HTTPException as exc:
        if k:
            raise HTTPException(status_code=401, detail="firma de la URL inválida o vencida") from exc
        raise


def _public_base_url() -> str:
    parsed = urlsplit(settings.public_base_url.strip())
    if not parsed.netloc:
        raise HTTPException(status_code=503, detail="PUBLIC_BASE_URL debe ser una URL absoluta.")
    # Los links de chat siempre son HTTPS, también si el origen de desarrollo usa HTTP.
    return urlunsplit(("https", parsed.netloc, parsed.path.rstrip("/"), "", ""))


@router.get("/agent/prototipo", response_class=PlainTextResponse)
async def get_prototype_instructions() -> PlainTextResponse:
    """Sirve públicamente el punto de entrada PROTOTIPO.md."""
    path = settings.templates_dir / "sandbox" / "PROTOTIPO.md"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="PROTOTIPO.md no está disponible.")
    return PlainTextResponse(path.read_text(encoding="utf-8"), media_type="text/markdown")


@router.get("/agent/prototipo/{category}/{slug}", response_class=PlainTextResponse)
async def get_prototype_brief(
    category: str,
    slug: str,
    request: Request,
    k: str | None = Query(default=None),
) -> PlainTextResponse:
    """Devuelve el brief con firma válida o acceso interno desde Next."""
    _signed_or_internal(request, k)
    _idea_or_404(category, slug)
    try:
        return PlainTextResponse(briefs.compose_brief(category, slug), media_type="text/markdown")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="referencia no encontrada") from exc


@router.get("/agent/prototipo/{category}/{slug}/link", dependencies=[Depends(require_internal)])
async def get_prototype_link(category: str, slug: str) -> dict[str, str]:
    """Crea una URL firmada por siete días y devuelve sus rutas de trabajo."""
    idea = _idea_or_404(category, slug)
    path = f"/api/v1/agent/prototipo/{category}/{slug}"
    signature = sign_link(path, LINK_TTL_SECONDS)
    url = f"{_public_base_url()}{path}?{urlencode({'k': signature})}"
    prompt = f"Sos el agente líder de un prototipo nuevo de nexa-brief. Leé {url} y seguí sus instrucciones."
    ssh_path = (
        "alfred-server:~/Projects/Git-Projects/nexa-brief/nexa-brief/"
        f"nexa-brief-server/src/templates/sandbox/referencias/{category}/{slug}"
    )
    return {
        "url": url,
        "prompt": prompt,
        "ssh_path": ssh_path,
        "local_path": str(idea.path.resolve()),
    }


@router.post("/agent/prototipo/ideas", dependencies=[Depends(require_internal)], status_code=status.HTTP_201_CREATED)
async def create_prototype_idea(
    category: str = Form(...),
    title: str = Form(...),
    notes: str = Form(default=""),
    files: list[UploadFile] = File(default_factory=list),
) -> dict[str, object]:
    """Crea una carpeta de referencia y conserva cada archivo permitido."""
    uploads = [(upload.filename or "", upload.file) for upload in files if upload.filename]
    try:
        idea = ideas.create_idea(category, title, notes, uploads)
    except ideas.UploadTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except ideas.IdeaInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "category": idea.category,
        "slug": idea.slug,
        "title": idea.title,
        "path": str(idea.path.resolve()),
        "files": [attached.name for attached in idea.files],
    }


@router.post(
    "/agent/prototipo/{category}/{slug}/runs",
    dependencies=[Depends(require_internal)],
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_prototype_run(category: str, slug: str, body: PrototypeRunRequest) -> dict:
    """Encola un agente líder con permisos limitados a la fábrica del sandbox."""
    _idea_or_404(category, slug)
    service = get_prototype_run_service()
    try:
        record = await service.submit(
            category=category,
            slug=slug,
            agent=body.agent,
            template_id=body.template_id,
            mode=body.mode,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except runs.RunConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _run_response(record)


@router.get(
    "/agent/prototipo/{category}/{slug}/runs",
    dependencies=[Depends(require_internal)],
)
async def list_prototype_runs(category: str, slug: str) -> list[dict]:
    """Lista los runs de una idea, más recientes primero."""
    _idea_or_404(category, slug)
    service = get_prototype_run_service()
    await service.recover_interrupted()
    return [_run_response(record) for record in service.list(category, slug)]


@router.get("/agent/runs/{run_id}", dependencies=[Depends(require_internal)])
async def get_prototype_run(run_id: str) -> dict:
    """Devuelve estado, cola legible del log, tokens y enlace al prototipo."""
    service = get_prototype_run_service()
    await service.recover_interrupted()
    record = service.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run no encontrado")
    return _run_response(record, with_log=True)


@router.post("/agent/runs/{run_id}/cancel", dependencies=[Depends(require_internal)])
async def cancel_prototype_run(run_id: str) -> dict:
    """Cancela un run en cola o detiene el grupo de procesos del líder activo."""
    service = get_prototype_run_service()
    record = service.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run no encontrado")
    try:
        updated = await service.cancel(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _run_response(updated or record, with_log=True)
