"""Templates router — listado de plantillas + preview en vivo (sin grabar).

El preview corre el pipeline SOLO hasta HTML_GENERATED (antes de
video_recorder/packager) — ver `pipeline.run(..., stop_after=...)`. Fire-and-
forget, igual que /videos/upload, pero trackeado en memoria (`preview_tracker`,
NO `job_tracker`) porque un intento de preview es descartable y no debe
aparecer en Biblioteca/historial de videos reales.
"""

from __future__ import annotations

import asyncio
import json
import mimetypes
from pathlib import Path, PurePosixPath

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from starlette.responses import Response

from src.config.niche_config import NicheConfig, find_niche_by_template_id, list_all_niches
from src.config.template_manifest import (
    get_template_asset_dir,
    get_template_asset_relative_path,
    get_template_category_id,
    get_template_category_name,
    get_template_category_order,
    get_template_display_name,
    get_template_inputs,
    get_template_native_orientation,
    get_template_paths,
    get_template_preview_assets,
    get_template_sort_order,
    get_template_status,
    get_template_tags,
    list_template_categories,
    list_template_catalog,
)
from src.core import pipeline, preview_tracker
from src.core.job import JobStage, SongInfo
from src.core.orchestrator import Orchestrator
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.resource_sources import (
    resolve_image_source,
    resolve_music_source,
    resolve_video_source,
)
from src.presentation.api.preview_injection import inject_preview_scripts, version_local_assets
from src.presentation.api.preview_media import media_for_request, preview_config_json
from src.presentation.api.schemas.template_catalog_schema import (
    TemplateCatalogCategory,
    TemplateCatalogResponse,
    TemplateCatalogSummary,
)
from src.presentation.api.schemas.template_schema import (
    PREVIEW_ALLOWED_FILENAMES,
    PreviewStatusResponse,
    TemplatePreviewAcceptedResponse,
    TemplateCategoryResponse,
    TemplateRequirementsResponse,
    TemplateResponse,
)

NO_CACHE = {"Cache-Control": "no-cache"}

router = APIRouter(tags=["templates"])
logger = structlog.get_logger(__name__)

_preview_tasks: set[asyncio.Task] = set()


def _log_preview_task_exception(task: asyncio.Task) -> None:
    _preview_tasks.discard(task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error("preview_task_failed", error=str(exc))


def _build_template_response(template_id: str, niche: NicheConfig | None) -> TemplateResponse:
    manifest_entry = dict(next(
        (entry for candidate_id, entry in list_template_catalog() if candidate_id == template_id),
        {},
    ))

    # src/templates/templates.json es la única fuente de verdad para nombre,
    # descripción y orientación pública de cada template — reemplaza el
    # manifest.json por carpeta (retirado) y el display_name de niches.json,
    # que solían tener textos distintos entre sí.
    display_name = get_template_display_name(
        template_id,
        fallback=(niche.display_name if niche else template_id),
    )
    native_orientation = get_template_native_orientation(template_id)
    preview_assets = get_template_preview_assets(template_id)

    def asset_url(kind: str) -> str | None:
        path = preview_assets[kind]
        asset_dir = get_template_asset_dir(template_id)
        if path is None or asset_dir is None:
            return None
        relative_path = get_template_asset_relative_path(template_id, path)
        # ?v=<mtime>: si se regenera la portada (p. ej. cambia el nombre de la canción en la intro),
        # el navegador no sigue mostrando la vieja desde su caché.
        return f"/api/v1/templates/{template_id}/asset/{relative_path}?v={int(path.stat().st_mtime)}"

    return TemplateResponse(
        template_id=template_id,
        niche_id=niche.id if niche else "",
        category_id=get_template_category_id(template_id),
        category_name=get_template_category_name(template_id),
        category_order=get_template_category_order(template_id),
        tags=get_template_tags(template_id),
        sort_order=get_template_sort_order(template_id),
        status=get_template_status(template_id),
        can_generate=bool(niche and niche.active and niche.pipeline_type == "config_driven_template"),
        display_name=display_name,
        native_orientation=native_orientation,
        requires_image=niche.template.requires_image if niche else bool(manifest_entry.get("requires_image", False)),
        requires_video=niche.template.requires_video if niche else bool(manifest_entry.get("requires_video", False)),
        requires_lyrics=niche.template.requires_lyrics if niche else bool(manifest_entry.get("requires_lyrics", False)),
        active=niche.active if niche else get_template_status(template_id) != "disabled",
        preview_image_url=asset_url("image"),
        preview_video_url=asset_url("video"),
        preview_audio_url=asset_url("audio"),
        showcase_url=(
            f"/api/v1/templates/{template_id}/showcase/index.html"
            if get_template_paths(template_id)["index_html"] is not None
            else None
        ),
        inputs=_requirements_or_none(template_id),
    )




_MEDIA_SUFFIX_KIND = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
    ".gif": "image", ".avif": "image", ".svg": "image",
    ".mp4": "video", ".webm": "video", ".mov": "video",
    ".mp3": "music", ".wav": "music", ".m4a": "music",
    ".ogg": "music", ".opus": "music",
}


