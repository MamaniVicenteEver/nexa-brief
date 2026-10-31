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
from src.core.explainer import narrative
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
    quality_issues: list[str] = field(default_factory=list)

    @property
    def ready(self) -> bool:
        return self.status in READY_STATUSES

    @property
    def publish_ready(self) -> bool:
        return bool(self.youtube_title.strip())


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_video(video_dir: Path) -> ExplainerVideo | None:
    manifest = _read_json(video_dir / "manifest.json")
    if not manifest:
        return None
    publish = _read_json(video_dir / "publish.json")
    story = narrative.recorded(video_dir)
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
    return ExplainerVideo(
        video_id=video_dir.name,
        path=video_dir,
        design=design,
        category_path=category_path,
        title=manifest.get("title") or video_dir.name,
        status=manifest.get("status", "en progreso"),
        duration_seconds=manifest.get("duration_seconds"),
        rendered=sorted(p.name for p in (video_dir / "render").glob("*.mp4")),
        youtube_title=publish.get("youtube_title", "") or "",
        youtube_description=publish.get("youtube_description", "") or "",
        youtube_tags=list(publish.get("youtube_tags", []) or []),
        facebook_title=publish.get("facebook_title", "") or "",
        facebook_description=publish.get("facebook_description", "") or "",
        tiktok_caption=publish.get("tiktok_caption", "") or "",
        tiktok_hashtags=list(publish.get("tiktok_hashtags", []) or []),
        thumbnail_variants=thumbnail_variants,
        topic=manifest.get("topic", "") or "",
        narrative_id=story.narrative_id,
        narrative_label=story.label,
        demo=bool(manifest.get("demo")),
        quality_issues=[str(issue) for issue in manifest.get("quality_issues", []) if isinstance(issue, str)],
        has_poster=(video_dir / "render" / "poster.jpg").exists(),
    )


def video_roots() -> list[Path]:
    """Carpetas de video de las categorías explainer que existen en disco."""
    return [TEMPLATES_DIR / folder for folder in explainer_folders()]


def list_videos(root: Path | None = None) -> list[ExplainerVideo]:
    """Videos de todas las carpetas de categoría (o de una sola `root`)."""
    roots = [root] if root is not None else video_roots()
    return [
        v
        for r in roots
        if r.exists()
        for v in (load_video(d) for d in sorted(r.iterdir()) if d.is_dir())
        if v
    ]


def find_video_dir(video_id: str, root: Path | None = None) -> Path | None:
    for r in [root] if root is not None else video_roots():
        if (r / video_id).is_dir():
            return r / video_id
    return None


def get_video(video_id: str, root: Path | None = None) -> ExplainerVideo | None:
    video_dir = find_video_dir(video_id, root)
    if video_dir is None:
        return None
    return load_video(video_dir)
