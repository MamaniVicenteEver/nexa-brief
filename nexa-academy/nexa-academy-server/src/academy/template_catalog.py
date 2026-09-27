"""Approved visual-template catalog for Academy agents, planning and delivery.

The physical Academy templates live under ``src/templates/<category>``. The
manifest in that directory is the delivery source of truth; the older JSON
catalog remains a compatibility source for extended visual metadata while the
templates are migrated.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from src.config.settings import BASE_DIR


LEGACY_TEMPLATE_CATALOG_PATH = BASE_DIR / "data" / "academy" / "template_catalog.json"
TEMPLATE_MANIFEST_PATH = BASE_DIR / "src" / "templates" / "templates.json"


@lru_cache(maxsize=1)
def load_template_manifest() -> dict[str, Any]:
    if not TEMPLATE_MANIFEST_PATH.exists():
        return {}
    return json.loads(TEMPLATE_MANIFEST_PATH.read_text(encoding="utf-8")).get("academy", {})


def _load_legacy_template_catalog() -> dict[str, Any]:
    if not LEGACY_TEMPLATE_CATALOG_PATH.exists():
        return {"templates": [], "render_contract": {}}
    return json.loads(LEGACY_TEMPLATE_CATALOG_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_template_catalog() -> dict[str, Any]:
    """Return the flat Academy catalog enriched with physical file paths."""
    manifest = load_template_manifest()
    legacy = _load_legacy_template_catalog()
    legacy_by_id = {template["id"]: template for template in legacy.get("templates", [])}
    templates: list[dict[str, Any]] = []

    for category in manifest.get("categories", []):
        for physical_template in category.get("templates", []):
            template_id = physical_template["id"]
            template = {
                **legacy_by_id.get(template_id, {}),
                **physical_template,
                "category_id": category["id"],
                "category_name": category["name"],
                "agent_variables": physical_template.get(
                    "variables", legacy_by_id.get(template_id, {}).get("agent_variables", [])
                ),
                "template_files": {
                    "html": physical_template["index_html"],
                    "css": physical_template["styles_css"],
                    "js": physical_template["script_js"],
                    "manifest": physical_template["manifest_json"],
                },
            }
            templates.append(template)

    if not templates:
        return legacy

    return {
        "schema_version": manifest.get("schema_version", "academy-template-manifest-v1"),
        "render_contract": manifest.get("render_contract", legacy.get("render_contract", {})),
        "templates": templates,
    }


def refresh_template_catalog_cache() -> None:
    load_template_manifest.cache_clear()
    load_template_catalog.cache_clear()


def list_templates(category_id: str | None = None) -> list[dict[str, Any]]:
    templates = load_template_catalog()["templates"]
    if category_id is None:
        return templates
    return [template for template in templates if template["category_id"] == category_id]


def get_template(template_id: str) -> dict[str, Any]:
    for template in list_templates():
        if template["id"] == template_id:
            return template
    raise KeyError(f"Unknown Academy template '{template_id}'")


def default_template_id(category_id: str) -> str:
    templates = list_templates(category_id)
    if not templates:
        raise KeyError(f"No Academy templates configured for category '{category_id}'")
    return str(templates[0]["id"])


def visual_director_context(context: dict[str, Any]) -> dict[str, Any]:
    """Give Visual Director only the approved family relevant to its task."""
    template_id = context.get("template_id")
    if isinstance(template_id, str) and template_id:
        templates = [get_template(template_id)]
    else:
        category_id = context.get("category_id")
        templates = list_templates(category_id if isinstance(category_id, str) else None)
    return {
        "render_contract": load_template_catalog()["render_contract"],
        "templates": templates,
    }
