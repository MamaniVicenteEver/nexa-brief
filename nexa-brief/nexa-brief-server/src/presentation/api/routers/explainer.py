"""Explainer router — API propia de las categorías con motor explainer-kit
(NodeTech, NodeHistory, NodePolitics, NodeEconomy). NodeMotion sigue en /templates.

Catálogo y grabación:
  GET  /explainer/videos[?category=]          → videos con estado, categoría y último job.
  POST /explainer/videos/{id}/record          → render + output/<categoría>/ (+ publicar si se pide).
  GET  /explainer/jobs/{job_id}               → estado de una grabación.
  POST /explainer/videos/{id}/publish-texts   → genera publish.json de un video ya producido.

Crear (tema → textos → producción con agente local, sin grabar):
  GET  /explainer/options                     → agentes y proveedores de texto disponibles.
  GET  /explainer/designs?category=           → diseños que puede usar la categoría + preview.
  POST /explainer/briefs                      → títulos/descr./gancho/esquema. No guarda nada.
  POST /explainer/productions (multipart)     → crea el video y lanza al agente (Claude Code/Codex).
  GET  /explainer/productions[?category=]     → producciones.
  GET  /explainer/productions/{id}            → una producción con la cola del log.
  POST /explainer/productions/{id}/resume     → retoma una producción incompleta o fallida.

Previsualizar:
  GET  /explainer/files/{path}                → archivos del kit y de los videos (iframe de preview).
"""

from __future__ import annotations

import json
import shutil
import tempfile
from functools import lru_cache
from pathlib import Path

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import ValidationError

from src.adapters.agent.factory import AGENTS, agents_status
from src.adapters.ai.factory import TEXT_PROVIDERS, get_text_ai
from src.adapters.publishing.factory import get_publisher_facade
from src.config.exceptions import NexaBriefError
from src.config.settings import settings
from src.core.categories import explainer_folders, get_category, list_categories
from src.core.explainer.briefs import ExplainerBrief, generate_brief, generate_publish_texts, write_publish_json
from src.core.explainer import lengths, thumbnails
from src.core.explainer.publishing import review as review_package
from src.core.explainer.publishing.store import is_package, read_publish
from src.core.explainer.catalog import TEMPLATES_DIR, ExplainerVideo, get_video, list_videos
from src.core.explainer.component_preview import ComponentPreviewError, build_component_previews
from src.core.explainer.designs import KitDesign, designs_for, list_designs, load_design
from src.core.explainer.producer import ExplainerProducer
from src.core.explainer.recorder import ExplainerRecorder, RecordJob
from src.presentation.api.schemas.component_preview_schema import (
    ComponentPreviewBatchRequest,
    ComponentPreviewBatchResponse,
)
from src.presentation.api.schemas.explainer_schema import (
    BriefRequest,
    CategoryDesignsResponse,
    DesignGroupResponse,
    DesignResponse,
    ExplainerJobResponse,
    ExplainerOptionsResponse,
    ExplainerVideoResponse,
    LengthOptionsResponse,
    LengthPresetResponse,
    ProductionRequest,
    ProductionResponse,
    ProviderStatus,
    PublishIssueResponse,
    PublishPackageResponse,
    PublishTextsRequest,
    PublishTextsResponse,
    RecordExplainerRequest,
    ThumbnailChoiceRequest,
    ThumbnailOptionResponse,
    ThumbnailsResponse,
)

router = APIRouter(tags=["explainer"])
logger = structlog.get_logger(__name__)

FILES_PREFIX = "/api/v1/explainer/files"
MAX_UPLOAD_BYTES = 300 * 1024 * 1024


@lru_cache(maxsize=1)
def get_recorder() -> ExplainerRecorder:
    return ExplainerRecorder(publisher_getter=get_publisher_facade, thumbnail_renderer=thumbnails.render)


@lru_cache(maxsize=1)
def get_producer() -> ExplainerProducer:
    return ExplainerProducer(recorder_getter=get_recorder)


def _video_preview_url(video: ExplainerVideo) -> str:
    rel = video.path.relative_to(TEMPLATES_DIR).as_posix()
    return f"{FILES_PREFIX}/{rel}/index.html"