def _default_config(template_id: str) -> dict:
    config_path = get_template_paths(template_id)["config_json"]
    if config_path is None or not config_path.is_file():
        return {}
    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("template_defaults_config_unavailable", template_id=template_id)
        return {}
    if isinstance(raw, dict) and isinstance(raw.get("configs"), list):
        configs = [item for item in raw["configs"] if isinstance(item, dict)]
        active_id = raw.get("activeId")
        raw = next((item for item in configs if item.get("id") == active_id), configs[0] if configs else {})
    return raw if isinstance(raw, dict) else {}


def _dotted_value(config: dict, dotted_path: str | None) -> tuple[object, dict | None]:
    if not dotted_path:
        return None, None
    parts = dotted_path.split(".")
    current: object = config
    for part in parts[:-1]:
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return None, None
    if isinstance(current, dict):
        return current.get(parts[-1]), current
    if isinstance(current, list) and parts[-1].isdigit() and int(parts[-1]) < len(current):
        return current[int(parts[-1])], None
    return None, None


def _template_default_resource_paths(template_id: str, requirements: TemplateRequirementsResponse) -> dict | None:
    from src.templates._tools.nodemotion.shared.assemble import registered
    if not registered(template_id):
        return None
    from src.core.nodemotion.shared.bundled import demo_aliases, resolve_demo_resource
    aliases = demo_aliases(template_id)
    config = _default_config(template_id)

    def spec(value: object, expected: str, declared_kind: object = None) -> dict | None:
        if not isinstance(value, str) or not value or "\\" in value or "\x00" in value or "://" in value:
            return None
        relative = PurePosixPath(value)
        if relative.is_absolute() or any(part in {"", ".", ".."} for part in value.split("/")):
            return None
        relative_name = relative.as_posix()
        key = aliases.get(relative_name)
        source_design = template_id
        # Las variantes comparten exactamente estos medios con su diseño base;
        # no se modifica su manifiesto ni se invalidan revisiones existentes.
        shared_base = {
            "lyrics-hologram-worlds": "lyrics-hologram",
            "lyrics-grunge-montage": "lyrics-grunge",
        }.get(template_id)
        if key is None and shared_base:
            key = demo_aliases(shared_base).get(relative_name)
            if key is not None:
                source_design = shared_base
        if key is None:
            return None
        try:
            path = resolve_demo_resource(source_design, relative_name)
        except (ValueError, FileNotFoundError, OSError) as exc:
            logger.warning("template_default_resource_unavailable", template_id=template_id,
                           resource=relative_name, error=str(exc))
            return None
        if path is None:
            return None
        suffix_kind = _MEDIA_SUFFIX_KIND.get(path.suffix.lower())
        if suffix_kind not in {"image", "video", "music"}:
            return None
        if declared_kind in {"image", "video"} and suffix_kind != declared_kind:
            return None
        if expected == "music":
            if suffix_kind != "music":
                return None
        elif suffix_kind not in ({"image", "video"} if expected == "image|video" else {expected}):
            return None
        return {"relative": relative_name, "kind": suffix_kind, "key": key, "source_design": source_design}

    audio_config = config.get("audio")
    audio_spec = spec(audio_config.get("src") if isinstance(audio_config, dict) else None, "music")
    media_paths: dict[str, list[dict]] = {}
    config_media = config.get("media")
    for slot in requirements.media:
        slot_paths: list[dict] = []
        if slot.target == "media":
            if isinstance(config_media, list):
                entries = [
                    (item.get("src"), item.get("type"))
                    for item in config_media if isinstance(item, dict)
                ]
            elif isinstance(config_media, dict):
                entries = [
                    (item.get("src"), item.get("type")) if isinstance(item, dict) else (item, None)
                    for item in config_media.values()
                ]
            else:
                entries = []
            for value, declared_kind in entries:
                candidate = spec(value, slot.kind, declared_kind)
                if candidate is not None:
                    slot_paths.append(candidate)
        elif slot.target == "config":
            value, parent = _dotted_value(config, slot.path)
            declared_kind = parent.get("type") if parent else None
            values = value if isinstance(value, list) else [value]
            for entry in values:
                candidate = spec(entry, slot.kind, declared_kind)
                if candidate is not None:
                    slot_paths.append(candidate)
        if slot.max:
            slot_paths = slot_paths[:slot.max]
        if slot_paths:
            media_paths[slot.slot] = slot_paths

    # Do not change single-background templates; expose defaults only for
    # templates with more than two distinct visual resources.
    media_count = len({
        item["relative"]
        for items in media_paths.values()
        for item in items
    })
    if media_count <= 2:
        return None
    return {"audio": audio_spec, "media": media_paths}


