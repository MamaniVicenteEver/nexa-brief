"""HTTP API for the Nexa Explainer presenter-video workflow."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse

from src.config.settings import settings
from src.config.exceptions import NexaBriefError
from src.explainer.models import (
    EditorialEmotionAnalysisRequest,
    EditorialRecutRequest,
    EditorialVoiceVariantRequest,
    ExplainerTemplateId,
    FeedbackRequest,
    ProjectResponse,
)
from src.explainer.service import ExplainerService, project_dir
from src.explainer.templates import TEMPLATE_CATALOG

router = APIRouter(prefix="/explainer", tags=["explainer"])
service = ExplainerService()
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9._-]+$")


def _response(project, project_id: str | None = None) -> ProjectResponse:
    project_id = project_id or project.id
    prefix = f"/api/v1/explainer/projects/{project_id}"
    return ProjectResponse(
        project=project,
        links={
            "self": prefix,
            "first_frame": f"{prefix}/asset/{project.paths.get('first_frame', 'first-frame.jpg')}",
            "preview": f"{prefix}/preview/",
        "transcript": f"{prefix}/asset/{project.paths.get('transcript', 'transcript.json')}",
        "audio": f"{prefix}/asset/{project.paths.get('audio', 'audio.wav')}",
        "director_plan": f"{prefix}/asset/{project.paths.get('director_plan', 'editorial-plan.json')}",
        "emotion_analysis": f"{prefix}/asset/{project.paths.get('emotion_analysis', 'editorial-emotion-analysis.json')}",
        "approve": f"{prefix}/approve",
            "feedback": f"{prefix}/feedback",
            "final_video": f"{prefix}/file/explainer.mp4",
        },
    )


async def _persist_upload(upload: UploadFile, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with destination.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            total += len(chunk)
            if total > settings.explainer_max_upload_mb * 1024 * 1024:
                destination.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"El video supera el límite de {settings.explainer_max_upload_mb} MB.",
                )
            output.write(chunk)
    if total == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    return total


@router.get("/templates")
async def list_explainer_templates() -> dict:
    return {"templates": TEMPLATE_CATALOG}


@router.get("/demos/centered-rails-60s.mp4", name="centered_rails_demo")
async def get_centered_rails_demo() -> FileResponse:
    """Serve the verified HyperFrames centered-presenter proof of concept."""
    path = settings.output_dir / "explainer" / "centered-rails-hyperframes-60s.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="La demo HyperFrames todavía no está disponible.")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename="centered-rails-60s.mp4",
        content_disposition_type="inline",
    )


@router.post("/projects/upload", response_model=ProjectResponse, status_code=202)
async def upload_explainer_video(
    video_file: UploadFile = File(..., description="Video horizontal de la persona hablando"),
    template_id: ExplainerTemplateId = Form(ExplainerTemplateId.EDITORIAL_SPLIT),
    language: str | None = Form(None),
    use_ai: bool = Form(True),
) -> ProjectResponse:
    filename = video_file.filename or "presenter.mp4"
    suffix = Path(filename).suffix.lower()
    if suffix not in {".mp4", ".mov", ".webm", ".mkv", ".m4v"}:
        raise HTTPException(status_code=415, detail="Formato no soportado. Usa MP4, MOV, WebM, MKV o M4V.")
    temporary = settings.output_dir / "explainer" / "_uploads" / f"{uuid.uuid4().hex}{suffix}"
    await _persist_upload(video_file, temporary)
    try:
        project = await service.create_upload(
            temporary, filename, template_id, language, allow_ai=use_ai
        )
    except (ValueError, RuntimeError) as exc:
        temporary.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _response(project)


@router.get("/projects")
async def list_explainer_projects() -> dict:
    return {"projects": [_response(project).model_dump(mode="json") for project in service.list()]}


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_explainer_project(project_id: str) -> ProjectResponse:
    project = service.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    return _response(project)


@router.get("/projects/{project_id}/preview/", response_class=HTMLResponse, name="explainer_preview")
async def get_explainer_preview(project_id: str) -> HTMLResponse:
    project = service.get(project_id)
    if not project or "preview_html" not in project.paths:
        raise HTTPException(status_code=404, detail="La preview todavía no está disponible.")
    html_path = project_dir(project_id) / project.paths["preview_html"]
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="Archivo de preview no encontrado.")
    html = html_path.read_text(encoding="utf-8")
    asset_prefix = f"/api/v1/explainer/projects/{project_id}/asset"
    presenter_name = project.paths.get("presenter_video", "presenter.mp4")
    asset_names = {value for value in project.paths.values() if isinstance(value, str)}
    if project.editorial_plan:
        for variant in (project.editorial_plan.audio.get("variants") or {}).values():
            if isinstance(variant, dict) and isinstance(variant.get("filename"), str):
                asset_names.add(variant["filename"])
    asset_names.add(presenter_name)
    for asset_name in asset_names:
        html = html.replace(f"../{asset_name}", f"{asset_prefix}/{asset_name}")
        html = html.replace(f'src="{asset_name}"', f'src="{asset_prefix}/{asset_name}"')
    return HTMLResponse(html)


@router.get("/projects/{project_id}/asset/{asset_name}", name="explainer_asset")
async def get_explainer_asset(project_id: str, asset_name: str) -> FileResponse:
    if not _SAFE_NAME.fullmatch(asset_name):
        raise HTTPException(status_code=400, detail="Nombre de asset inválido.")
    project = service.get(project_id)
    allowed = {value for value in project.paths.values() if isinstance(value, str)} if project else set()
    if project and project.editorial_plan:
        for variant in (project.editorial_plan.audio.get("variants") or {}).values():
            if isinstance(variant, dict) and isinstance(variant.get("filename"), str):
                allowed.add(variant["filename"])
    if not project or asset_name not in allowed:
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    path = project_dir(project_id) / asset_name
    if not path.exists():
        # presenter and first frame are stored in the project root.
        raise HTTPException(status_code=404, detail="Asset no encontrado.")
    return FileResponse(path)


@router.get("/projects/{project_id}/preview-audio/{filename}", name="explainer_preview_audio")
async def get_explainer_preview_audio(project_id: str, filename: str) -> FileResponse:
    """Serve an explicitly generated audio sample for browser review."""
    if not _SAFE_NAME.fullmatch(filename) or not filename.startswith("preview-segment-") or not filename.endswith(".mp3"):
        raise HTTPException(status_code=404, detail="Muestra de audio no encontrada.")
    project = service.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    path = project_dir(project_id) / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Muestra de audio no encontrada.")
    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=filename,
        content_disposition_type="inline",
    )


@router.get("/projects/{project_id}/preview-audio-player/{filename}", response_class=HTMLResponse)
async def get_explainer_preview_audio_player(project_id: str, filename: str) -> HTMLResponse:
    """Open a browser-friendly player for an explicitly generated audio sample."""
    if not _SAFE_NAME.fullmatch(filename) or not filename.startswith("preview-segment-") or not filename.endswith(".mp3"):
        raise HTTPException(status_code=404, detail="Muestra de audio no encontrada.")
    project = service.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    path = project_dir(project_id) / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Muestra de audio no encontrada.")
    source = f"/api/v1/explainer/projects/{project_id}/preview-audio/{filename}"
    return HTMLResponse(f"""<!doctype html>
