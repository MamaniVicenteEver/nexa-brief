"""Resolve authoritative category/template names from the catalog adapter."""
from functools import lru_cache
from pathlib import Path
from src.config.settings import settings
from src.config.template_manifest import get_template_entry, get_template_display_name
from src.core.library.resource_metadata import ResourceOrigin, category_key
from src.adapters.catalog.repository import JsonCategoryRepository

@lru_cache(maxsize=4)
def _snapshot(path: str, modified_ns: int, size: int):
    return JsonCategoryRepository(Path(path)).snapshot()

class TemplateResourceContext:
    def resolve(self, category: str = "", template_id: str = "") -> ResourceOrigin | None:
        path = settings.niches_path
        stat = path.stat()
        snapshot = _snapshot(str(path), stat.st_mtime_ns, stat.st_size)
        categories = {c.id: c.name for c in snapshot.categories}
        aliases = {category_key(value): ident for ident, name in categories.items() for value in (ident, name)}
        aliases.update({category_key(folder): ident for folder, ident in snapshot.folder_categories.items()})
        selected = aliases.get(category_key(category))
        if template_id:
            entry = get_template_entry(template_id)
            if not entry:
                raise ValueError(f"Unknown template: {template_id}")
            owner = snapshot.template_categories.get(template_id)
            if owner is None:
                folder = str(entry.get("folder", "")).split("/")[0]
                owner = aliases.get(category_key(folder))
            if owner is None:
                raise ValueError(f"Template has no resource category: {template_id}")
            if selected and owner != selected:
                raise ValueError("Template and resource category do not match")
            return ResourceOrigin(category_id=owner, category_name=categories[owner],
                                  template_id=template_id, template_name=get_template_display_name(template_id, template_id))
        if selected:
            return ResourceOrigin(category_id=selected, category_name=categories[selected])
        # Pipeline callers historically pass a niche id, rather than a category.
        from src.core.categories import category_for_niche
        owner = (category_for_niche(category) or "").split("/")[0] if category else ""
        if owner in categories:
            return ResourceOrigin(category_id=owner, category_name=categories[owner])
        return None