def _defaults_from_refs(resources: dict, refs: dict[str, dict]) -> dict:
    audio = resources["audio"]
    audio_ref = refs.get(audio["relative"], {}) if audio else {}
    media = {}
    for slot, items in resources["media"].items():
        resolved = []
        for item in items:
            ref = refs.get(item["relative"], {})
            if ref.get("kind") in {"image", "video"} and ref.get("asset_id"):
                resolved.append({"asset_id": ref["asset_id"], "kind": ref["kind"]})
        if resolved:
            media[slot] = resolved
    return {"audio_asset_id": audio_ref.get("asset_id"), "media": media}


def _existing_default_refs(resources: dict, template_id: str) -> dict[str, dict]:
    from src.core.library import asset_library
    from src.core.nodemotion.shared.bundled import demo_aliases
    library_entries = {
        "music": asset_library.list_music(),
        "image": asset_library.list_images(),
        "video": asset_library.list_videos(),
    }
    by_key: dict[tuple[str, str], str] = {}
    for kind, entries in library_entries.items():
        for entry in entries:
            key = getattr(entry, "bundled_key", None)
            asset_id = getattr(entry, "asset_id", None)
            if key and asset_id:
                by_key[(kind, key)] = asset_id
    refs = {}
    for spec in [resources["audio"], *(item for items in resources["media"].values() for item in items)]:
        if spec is None:
            continue
        asset_id = by_key.get((spec["kind"], spec["key"]))
        if asset_id:
            refs[spec["relative"]] = {"kind": spec["kind"], "asset_id": asset_id}

    # Legacy demos may keep the original song as a profile upload instead of a
    # bundled library row. Resolve it by the template origin and audio alias,
    # never by a profile-local ID. This also lets sibling demos share that song.
    audio = resources["audio"]
    if audio is not None and audio["relative"] not in refs:
        candidates = set()
        for entry in library_entries["music"]:
            origin = getattr(entry, "template_id", None)
            tags = getattr(entry, "tags", [])
            if isinstance(tags, str):
                tags = [tag.strip() for tag in tags.split(",")]
            if not origin or f"demo-{origin}" not in tags:
                continue
            try:
                origin_audio = _default_config(origin).get("audio")
                source = origin_audio.get("src") if isinstance(origin_audio, dict) else None
                relative = PurePosixPath(source).as_posix() if isinstance(source, str) else None
                origin_key = demo_aliases(origin).get(relative) if relative else None
            except (KeyError, ValueError, OSError):
                continue
            if origin_key == audio["key"]:
                candidates.add(getattr(entry, "asset_id", None))
        candidates.discard(None)
        if len(candidates) == 1:
            refs[audio["relative"]] = {"kind": "music", "asset_id": candidates.pop()}
    return refs