<html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>Audio de prueba · Obama · segmento 01</title>
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#08090b;color:#f4f1ea;font:16px/1.5 Inter,Arial,sans-serif}}main{{width:min(680px,90vw);padding:32px;border:1px solid #30343a;background:#111317}}h1{{font-size:24px;margin:0 0 8px}}p{{color:#a8a39a}}audio{{width:100%;margin-top:18px}}</style></head>
<body><main><h1>Audio de prueba · Segmento 01</h1><p>Novita MiniMax Speech 2.8 Turbo · Patient_Man · dirección DeepSeek V4.1-Flash</p><audio controls autoplay preload=\"auto\" src=\"{source}\"></audio></main></body></html>""")


@router.post("/projects/{project_id}/editorial-recut", response_model=ProjectResponse)
async def create_editorial_recut(project_id: str, request: EditorialRecutRequest) -> ProjectResponse:
    """Build a director JSON, timed Spanish narration and editorial preview."""
    try:
        project = await service.create_editorial_recut(
            project_id,
            provider=request.provider,
            voice=request.voice,
            source_label=request.source_label,
            script_segments=request.script_segments,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    except (ValueError, RuntimeError, NexaBriefError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _response(project)


@router.post("/projects/{project_id}/editorial-recut/voice-variant", response_model=ProjectResponse)
async def create_editorial_voice_variant(
    project_id: str,
    request: EditorialVoiceVariantRequest,
) -> ProjectResponse:
    """Generate a selectable alternate voice for an approved editorial plan."""
    try:
        project = await service.create_editorial_voice_variant(project_id, voice=request.voice)
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    except (ValueError, RuntimeError, NexaBriefError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _response(project)


@router.post("/projects/{project_id}/editorial-emotion-analysis", response_model=ProjectResponse)
async def create_editorial_emotion_analysis(
    project_id: str,
    request: EditorialEmotionAnalysisRequest | None = None,
) -> ProjectResponse:
    """Ask DeepSeek for timed emotion and vocal-performance direction only."""
    del request  # Reserved for future source/language overrides; current project is authoritative.
    try:
        project = await service.analyze_editorial_emotion(project_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    except (ValueError, RuntimeError, NexaBriefError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _response(project)


@router.post("/projects/{project_id}/editorial-recut/audio", response_model=ProjectResponse)
async def create_editorial_recut_with_audio(
    project_id: str,
    audio_file: UploadFile = File(..., description="Narración o doblaje aportado por el usuario"),
) -> ProjectResponse:
    """Use a user-supplied narration while retaining the same director JSON."""
    suffix = Path(audio_file.filename or "narration.wav").suffix.lower()
    if suffix not in {".wav", ".mp3", ".m4a", ".ogg", ".flac"}:
        raise HTTPException(status_code=415, detail="Formato de audio no soportado.")
    temporary = settings.output_dir / "explainer" / "_uploads" / f"{uuid.uuid4().hex}{suffix}"
    await _persist_upload(audio_file, temporary)
    try:
        project = await service.create_editorial_recut(
            project_id,
            provider="local",
            uploaded_audio=temporary,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finally:
        temporary.unlink(missing_ok=True)
    return _response(project)


@router.get("/projects/{project_id}/file/{filename}", name="explainer_file")
async def get_explainer_file(project_id: str, filename: str) -> FileResponse:
    if filename != "explainer.mp4":
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    project = service.get(project_id)
    if not project or project.paths.get("final_video") != "rendered/explainer.mp4":
        raise HTTPException(status_code=404, detail="El render final todavía no está disponible.")
    path = project_dir(project_id) / "rendered" / "explainer.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="El render final todavía no está disponible.")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename="explainer.mp4",
        content_disposition_type="inline",
    )


@router.post("/projects/{project_id}/feedback", response_model=ProjectResponse)
async def update_explainer_feedback(project_id: str, request: FeedbackRequest) -> ProjectResponse:
    try:
        project = await service.update_feedback(project_id, request)
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _response(project)


@router.post("/projects/{project_id}/approve", response_model=ProjectResponse)
async def approve_explainer_project(project_id: str) -> ProjectResponse:
    try:
        project = await service.approve(project_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _response(project)
