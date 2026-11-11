"""Catálogo de videos del explainer-kit: src/templates/<carpeta de categoría>/<id>/.

Cada categoría con motor explainer tiene su carpeta (niches.json → categories →
`folder`): nodetech/, nodehistory/, nodepolitics/, nodeeconomy/. El motor vive
aparte, en src/templates/_tools/explainer-kit/. Los videos de prueba de
src/templates/sandbox/<carpeta>/ NO se listan acá: son la casa de pruebas.

Solo lectura: lee manifest.json (estado y metadatos) y publish.json (títulos
para YouTube/Facebook/TikTok). Un video está "listo para grabar" cuando su
manifest dice `listo` o `renderizado`, el mismo criterio de `kit.py manifest`.
Las carpetas sin manifest (demos, pruebas) se ignoran.

Categoría: la del campo `category` del manifest si existe (la escribe la
producción desde la web: así NodePolitics puede usar un diseño de NodeHistory);
si no, la de la carpeta donde está el video; si no, la dueña del diseño.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from src.config.settings import BASE_DIR
from src.config.content_paths import production_root, preview_directory
from src.core.explainer import narrative
from src.core.explainer.render_paths import full_render_files, render_label
from src.core.categories import category_for_design, explainer_folders, get_category

TEMPLATES_DIR: Path = BASE_DIR / "src" / "templates"
KIT_DIR: Path = TEMPLATES_DIR / "_tools" / "explainer-kit"
READY_STATUSES = frozenset({"listo", "renderizado"})
UNCATEGORIZED = "sin_categoria"


@dataclass
class ThumbnailVariant:
    option: str
    label: str
    mode: str
    lines: list[str] = field(default_factory=list)
    text: str = ""
    highlight: str = ""
    image_path: str | None = None
    paired_title: str = "A"


@dataclass
class ExplainerVideo:
    video_id: str
    path: Path
    design: str
    category_path: str
    title: str
    status: str
    duration_seconds: float | None
    rendered: list[str] = field(default_factory=list)
    youtube_title: str = ""
    youtube_description: str = ""
    youtube_tags: list[str] = field(default_factory=list)
    instagram_title: str = ""
    instagram_description: str = ""
    script_text: str = ""
    script_review_required: bool = False
    facebook_title: str = ""
    facebook_description: str = ""
    tiktok_caption: str = ""
    tiktok_hashtags: list[str] = field(default_factory=list)
    thumbnail_variants: list[ThumbnailVariant] = field(default_factory=list)
    topic: str = ""
    narrative_id: str | None = None      # estrategia narrativa del guion (None = videos anteriores)
    narrative_label: str | None = None
    has_poster: bool = False
    demo: bool = False      # demo de un diseño (mismo guion que otro video): ojo al publicar
    demo_summary: str = ""
    review_requirements: list[str] = field(default_factory=list)
    estimated_tokens: int | None = None
    updated_at: str | None = None
    quality_issues: list[str] = field(default_factory=list)
    shared_categories: list[str] = field(default_factory=list)
    preview_mode: str = "desktop"
    youtube_category_id: str | None = None

    @property
    def category_paths(self) -> list[str]:
        return list(dict.fromkeys([self.category_path, *self.shared_categories]))

    @property
    def ready(self) -> bool:
        if self.script_review_required or self.status not in READY_STATUSES:
            return False
        # New standardized preparations are checked against their content;
        # historical videos remain readable until explicitly prepared.
        marker = self.path / 'work/editorial/effective-strategies.json'
        if marker.is_file():
            from src.core.explainer.editorial_preparation import EditorialPreparationService
            return EditorialPreparationService().status(self.video_id)['state'] == 'ready'
        return True

    @property
    def publish_ready(self) -> bool:
        fields = [self.youtube_title]
        if self.design == "cara-a-cara":
            fields += [self.youtube_description, self.instagram_title, self.instagram_description,
                       self.facebook_title, self.facebook_description, self.tiktok_caption]
        return all(text.strip() for text in fields)


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (ValueError, OSError):
        # Parallel agents may be replacing an incomplete draft during catalogue reads.
        return {}


def load_video(video_dir: Path) -> ExplainerVideo | None:
    manifest = _read_json(video_dir / "manifest.json")
    if not manifest:
        return None
    publish = _read_json(video_dir / "publish.json")
    story = narrative.recorded(video_dir)
    review = _read_json(video_dir / "work/script-review.json")
    script_review_required = bool(review) and review.get("status") != "approved"
    script = _read_json(video_dir / "assets/script.json") if script_review_required else {}
    script_text = "\n\n".join(str(s.get("text", "")) for s in script.get("segments", []) if isinstance(s, dict))
    thumbnail_variants = [
        ThumbnailVariant(
            option=str(item.get("option", "")),
            label=str(item.get("label", "")),
            mode=str(item.get("mode", "text")),
            lines=[str(line) for line in item.get("lines", []) if isinstance(line, str)],
            text=str(item.get("text", "")),
            highlight=str(item.get("highlight", "")),
            image_path=str(item["image_path"]) if item.get("image_path") else None,
            paired_title=str(item.get("paired_title", "A")),
        )
        for item in publish.get("thumbnail_variants", [])
        if isinstance(item, dict) and item.get("option") in {"A", "B", "C"}
    ]
    design = manifest.get("design") or "binary"
    override = manifest.get("category")
    if override and get_category(override) is not None:
        category_path = override
    else:
        category_path = (
            explainer_folders().get(video_dir.parent.name) or category_for_design(design) or UNCATEGORIZED
        )
    from src.core.explainer.design_options import resolve_design_options
    options = resolve_design_options(design, manifest)
    return ExplainerVideo(
        video_id=video_dir.name,
        path=video_dir,
        design=design,
        preview_mode=options["preview_mode"],
        youtube_category_id=options["youtube_category_id"],
        category_path=category_path,
        title=manifest.get("title") or video_dir.name,
        status=manifest.get("status", "en progreso"),
        duration_seconds=manifest.get("duration_seconds"),
        rendered=([] if manifest.get("render_revision_stale") else
                  sorted({render_label(video_dir, p) for p in full_render_files(video_dir)})),
        youtube_title=publish.get("youtube_title", "") or "",
        youtube_description=publish.get("youtube_description", "") or "",
        youtube_tags=list(publish.get("youtube_tags", []) or []),
        instagram_title=publish.get("instagram_title", "") or "",
        instagram_description=publish.get("instagram_description", "") or "",
        script_text=script_text,
        script_review_required=script_review_required,
        facebook_title=publish.get("facebook_title", "") or "",
        facebook_description=publish.get("facebook_description", "") or "",
        tiktok_caption=publish.get("tiktok_caption", "") or "",
        tiktok_hashtags=list(publish.get("tiktok_hashtags", []) or []),
        thumbnail_variants=thumbnail_variants,
        topic=manifest.get("topic", "") or "",
        narrative_id=story.narrative_id,
        narrative_label=story.label,
        demo=bool(manifest.get("demo")),
        demo_summary=str(manifest.get("demo_summary") or ""),
        review_requirements=[str(item) for item in manifest.get("review_requirements", []) if isinstance(item, str)],
        estimated_tokens=(manifest.get("estimated_tokens") if isinstance(manifest.get("estimated_tokens"), int) and manifest.get("estimated_tokens") >= 0 else None),
        updated_at=str(manifest.get("updated_at")) if manifest.get("updated_at") else None,
        shared_categories=[c for c in manifest.get("shared_categories", [])
                           if isinstance(c, str) and get_category(c) is not None],
        quality_issues=[str(issue) for issue in manifest.get("quality_issues", []) if isinstance(issue, str)],
        has_poster=(preview_directory(video_dir) / "poster.jpg").exists(),
    )


def video_roots() -> list[Path]:
    """Carpetas de video de las categorías explainer que existen en disco."""
    roots = [production_root() / folder for folder in explainer_folders()]
    return roots


def list_videos(root: Path | None = None) -> list[ExplainerVideo]:
    """Videos de todas las carpetas de categoría (o de una sola `root`)."""
    roots = [root] if root is not None else video_roots()
    videos = [
        v
        for r in roots
        if r.exists()
        for v in (load_video(d) for d in sorted(r.iterdir()) if d.is_dir())
        if v
    ]
    if root is None:
        from src.core.explainer.production_templates import definitions
        videos += [video for _, directory in definitions(TEMPLATES_DIR) if (video := load_video(directory))]
    # Only explicitly registered principal demos join the active catalogue.
    unique = {}
    for video in videos:
        unique.setdefault(video.video_id, video)
    return list(unique.values())


def find_video_dir(video_id: str, root: Path | None = None) -> Path | None:
    if not video_id or Path(video_id).name != video_id or video_id in {".", ".."}:
        return None
    for r in [root] if root is not None else video_roots():
        if (r / video_id).is_dir():
            return r / video_id
    if root is None:
        from src.core.explainer.production_templates import shared_demo
        return shared_demo(TEMPLATES_DIR, video_id)
    return None


def get_video(video_id: str, root: Path | None = None) -> ExplainerVideo | None:
    video_dir = find_video_dir(video_id, root)
    if video_dir is None:
        return None
    return load_video(video_dir)