def _with_defaults(requirements: TemplateRequirementsResponse, defaults: dict) -> TemplateRequirementsResponse:
    return TemplateRequirementsResponse.model_validate({
        **requirements.model_dump(mode="json"),
        "defaults": defaults,
    })


def _read_only_defaults(template_id: str, requirements: TemplateRequirementsResponse) -> dict:
    resources = _template_default_resource_paths(template_id, requirements)
    if resources is None:
        return requirements.defaults.model_dump(mode="json")
    try:
        return _defaults_from_refs(resources, _existing_default_refs(resources, template_id))
    except Exception as exc:
        logger.warning("template_defaults_read_failed", template_id=template_id, error=str(exc))
        return {"audio_asset_id": None, "media": {}}


async def _register_default_resources(template_id: str, requirements: TemplateRequirementsResponse) -> dict:
    resources = _template_default_resource_paths(template_id, requirements)
    if resources is None:
        return requirements.defaults.model_dump(mode="json")
    refs = _existing_default_refs(resources, template_id)
    paths_by_design: dict[str, set[str]] = {}
    for item in [resources["audio"], *(spec for items in resources["media"].values() for spec in items)]:
        if item is not None and item["relative"] not in refs:
            paths_by_design.setdefault(item.get("source_design", template_id), set()).add(item["relative"])
    if paths_by_design:
        from src.core.nodemotion.shared.bundled import ensure_design_resources
        for source_design, paths in paths_by_design.items():
            refs.update(await ensure_design_resources(source_design, paths))
    return _defaults_from_refs(resources, refs)


def _requirements_or_none(template_id: str) -> TemplateRequirementsResponse | None:
    inputs = get_template_inputs(template_id, fresh=True)
    if inputs is None:
        return None
    from src.core.library.resource_metadata import resource_metadata
    return TemplateRequirementsResponse.model_validate({**inputs, "resource_context": resource_metadata(template_id=template_id) or None})


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates() -> list[TemplateResponse]:
    niches_by_template = {
        n.template.template_id: n
        for n in list_all_niches()
        if n.pipeline_type == "config_driven_template"
    }
    return [
        _build_template_response(template_id, niches_by_template.get(template_id))
        for template_id, _ in list_template_catalog()
        if get_template_status(template_id) != "disabled"
    ]


@router.get("/templates/categories", response_model=list[TemplateCategoryResponse])
async def list_template_categories_endpoint() -> list[TemplateCategoryResponse]:
    return [TemplateCategoryResponse.model_validate(category) for category in list_template_categories()]