def _poster_url(video: ExplainerVideo) -> str | None:
    """Portada render/poster.jpg (kit.py poster); ?v= cambia si se regenera."""
    poster = video.path / "render" / "poster.jpg"
    if not poster.exists():
        return None
    base = _video_preview_url(video).replace("/index.html", "/render/poster.jpg")
    return f"{base}?v={int(poster.stat().st_mtime)}"


def _render_video_url(video: ExplainerVideo, fmt: str) -> str | None:
    """render/<video>-<fmt>.mp4 del video, si ya se grabó."""
    name = f"{video.path.name}-{fmt}.mp4"
    if not (video.path / "render" / name).exists():
        return None
    return _video_preview_url(video).replace("/index.html", f"/render/{name}")


def _design_demo(design: KitDesign) -> ExplainerVideo | None:
    """Video que muestra el diseño: <diseño>-demo o, si no hay, uno terminado con ese
    diseño (primero los de la categoría del diseño)."""
    demo = get_video(f"{design.design_id}-demo")
    if demo is not None:
        return demo
    ready = [v for v in list_videos() if v.design == design.design_id and v.ready]
    ready.sort(key=lambda v: v.category_path != design.category_path)
    return ready[0] if ready else None


def _design_response(design: KitDesign) -> DesignResponse:
    demo = _design_demo(design)
    return DesignResponse(
        design_id=design.design_id,
        name=design.name,
        tagline=design.tagline,
        topics=design.topics,
        voice=design.voice,
        category_path=design.category_path,
        preview_url=_video_preview_url(demo) if demo else None,
        poster_url=_poster_url(demo) if demo else None,
        video_url=_render_video_url(demo, "16x9") if demo else None,
        video_portrait_url=_render_video_url(demo, "9x16") if demo else None,
    )


def _thumbnails(video: ExplainerVideo) -> ThumbnailsResponse:
    specs = thumbnails.intro_specs(video)
    if not specs:
        return ThumbnailsResponse()
    base = _video_preview_url(video).replace("/index.html", "/render")
    options = []
    for option, spec in specs.items():
        path = thumbnails.thumbnail_file(video, option)
        url = f"{base}/{path.name}?v={int(path.stat().st_mtime)}" if path.exists() else None
        # la foto va con ruta desde src/templates/ ("/nodehistory/…"): para el navegador, por la API de archivos
        params = {k: (f"{FILES_PREFIX}{v}" if k == "src" and isinstance(v, str) and v.startswith("/") else v)
                  for k, v in spec["params"].items()}
        options.append(ThumbnailOptionResponse(option=option, component=spec["component"], params=params, url=url))
    return ThumbnailsResponse(chosen=thumbnails.chosen_option(video), options=options)


def _job_response(job: RecordJob) -> ExplainerJobResponse:
    return ExplainerJobResponse(
        job_id=job.job_id,
        video_id=job.video_id,
        state=job.state.value,
        category_path=job.category_path,
        duration=job.duration,
        publish=job.publish,
        privacy=job.privacy,
        account_selector=job.account_selector,
        account_selectors=job.account_selectors,
        error=job.error,
        outputs=job.outputs,
        output_dir=job.output_dir,
        publish_result=job.publish_result,
        publish_results=job.publish_results,
        scheduled_job_id=job.scheduled_job_id,
        formats=list(job.formats),
        render_seconds=job.render_seconds,
    )


def _publish_package(video: ExplainerVideo) -> PublishPackageResponse | None:
    """Paquete v2 + validación; un paquete o estrategia rotos se informan sin tumbar la lista."""
    try:
        result = review_package(video)
    except (ValueError, OSError) as exc:  # JSON roto, ValidationError, StrategyError
        issue = PublishIssueResponse(level="error", field="publish.json", message=f"paquete inválido: {exc}")
        return PublishPackageResponse(issues=[issue])
    if result is None:
        return None
    image = result.package.thumbnail.with_image.image
    title_rules = result.strategies.title
    return PublishPackageResponse(
        package=result.package,
        hook_strategy_names={n: hook.name for n, hook in title_rules.hook_strategies.items()},
        title_max_chars=title_rules.max_chars,
        issues=[PublishIssueResponse(level=i.level, field=i.field, message=i.message) for i in result.issues],
        thumbnail_image_url=(
            _video_preview_url(video).replace("/index.html", f"/assets/media/{image}") if image else None
        ),
    )


