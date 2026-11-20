"""Lectura interna del índice de contenido del perfil v2."""
import mimetypes
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Request

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core import content_catalog, content_registry
from src.core.data import collection
from src.core.explainer.usage_traces import read_trace
from src.templates._tools.sandbox.costs import _add, _bucket, _template_cost, _total_tokens
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/content", tags=["content"], dependencies=[Depends(require_internal)])


def _summarize_design_items(items: list[dict]) -> dict:
    """Suma registros por modelo; una traza compartida entre videos cuenta una vez."""
    totals: dict[tuple[str, str], int] = {}
    seen_events: set[str] = set()
    repeated = 0
    for item in items:
        # Las estimaciones antiguas pueden compartir sesiones entre proyectos.
        if item.get("estimated"):
            continue
        for row in item.get("totals_by_model", []):
            key = (row["provider"], row["model"])
            totals[key] = totals.get(key, 0) + row["total_tokens"]
        for event in item.get("events", []):
            ident = event.get("event_id")
            if not isinstance(ident, str):
                continue
            if ident in seen_events and event.get("usage_known"):
                key = (str(event.get("provider") or "?"), str(event.get("model") or ""))
                bucket = _bucket()
                _add(bucket, event)
                totals[key] = max(0, totals.get(key, 0) - _total_tokens(key[0], bucket))
                repeated += 1
            seen_events.add(ident)
    return {
        "total_recorded_tokens": sum(totals.values()),
        "totals_by_model": [{"provider": provider, "model": model, "total_tokens": total}
                            for (provider, model), total in sorted(totals.items())],
        "content_count": len(items),
        "without_usage_count": sum(item.get("usage_status") == "unknown" for item in items),
        "estimated_content_count": sum(bool(item.get("estimated") or item.get("unreconciled_estimate_tokens")) for item in items),
        "estimated_items": [
            {"content_key": item.get("content_key", ""),
             "total_tokens": item["total_tokens"] if item.get("estimated") else item["unreconciled_estimate_tokens"],
             "totals_by_model": item.get("totals_by_model", []) if item.get("estimated") else []}
            for item in items if item.get("estimated") or item.get("unreconciled_estimate_tokens")
        ],
        "shared_events_deduplicated": repeated,
    }


