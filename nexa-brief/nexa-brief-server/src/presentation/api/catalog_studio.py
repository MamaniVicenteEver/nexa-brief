"""Temporary bridge to existing studio presenters. Retire with their legacy DTOs.

This is deliberately outside the query service and only invoked by authenticated detail requests.
"""
from pathlib import Path


def studio_detail(item, templates: Path):
    if item.kind == "template":
        from src.config.niche_config import find_niche_by_template_id
        from src.presentation.api.routers.templates import _build_template_response
        return {"kind": "template", "template": _build_template_response(
            item.source_id, find_niche_by_template_id(item.source_id)).model_dump(mode="json")}
    from src.core.explainer.catalog import load_video
    from src.presentation.api.routers.explainer import _video_response
    from src.adapters.catalog.repository import repository_demos
    folder = next((path for path, _ in repository_demos(templates) if path.name == item.source_id), None)
    video = load_video(folder) if folder else None
    if video is None:
        raise FileNotFoundError(item.id)
    return {"kind": "demo", "video": _video_response(video, catalog_item=item).model_dump(mode="json")}