def _video_response(video: ExplainerVideo) -> ExplainerVideoResponse:
    top_id = video.category_path.split("/", 1)[0]
    top = list_categories().get(top_id)
    last = get_recorder().latest_for_video(video.video_id)
    return ExplainerVideoResponse(
        video_id=video.video_id,
        design=video.design,
        category_id=top_id,
        category_name=top.display_name if top else "Sin categoría",
        category_path=video.category_path,
        title=video.title,
        topic=video.topic,
        status=video.status,
        ready=video.ready,
        publish_ready=video.publish_ready,
        rendered=video.rendered,
        duration_seconds=video.duration_seconds,
        youtube_title=video.youtube_title,
        youtube_description=video.youtube_description,
        youtube_tags=video.youtube_tags,
        facebook_title=video.facebook_title,
        facebook_description=video.facebook_description,
        tiktok_caption=video.tiktok_caption,
        tiktok_hashtags=video.tiktok_hashtags,
        design_name=(design.name if (design := load_design(video.design)) else video.design),
        demo=video.demo,
        preview_url=_video_preview_url(video),
        poster_url=_poster_url(video),
        last_job=_job_response(last) if last else None,
        publish_package=_publish_package(video),
        thumbnails=_thumbnails(video),
    )


def _in_category(path: str, category: str | None) -> bool:
    return not category or path == category or path.startswith(category + "/")


def _text_ai(provider: str | None):
    name = provider or settings.explainer_text_provider
    if name not in TEXT_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"proveedor desconocido: {name}")
    try:
        return get_text_ai(name)
    except NexaBriefError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _production_response(rec: dict, with_log: bool = False) -> ProductionResponse:
    data = {k: v for k, v in rec.items() if k in ProductionResponse.model_fields}
    if with_log:
        data["log_tail"] = get_producer().log_tail(rec["production_id"])
    return ProductionResponse(**data)


# ── Catálogo y grabación ─────────────────────────────────────────────────────

@router.get("/explainer/videos", response_model=list[ExplainerVideoResponse])
async def list_explainer_videos(category: str | None = None) -> list[ExplainerVideoResponse]:
    return [_video_response(v) for v in list_videos() if _in_category(v.category_path, category)]


@router.post(
    "/explainer/videos/{video_id}/record",
    response_model=ExplainerJobResponse,
    status_code=202,
)
async def record_explainer_video(video_id: str, body: RecordExplainerRequest) -> ExplainerJobResponse:
    video = get_video(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail=f"video no encontrado: {video_id}")
    try:
        job = get_recorder().submit(
            video,
            duration=body.duration,
            publish=body.publish,
            privacy=body.privacy,
            account_selector=body.account_selector,
            account_selectors=body.account_selectors,
            formats=body.formats,
            account_formats=body.account_formats,
            thumbnail=body.thumbnail,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info("explainer_record_submitted", video_id=video_id, job_id=job.job_id, publish=body.publish)
    return _job_response(job)


def _video_or_404(video_id: str) -> ExplainerVideo:
    video = get_video(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail=f"video no encontrado: {video_id}")
    return video


@router.post("/explainer/videos/{video_id}/thumbnails", response_model=ThumbnailsResponse)
async def capture_thumbnails(video_id: str) -> ThumbnailsResponse:
    """Captura las miniaturas A (introv1) y B (introv2) con los textos actuales del paquete."""
    video = _video_or_404(video_id)
    if not thumbnails.intro_specs(video):
        raise HTTPException(status_code=409, detail=f"el diseño {video.design} no tiene intros para miniaturas")
    try:
        await thumbnails.render(video)
    except thumbnails.ThumbnailError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return _thumbnails(video)


@router.put("/explainer/videos/{video_id}/thumbnail", response_model=ThumbnailsResponse)
async def choose_thumbnail(video_id: str, body: ThumbnailChoiceRequest) -> ThumbnailsResponse:
    """Elige la miniatura que se sube a YouTube (queda en publish.json)."""
    video = _video_or_404(video_id)
    try:
        thumbnails.choose(video, body.option)
        await thumbnails.ensure(video, body.option)
    except thumbnails.ThumbnailError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _thumbnails(video)


@router.get("/explainer/jobs/{job_id}", response_model=ExplainerJobResponse)
async def get_explainer_job(job_id: str) -> ExplainerJobResponse:
    job = get_recorder().get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"job no encontrado: {job_id}")
    return _job_response(job)


