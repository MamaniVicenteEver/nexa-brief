from __future__ import annotations

import json
from pathlib import Path

from src.core.catalog.models import CatalogCategory, CatalogItem, CategorySnapshot, Playback
from src.core.catalog.ports import CatalogMedia, CategoryRepository


def read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def repository_demos(root: Path):
    """Explicit demo=true only, in repository category/id; never profile folders."""
    for manifest in sorted(root.glob("*/*/manifest.json")):
        parts = manifest.relative_to(root).parts
        if parts[0].startswith(("_", ".")) or parts[0] == "sandbox":
            continue
        if any(p.is_symlink() for p in (manifest.parent.parent, manifest.parent, manifest)):
            continue
        data = read_json(manifest)
        if data.get("demo") is True:
            yield manifest.parent, data


class JsonCategoryRepository:
    def __init__(self, path: Path):
        self.path = path

    def tree(self):
        from src.core.categories import CategoryNode, validate_tree
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        tree = {key: CategoryNode.model_validate(node) for key, node in raw.get("categories", {}).items()}
        validate_tree(tree, set(raw.get("niches", {})))
        return tree

    def list_categories(self):
        return [CatalogCategory(id=key, name=node.display_name, status=node.status)
                for key, node in self.tree().items()]

    def snapshot(self):
        tree = self.tree()
        niches = read_json(self.path).get("niches", {})
        template_categories, shared = {}, {}
        def collect(node, top):
            for niche in node.niches:
                ident = (niches.get(niche, {}).get("template") or {}).get("template_id")
                if ident:
                    template_categories[ident] = top
            for ident in node.shared_designs:
                shared.setdefault(ident, []).append(top)
            for child in node.children.values():
                collect(child, top)
        for key, node in tree.items():
            collect(node, key)
        return CategorySnapshot(
            categories=[CatalogCategory(id=k, name=n.display_name, status=n.status) for k, n in tree.items()],
            folder_categories={n.folder: k for k, n in tree.items() if n.folder},
            template_categories=template_categories, shared_design_categories=shared)


class FilesystemCatalogRepository:
    def __init__(self, templates: Path, categories: CategoryRepository, media: CatalogMedia):
        self.templates = templates
        self.categories = categories
        self.media = media

    def _url(self, path: Path | None):
        if path is None or not path.is_file() or path.is_symlink():
            return None
        if not path.resolve().is_relative_to(self.templates.resolve()):
            return None
        return self.media.url(path.relative_to(self.templates).as_posix())

    def list_items(self):
        snapshot = self.categories.snapshot()
        known = {c.id for c in snapshot.categories}
        items = []
        catalog = read_json(self.templates / "templates.json")
        folder_categories = snapshot.folder_categories

        def category_for_template(ident, entry):
            return snapshot.template_categories.get(ident) or folder_categories.get(str(entry.get("folder", "")).split("/")[0])

        for ident, entry in catalog.get("templates", {}).items():
            if entry.get("status") == "disabled" or entry.get("category_id") == "testing" or entry.get("demo") is False:
                continue
            folder = self.templates / entry.get("folder", "")
            if not folder.resolve().is_relative_to(self.templates.resolve()) or folder.is_symlink():
                continue
            index = self.templates / entry.get("index_html", "")
            if not index.is_file():
                continue
            category = category_for_template(ident, entry)
            if not category:
                continue
            assets = folder / "assets"
            poster = next((assets / name for name in ("card-poster.webp", "poster.jpg", "bg.png", "bg.jpg", "cover.jpg")
                           if (assets / name).is_file()), None)
            # Background clips are not complete demo movies. Only explicit demo_video fields qualify.
            video = self._url(folder / entry["demo_video"]) if entry.get("demo_video") else None
            portrait = self._url(folder / entry["demo_video_portrait"]) if entry.get("demo_video_portrait") else None
            items.append(CatalogItem(id=f"template:{ident}", source_id=ident, kind="template",
                title=entry.get("display_name") or ident, category_ids=[category],
                poster_url=self._url(poster), orientation=entry.get("native_orientation", "any"),
                playback=Playback(engine="template", engine_url=f"/api/v1/templates/{ident}/showcase/index.html",
                                  desktop_video_url=video, mobile_video_url=portrait)))

        for folder, manifest in repository_demos(self.templates):
            design = manifest.get("design", "")
            category = manifest.get("category") or folder_categories.get(folder.parent.name)
            if category not in known:
                continue
            shared = [*snapshot.shared_design_categories.get(design, []), *manifest.get("shared_categories", [])]
            category_ids = list(dict.fromkeys([category, *(key for key in shared if key in known)]))
            poster = next((folder / key for key in ("assets/thumbnails/poster.jpg", "render/poster.jpg", "assets/card-poster.webp")
                           if (folder / key).is_file()), None)
            def movie(orientation):
                explicit = manifest.get("demo_video_portrait" if orientation == "9x16" else "demo_video")
                candidates = [folder / explicit] if isinstance(explicit, str) and explicit else []
                candidates += [folder / "render" / f"{folder.name}-{orientation}.mp4"]
                return next((self._url(path) for path in candidates if path.is_file()), None)
            items.append(CatalogItem(id=f"demo:{folder.name}", source_id=folder.name, kind="demo",
                title=manifest.get("title") or folder.name, category_ids=category_ids,
                poster_url=self._url(poster), orientation=manifest.get("native_orientation", "any"), design_id=design,
                playback=Playback(engine_url=self._url(folder / "index.html"),
                                  desktop_video_url=movie("16x9"), mobile_video_url=movie("9x16"))))
        return items