@router.get("/templates/catalog", response_model=TemplateCatalogResponse)
async def get_template_catalog() -> TemplateCatalogResponse:
    """Catálogo de lectura para la vista «Ver todo»: agrupa fuentes existentes por categoría."""
    from src.core.categories import list_categories as get_categories
    from src.presentation.api.routers.explainer import list_explainer_videos

    category_tree = get_categories()
    templates = await list_templates()
    demo_videos = [video for video in await list_explainer_videos() if video.demo]
    # Producción solo usa demos ya registradas desde su ubicación canónica.
    # Las pruebas y demos experimentales siguen en su propia sección Sandbox.

    def path_matches(path: str | None, category_path: str) -> bool:
        return bool(path and (path == category_path or path.startswith(f"{category_path}/")))

    def collect_niches(node) -> set[str]:
        result = set(node.niches)
        for child in node.children.values():
            result.update(collect_niches(child))
        return result

    all_category_niches = {
        category_id: collect_niches(node) for category_id, node in category_tree.items()
    }
    pipeline_category_id = next(
        (category_id for category_id, node in category_tree.items() if node.engine == "pipeline"),
        None,
    )
    sections = []

    for category_id, node in category_tree.items():
        category_templates = []
        if node.engine == "pipeline" and category_id == pipeline_category_id:
            placed: set[str] = set()
            for child in node.children.values():
                child_niches = collect_niches(child)
                group = sorted(
                    (template for template in templates if template.niche_id in child_niches),
                    key=lambda template: (template.sort_order, template.display_name.casefold()),
                )
                category_templates.extend(group)
                placed.update(template.template_id for template in group)

            claimed_elsewhere = set().union(
                *(niches for other_id, niches in all_category_niches.items() if other_id != category_id)
            ) if len(all_category_niches) > 1 else set()
            category_templates.extend(sorted(
                (
                    template for template in templates
                    if template.template_id not in placed
                    and template.niche_id not in claimed_elsewhere
                ),
                key=lambda template: (template.sort_order, template.display_name.casefold()),
            ))

        category_videos = [
            video for video in demo_videos
            if any(path_matches(path, category_id)
                   for path in [video.category_path, *video.category_paths])
        ]
        total = len(category_templates) + len(category_videos)
        sections.append(TemplateCatalogCategory(
            id=category_id,
            path=category_id,
            display_name=node.display_name,
            topic=node.topic,
            status=node.status,
            engine=node.engine,
            template_count=len(category_templates),
            demo_video_count=len(category_videos),
            sandbox_demo_count=0,
            total_item_count=total,
            templates=category_templates,
            demo_videos=category_videos,
            sandbox_demos=[],
        ))

    category_count = len(sections)
    active_count = sum(section.status == "active" for section in sections)
    planned_count = sum(section.status == "planned" for section in sections)
    empty_count = sum(section.status == "empty" for section in sections)
    with_items = sum(section.total_item_count > 0 for section in sections)
    template_count = sum(section.template_count for section in sections)
    demo_count = sum(section.demo_video_count for section in sections)

    return TemplateCatalogResponse(
        summary=TemplateCatalogSummary(
            category_count=category_count,
            active_category_count=active_count,
            planned_category_count=planned_count,
            empty_category_count=empty_count,
            categories_with_items=with_items,
            pipeline_template_count=template_count,
            demo_count=demo_count,
            total_card_count=template_count + demo_count,
        ),
        categories=sections,
    )


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str) -> TemplateResponse:
    niche = find_niche_by_template_id(template_id)
    if not any(candidate_id == template_id for candidate_id, _ in list_template_catalog()):
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return _build_template_response(template_id, niche)


@router.get("/templates/{template_id}/videos")
async def list_template_videos(template_id: str) -> list[dict]:
    from src.core import drafts, job_tracker
    from src.core.progress import get_progress
    result = []
    for draft in await drafts.list_drafts(template_id):
        if not draft.job_id:
            continue
        job = job_tracker.get(draft.job_id) or {}
        result.append({"draft_id": draft.draft_id, "job_id": draft.job_id,
                       "name": "Demo" if draft.original else draft.name,
                       "status": draft.status, "recoverable": draft.recoverable,
                       "created_at": job.get("created_at", draft.created_at),
                       "formats": list(job_tracker.format_paths(job).keys()),
                       "percent": (get_progress(draft.job_id).percent if get_progress(draft.job_id) else None)})
    return sorted(result, key=lambda item: item["created_at"], reverse=True)