@router.post("/explainer/videos/{video_id}/publish-texts", response_model=PublishTextsResponse)
async def create_publish_texts(video_id: str, body: PublishTextsRequest) -> PublishTextsResponse:
    video = get_video(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail=f"video no encontrado: {video_id}")
    video_dir = video.path
    if not any((video_dir / "assets" / f).exists() for f in ("script.json", "lyrics.json")):
        raise HTTPException(status_code=400, detail="el video todavía no tiene guion ni transcripción")
    if is_package(read_publish(video_dir)):
        raise HTTPException(
            status_code=409,
            detail="este video tiene un paquete de publicación v2: se edita su publish.json y se reconstruye "
            "con `python -m src.core.explainer.publishing build <video_id>`",
        )
    ai = _text_ai(body.provider)
    try:
        brief = await generate_publish_texts(
            ai, video_dir, category_path=video.category_path, design=load_design(video.design)
        )
    except NexaBriefError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    written = write_publish_json(video_dir, brief, overwrite=body.overwrite)
    return PublishTextsResponse(video_id=video_id, written=written, brief=brief.model_dump())


# ── Crear: opciones, diseños, textos, producción ─────────────────────────────

@router.get("/explainer/options", response_model=ExplainerOptionsResponse)
async def explainer_options() -> ExplainerOptionsResponse:
    agents = [ProviderStatus(**a) for a in agents_status()]
    available = {a.name: a.available for a in agents}
    text = [ProviderStatus(name=n, available=available.get(n, bool(settings.deepseek_api_key))) for n in TEXT_PROVIDERS]
    return ExplainerOptionsResponse(
        agents=agents,
        text_providers=text,
        default_agent=settings.explainer_agent,
        default_text_provider=settings.explainer_text_provider,
        lengths=LengthOptionsResponse(
            presets=[LengthPresetResponse(minutes=p.minutes, id=p.id, label=p.label) for p in lengths.presets()],
            default_minutes=lengths.default_minutes(),
            min_minutes=lengths.min_minutes(),
            max_minutes=lengths.max_minutes(),
        ),
    )


@router.get("/explainer/designs", response_model=CategoryDesignsResponse)
async def list_category_designs(category: str) -> CategoryDesignsResponse:
    try:
        designs, shared = designs_for(category)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"categoría desconocida: {category}") from exc
    return CategoryDesignsResponse(category_path=category, shared=shared, designs=[_design_response(d) for d in designs])


@router.get("/explainer/design-groups", response_model=list[DesignGroupResponse])
async def list_design_groups(first: str | None = None) -> list[DesignGroupResponse]:
    """Todos los diseños del kit agrupados por la categoría dueña; `first` (la categoría
    desde la que se crea) va primero. Es el selector visual de plantillas del modal."""
    groups: dict[str, list[KitDesign]] = {}
    for design in list_designs():
        groups.setdefault(design.category_path or "sin_categoria", []).append(design)
    tree = list_categories()
    order = list(tree)
    first_top = (first or "").split("/", 1)[0]
    keys = sorted(groups, key=lambda k: (k != first_top, order.index(k) if k in order else 99))
    return [
        DesignGroupResponse(
            category_path=k,
            category_name=tree[k].display_name if k in tree else "Otros",
            designs=[_design_response(d) for d in groups[k]],
        )
        for k in keys
    ]