@router.get("/usage/{scope}/{folder}/{item_id}")
async def content_usage(scope: str, folder: str, item_id: str):
    """Uso registrado de un contenido, separado por ámbito y perfil activo."""
    if scope not in {"sandbox", "productions", "bundled"} or any(
        not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", value)
        for value in (folder, item_id)
    ):
        raise HTTPException(status_code=404, detail="Contenido no encontrado")
    layout = layout_for_settings(settings)
    marker = None
    if scope == 'bundled':
        from src.core.explainer.production_templates import definitions
        root = settings.templates_dir
        # Shared content must be an explicitly registered principal demo; do
        # not follow links, even when a link points back inside the repository.
        item = root / folder / item_id
        guarded = (root, root / folder, item, item / 'manifest.json', item / 'info.json',
                   item / 'usage.json', item / 'usage-report.json', item / 'work', item / 'work/usage.jsonl')
        if any(path.is_symlink() for path in guarded):
            raise HTTPException(status_code=404, detail="Contenido no encontrado")
        matches = [(design, directory) for design, directory in definitions(root) if directory == item]
        if len(matches) != 1:
            raise HTTPException(status_code=404, detail="Contenido no encontrado")
        design, _ = matches[0]
        marker = design['production_template']
        root, item = root.resolve(), item.resolve()
    else:
        root = (layout.sandbox_dir if scope == "sandbox" else layout.productions_dir).resolve()
        item = (root / folder / item_id).resolve()
    if not item.is_relative_to(root) or not item.is_dir():
        raise HTTPException(status_code=404, detail="Contenido no encontrado")
    info = {}
    try:
        info_path = item / "info.json"
        if info_path.resolve().is_relative_to(item):
            loaded = json.loads(info_path.read_text(encoding="utf-8"))
            info = loaded if isinstance(loaded, dict) else {}
    except (OSError, ValueError):
        pass
    content_key = f"{scope}/{folder}/{item_id}"
    trace_ids = {
        row.get("trace_id") for row in collection("execution_logs").list({"content_key": content_key})
        if row.get("kind") == "usage_trace" and row.get("trace_id")
    }
    # Promotion keeps the original content key as an audit alias, so prior
    # traces remain attributable without duplicating or rewriting events.
    previous_keys = info.get("usage_previous_keys", []) if scope in {"productions", "bundled"} else []
    if scope == 'bundled':
        previous_keys = list(previous_keys) if isinstance(previous_keys, list) else []
        old_folder, old_id = marker.get('origin_folder'), marker.get('project_id')
        if isinstance(old_folder, str) and isinstance(old_id, str):
            previous_keys.append(f'sandbox/{old_folder}/{old_id}')
        legacy = marker.get('legacy_production_folders')
        if isinstance(legacy, list):
            previous_keys.extend(f'productions/{key}' for key in legacy if isinstance(key, str))
    if isinstance(previous_keys, list):
        for previous in previous_keys:
            if not isinstance(previous, str) or not re.fullmatch(r"(?:sandbox|productions)/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+", previous):
                continue
            trace_ids.update(row.get("trace_id") for row in collection("execution_logs").list({"content_key": previous})
                             if row.get("kind") == "usage_trace" and row.get("trace_id"))
    design_id = None
    if scope in {"productions", "bundled"}:
        video_ids = [item_id]
        if marker and isinstance(marker.get('aliases'), list):
            video_ids += [alias for alias in marker['aliases'] if isinstance(alias, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', alias)]
        for production in [row for video_id in video_ids for row in collection("explainer_productions").list({"video_id": video_id})]:
            if production.get("folder") != folder:
                continue
            design_id = production.get("design") or design_id
            brief = production.get("brief") or {}
            if isinstance(brief, dict) and isinstance(brief.get("usage_trace_id"), str):
                trace = collection("execution_logs").first({"trace_id": brief["usage_trace_id"], "kind": "usage_trace"})
                if trace and trace.get("design_id") in (None, production.get("design")):
                    trace_ids.add(brief["usage_trace_id"])
        if not design_id:
            manifest = item / "manifest.json"
            try:
                if manifest.resolve().is_relative_to(item):
                    document = json.loads(manifest.read_text(encoding="utf-8"))
                    if isinstance(document, dict) and isinstance(document.get("design"), str):
                        design_id = document["design"]
            except (OSError, ValueError):
                pass
    events = [event for trace_id in sorted(trace_ids) for event in read_trace(trace_id)]
    return {"content_key": content_key, "design_id": design_id,
            "trace_ids": sorted(trace_ids), "unmeasured_calls": sum(not e.get("usage_known") for e in events),
            "events": events, **_template_cost(item, info, extra_events=events)}


@router.get("/usage/design/{design_id}")
async def design_usage(design_id: str):
    """Auditoría por diseño: sus proyectos y videos siguen siendo independientes."""
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", design_id):
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    layout = layout_for_settings(settings)
    productions = collection("explainer_productions").list({"design": design_id})
    keys = {(row.get("folder"), row.get("video_id")) for row in productions}
    # Los videos antiguos no siempre tienen una fila de producción; sus
    # manifiestos siguen siendo la fuente explícita de la relación con diseño.
    production_root = layout.productions_dir.resolve()
    if production_root.is_dir():
        for manifest in production_root.glob("*/*/manifest.json"):
            item = manifest.parent.resolve()
            if not item.is_relative_to(production_root) or not manifest.resolve().is_relative_to(item):
                continue
            try:
                doc = json.loads(manifest.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if isinstance(doc, dict) and doc.get("design") == design_id:
                keys.add((item.parent.name, item.name))
    videos = []
    for folder, video_id in sorted((f, v) for f, v in keys if isinstance(f, str) and isinstance(v, str)):
        try:
            videos.append(await content_usage("productions", folder, video_id))
        except HTTPException:
            continue
    from src.core.explainer.production_templates import definitions
    for design, directory in definitions(settings.templates_dir):
        if design.get('id') != design_id:
            continue
        try:
            videos.append(await content_usage('bundled', directory.parent.name, directory.name))
        except HTTPException:
            continue
    sandbox = []
    root = layout.sandbox_dir.resolve()
    if root.is_dir():
        for info_path in root.glob("*/*/info.json"):
            item = info_path.parent.resolve()
            if not item.is_relative_to(root) or not info_path.resolve().is_relative_to(item):
                continue
            try:
                info = json.loads(info_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not isinstance(info, dict):
                continue
            if item.name == design_id or info.get("based_on") in (design_id, f"{item.parent.name}/{design_id}"):
                sandbox.append(await content_usage("sandbox", item.parent.name, item.name))
    linked = {trace_id for video in videos for trace_id in video["trace_ids"]}
    pending = [row.get("trace_id") for row in collection("execution_logs").list({"design_id": design_id})
               if row.get("kind") == "usage_trace" and row.get("trace_id") not in linked
               and not row.get("content_key")]
    return {"design_id": design_id, "videos": videos, "sandbox_projects": sandbox,
            "video_totals": _summarize_design_items(videos),
            "sandbox_totals": _summarize_design_items(sandbox),
            "unlinked_brief_trace_ids": sorted(set(filter(None, pending)))}


@router.get("/usage/video/{video_id}")
async def video_usage(video_id: str):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", video_id):
        raise HTTPException(status_code=404, detail="Video no encontrado")
    root = layout_for_settings(settings).productions_dir.resolve()
    candidates = [path for path in root.glob(f"*/{video_id}")
                  if path.is_dir() and path.resolve().is_relative_to(root)] if root.is_dir() else []
    from src.core.explainer.production_templates import shared_demo
    bundled = shared_demo(settings.templates_dir, video_id)
    if len(candidates) + int(bundled is not None) != 1:
        raise HTTPException(status_code=409 if candidates or bundled else 404, detail="Video ambiguo o no encontrado")
    if bundled:
        return await content_usage('bundled', bundled.parent.name, bundled.name)
    return await content_usage("productions", candidates[0].parent.name, video_id)


@router.get("/catalog")
def catalog():
    try:
        return content_catalog.snapshot_catalog()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Registro no disponible") from exc


@router.get("/videos/{video_id}")
def video(video_id: str):
    try:
        result = content_registry.get_video(video_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Video no encontrado") from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    return result


@router.get("/resources/{asset_id}/file")
def resource_file(asset_id: str, request: Request):
    try:
        path = content_registry.resolve_resource(asset_id)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=404, detail="Recurso no encontrado") from exc
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return serve_file_with_range(path, request.headers.get("range"),
                                 mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                                 if_none_match=request.headers.get("if-none-match"),
                                 if_modified_since=request.headers.get("if-modified-since"),
                                 if_range=request.headers.get("if-range"),
                                 cache_control="private, no-cache")