@router.get("/templates/{template_id}/requirements", response_model=TemplateRequirementsResponse)
async def get_template_requirements(template_id: str) -> TemplateRequirementsResponse:
    """Devuelve requisitos y defaults ya registrados, sin escribir en la biblioteca."""
    requirements = _requirements_or_none(template_id)
    if requirements is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return _with_defaults(requirements, _read_only_defaults(template_id, requirements))


@router.post("/templates/{template_id}/requirements", response_model=TemplateRequirementsResponse)
async def prepare_template_requirements(template_id: str) -> TemplateRequirementsResponse:
    """Registra de forma idempotente los defaults bundled al iniciar un prototipo."""
    requirements = _requirements_or_none(template_id)
    if requirements is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    defaults = await _register_default_resources(template_id, requirements)
    return _with_defaults(requirements, defaults)


@router.get("/templates/{template_id}/asset/{asset_path:path}")
async def get_template_asset(template_id: str, asset_path: str, request: Request) -> Response:
    """Sirve solo los assets seleccionados como preview para esa plantilla."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    preview_assets = get_template_preview_assets(template_id)
    allowed_paths = {
        path.resolve()
        for path in preview_assets.values()
        if path is not None
    }
    root = asset_dir.resolve()
    path = (root / asset_path).resolve()
    from src.templates._tools.nodemotion.shared.assemble import registered
    shared = None
    if registered(template_id):
        from src.core.nodemotion.shared.bundled import resolve_demo_resource
        shared = resolve_demo_resource(template_id, "assets/" + asset_path)
        if shared is not None:
            path = shared
    if (shared is None and not path.is_relative_to(root)) or path not in allowed_paths or not path.exists():
        raise HTTPException(status_code=404, detail="Preview asset not available")

    path = media_for_request(path, request, always_preview=True)
    media_type = mimetypes.guess_type(asset_path if shared is not None else str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.get("/templates/{template_id}/source")
async def get_template_source(template_id: str) -> Response:
    """Serve the canonical engine document at a thin demo entry's original URL."""
    from src.templates._tools.nodemotion.shared.assemble import assemble, registered
    if not registered(template_id):
        raise HTTPException(status_code=404, detail="Shared NodeMotion design not found")
    return Response(assemble(template_id), media_type="text/html; charset=utf-8", headers=NO_CACHE)


def _catalog_design_id(template_id: str) -> str:
    """Un proyecto de datos (based_on) sin diseño propio usa el catálogo del motor compartido que declara."""
    from src.templates._tools.nodemotion.shared.assemble import registered
    root = Path(__file__).resolve().parents[3] / "templates"
    try:
        entry = json.loads((root / "templates.json").read_text(encoding="utf-8"))["templates"].get(template_id, {})
        info = json.loads((root / entry["folder"] / "info.json").read_text(encoding="utf-8"))
    except (OSError, KeyError, TypeError, ValueError):
        return template_id
    engine = info.get("engine")
    if info.get("based_on") and isinstance(engine, str) and engine and not registered(template_id) and registered(engine):
        return engine
    return template_id


@router.get("/templates/{template_id}/components")
async def get_template_components(template_id: str) -> dict:
    """Read component descriptions and parameters without reading engine source."""
    from src.templates._tools.nodemotion.shared.assemble import catalog, registered
    design_id = _catalog_design_id(template_id)
    if not registered(design_id):
        raise HTTPException(status_code=404, detail="Shared NodeMotion design not found")
    return catalog(design_id)


@router.get("/templates/{template_id}/components/{component_id}")
async def get_template_component(template_id: str, component_id: str) -> dict:
    """Read only the selected component contract."""
    from src.templates._tools.nodemotion.shared.assemble import component_contract
    try:
        return component_contract(_catalog_design_id(template_id), component_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="NodeMotion component not found") from exc