@router.post("/explainer/briefs")
async def create_brief(body: BriefRequest) -> dict:
    """Genera los textos y el ángulo para un tema. No crea ni graba nada."""
    category = get_category(body.category_path)
    if category is None:
        raise HTTPException(status_code=404, detail=f"categoría desconocida: {body.category_path}")
    design = load_design(body.design) if body.design else None
    ai = _text_ai(body.provider)
    try:
        brief = await generate_brief(
            ai,
            category_path=body.category_path,
            topic=body.topic,
            description=body.description,
            design=design,
            media_names=body.media_names,
            minutes=body.minutes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except NexaBriefError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return brief.model_dump()


@router.post("/explainer/productions", response_model=ProductionResponse, status_code=202)
async def create_production(
    payload: str = Form(..., description="JSON con ProductionRequest"),
    files: list[UploadFile] = File(default_factory=list),
) -> ProductionResponse:
    try:
        req = ProductionRequest.model_validate(json.loads(payload))
        brief = ExplainerBrief.model_validate(req.brief) if req.brief else None
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=f"payload inválido: {exc}") from exc
    if req.agent and req.agent not in AGENTS:
        raise HTTPException(status_code=400, detail=f"agente desconocido: {req.agent}")

    producer = get_producer()
    await producer.recover_interrupted()
    with tempfile.TemporaryDirectory() as tmp:
        media_paths: list[Path] = []
        for upload in files:
            name = Path(upload.filename or "media").name.replace(" ", "-")
            dest = Path(tmp) / name
            with dest.open("wb") as fh:
                shutil.copyfileobj(upload.file, fh)
            if dest.stat().st_size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"{name} supera {MAX_UPLOAD_BYTES // 2**20} MB")
            media_paths.append(dest)
        try:
            rec = await producer.submit(
                category_path=req.category_path,
                design=req.design,
                topic=req.topic,
                description=req.description,
                agent=req.agent,
                brief=brief,
                media_files=media_paths,
                auto_record=req.auto_record,
                plan_item_id=req.plan_item_id,
                minutes=req.minutes,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if req.plan_item_id:
        from src.core.schedule.planner import link_production

        await link_production(req.plan_item_id, rec["production_id"])
    return _production_response(rec)


@router.get("/explainer/productions", response_model=list[ProductionResponse])
async def list_productions(category: str | None = None) -> list[ProductionResponse]:
    producer = get_producer()
    await producer.recover_interrupted()
    return [_production_response(r) for r in producer.list(category)]


@router.get("/explainer/productions/{production_id}", response_model=ProductionResponse)
async def get_production(production_id: str) -> ProductionResponse:
    rec = get_producer().get(production_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"producción no encontrada: {production_id}")
    return _production_response(rec, with_log=True)


@router.post("/explainer/productions/{production_id}/resume", response_model=ProductionResponse, status_code=202)
async def resume_production(production_id: str) -> ProductionResponse:
    try:
        rec = await get_producer().resume(production_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"producción no encontrada: {production_id}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _production_response(rec)


# ── Previsualizar ────────────────────────────────────────────────────────────

@router.post("/explainer/component-previews", response_model=ComponentPreviewBatchResponse)
async def post_component_previews(body: ComponentPreviewBatchRequest) -> ComponentPreviewBatchResponse:
    """Devuelve URLs del escenario aislado para uno o varios componentes del kit."""
    try:
        return ComponentPreviewBatchResponse(previews=build_component_previews(body.previews))
    except ComponentPreviewError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/explainer/files/{file_path:path}")
async def get_explainer_file(file_path: str, request: Request) -> Response:
    """Sirve el kit y los videos para el iframe de preview: solo _tools/explainer-kit/ y
    las carpetas de categoría (nodetech/, nodehistory/…), nunca archivos ocultos."""
    root = TEMPLATES_DIR.resolve()
    target = (root / file_path).resolve()
    parts = target.relative_to(root).parts if target.is_relative_to(root) else ()
    in_kit = parts[:2] == ("_tools", "explainer-kit")
    if not parts or not (in_kit or parts[0] in explainer_folders()) or any(p.startswith(".") for p in parts):
        raise HTTPException(status_code=404, detail="no encontrado")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="no encontrado")
    # Los previews cambian durante desarrollo: revalidamos, pero un ETag válido no
    # debe volver a transferir el audio o las imágenes completas.
    response = FileResponse(
        target,
        stat_result=target.stat(),
        headers={"Cache-Control": "no-cache"},
    )
    etag = response.headers.get("etag")
    if etag:
        candidates = {tag.strip() for tag in request.headers.get("if-none-match", "").split(",")}
        if "*" in candidates or etag in candidates or f"W/{etag}" in candidates:
            headers = {"Cache-Control": "no-cache", "ETag": etag}
            last_modified = response.headers.get("last-modified")
            if last_modified:
                headers["Last-Modified"] = last_modified
            return Response(status_code=304, headers=headers)
    return response