@router.get("/templates/{template_id}/showcase/{file_path:path}")
async def get_template_showcase_file(template_id: str, file_path: str, request: Request) -> Response:
    """Sirve el HTML real de la plantilla y sus assets versionados."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    template_root = asset_dir.parent.resolve()
    path = (template_root / file_path).resolve()
    from src.templates._tools.nodemotion.shared.assemble import assemble, registered, resolve_runtime_asset
    shared_design = registered(template_id)
    shared_asset = resolve_runtime_asset(template_id, file_path) if shared_design else None
    if shared_asset is not None:
        path = shared_asset

    # El pipeline copia los assets a la raíz del output, así que hay plantillas que
    # piden "song.mp3" a secas; en la carpeta de la plantilla vive en assets/.
    if not path.is_file() and "/" not in file_path:
        candidate = (asset_dir / file_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(template_root):
            path = candidate
    allowed_suffixes = {
        ".html", ".json", ".mp3", ".mp4", ".webm", ".mov", ".jpg", ".jpeg",
        ".png", ".webp", ".svg", ".js", ".css", ".woff", ".woff2", ".ttf",
    }
    if (
        (shared_asset is None and not path.is_relative_to(template_root))
        or path.suffix.lower() not in allowed_suffixes
        or not path.is_file()
    ):
        raise HTTPException(status_code=404, detail="Showcase file not available")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    if path.suffix.lower() in {".html", ".json"}:
        content = (assemble(template_id).decode("utf-8")
                   if shared_design and file_path == "index.html" else path.read_text(encoding="utf-8"))
        if path.suffix.lower() == ".html":
            content = version_local_assets(inject_preview_scripts(content, request.query_params), path.parent)
        else:
            content = preview_config_json(content, request)
    # El código de la plantilla (html/json/js) se revalida siempre: si se edita, el navegador no sigue
    # mostrando la versión vieja desde su caché. Videos e imágenes sí se cachean.
        return Response(content=content, media_type=media_type, headers=NO_CACHE)
    # Videos pedidos desde la tarjeta o el modal: copia liviana (ver preview_media).
    path = media_for_request(path, request)
    media_type = mimetypes.guess_type(file_path if shared_asset is not None else str(path))[0] or "application/octet-stream"
    response = serve_file_with_range(path, request.headers.get("range"), media_type)
    if path.suffix.lower() in {".js", ".css"}:
        response.headers.update(NO_CACHE)
    return response


@router.post("/templates/{template_id}/preview", response_model=TemplatePreviewAcceptedResponse, status_code=202)
async def create_template_preview(
    template_id: str,
    user_context: str | None = Form(default=None, max_length=500),
    promo_timeline: str | None = Form(default=None, max_length=500_000),
    song_name: str | None = Form(default=None),
    artist: str | None = Form(default=None),
    topic: str | None = Form(default=None),
    song_description: str | None = Form(default=None),
    language: str | None = Form(default=None),
    image_file: UploadFile | None = File(default=None),
    music_file: UploadFile | None = File(default=None),
    video_file: UploadFile | None = File(default=None),
    image_asset_id: str | None = Form(default=None),
    music_asset_id: str | None = Form(default=None),
    video_asset_id: str | None = Form(default=None),
) -> TemplatePreviewAcceptedResponse:
    """Corre el pipeline hasta HTML_GENERATED (sin grabar) y responde casi al
    instante con un `preview_id` — el progreso se consulta con
    GET /templates/preview/{preview_id}/status."""
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    import json
    timeline = None
    if promo_timeline is not None:
        try:
            timeline = json.loads(promo_timeline)
            if not isinstance(timeline, dict) or not isinstance(timeline.get("segments"), list):
                raise ValueError("Expected authored promo segments")
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail="Invalid promo timeline JSON") from exc
    if template_id.startswith("promo-") and timeline is None:
        raise HTTPException(status_code=422, detail="Prepare the promo script first and provide promo_timeline")

    image_source = await resolve_image_source(niche, niche.id, image_file, image_asset_id)
    music_source = await resolve_music_source(niche, niche.id, music_file, music_asset_id, song_name, artist)
    video_source = await resolve_video_source(niche.id, video_file, video_asset_id)

    song_info = None
    if any([song_name, artist, topic, song_description, language]):
        song_info = SongInfo(
            song_name=song_name, artist=artist, topic=topic,
            description=song_description, language=language,
        )

    orchestrator = Orchestrator()
    job = orchestrator.build_jobs(
        category_name=niche.id,
        quantity=1,
        user_context=user_context,
        image_source=image_source,
        music_source=music_source,
        video_source=video_source,
        song_info=song_info,
    )[0]

    if timeline is not None:
        job = job.model_copy(update={"input": job.input.model_copy(update={"promo_timeline": timeline})})
    preview_tracker.create(job)

    task = asyncio.create_task(
        pipeline.run(job, on_stage=preview_tracker.update, stop_after=JobStage.HTML_GENERATED)
    )
    _preview_tasks.add(task)
    task.add_done_callback(_log_preview_task_exception)

    return TemplatePreviewAcceptedResponse(
        preview_id=job.job_id,
        template_id=template_id,
        category_name=niche.id,
        stage=job.stage.value,
    )


@router.get("/templates/preview/{preview_id}/status", response_model=PreviewStatusResponse)
async def get_preview_status(preview_id: str) -> PreviewStatusResponse:
    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")
    return PreviewStatusResponse.from_record(record)


@router.get("/templates/preview/{preview_id}/{filename:path}")
async def get_preview_file(preview_id: str, filename: str, request: Request) -> Response:
    public_suffixes = {".html", ".json", ".js", ".css", ".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac", ".mp4", ".webm", ".mov",
                       ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".otf"}
    if "\\\\" in filename or Path(filename).suffix.lower() not in public_suffixes:
        raise HTTPException(status_code=404, detail=f"Unknown preview file '{filename}'")
    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")
    if record.get("output_dir"):
        from src.presentation.api.nodemotion_preview import serve_project_preview
        response = serve_project_preview(Path(record["output_dir"]).resolve(), filename, request)
        if response is not None:
            return response
    in_assets = filename.startswith("assets/")
    name = filename.removeprefix("assets/") if in_assets else filename
    from src.config.content_paths import is_private_content_key
    media_suffixes = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".bmp",
                      ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".opus",
                      ".mp4", ".mov", ".webm", ".mkv", ".m4v", ".js", ".css", ".woff", ".woff2", ".ttf", ".otf"}
    valid_media = in_assets and Path(name).suffix.lower() in media_suffixes
    if (is_private_content_key(filename) or "\\" in filename or
            (name not in PREVIEW_ALLOWED_FILENAMES and not valid_media) or
            (in_assets and name == "index.html")):
        raise HTTPException(status_code=404, detail=f"Unknown preview file '{filename}'")

    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")

    output_dir_str = record.get("output_dir")
    if not output_dir_str:
        raise HTTPException(status_code=404, detail="Preview output not ready yet")

    output_dir = Path(output_dir_str).resolve()
    assets_dir = Path(record.get("assets_dir") or output_dir).resolve()
    if not assets_dir.is_relative_to(output_dir):
        raise HTTPException(status_code=404, detail="Invalid preview assets")
    if in_assets and assets_dir == output_dir:
        raise HTTPException(status_code=404, detail="Unknown preview file")
    source_dir = assets_dir if in_assets else output_dir
    candidate = source_dir / name
    if candidate.is_symlink() or any(part.is_symlink() for part in candidate.parents if part != source_dir and part.is_relative_to(source_dir)):
        raise HTTPException(status_code=404, detail="Unknown preview file")
    path = candidate.resolve()
    if not path.is_relative_to(source_dir) or not path.is_file():
        raise HTTPException(status_code=404, detail=f"'{filename}' not available for this preview")

    if filename == "index.html":
        return Response(content=path.read_bytes(), media_type="text/html; charset=utf-8")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)
