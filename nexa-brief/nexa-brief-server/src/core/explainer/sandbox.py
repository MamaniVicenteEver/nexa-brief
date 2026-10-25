"""Catálogo de solo lectura para los videos de prueba del sandbox."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from src.core.categories import explainer_folders, list_categories
from src.core.explainer.catalog import TEMPLATES_DIR, _read_json
from src.core.explainer import promote as promotion
from src.core.explainer import sandbox_info

SANDBOX_DIR = TEMPLATES_DIR / "sandbox"
BUSY_MESSAGE = "Hay una producción o grabación en curso para este video"
REFERENCE_CATEGORIES = (
    "nodetech",
    "nodehistory",
    "nodepolitics",
    "nodeeconomy",
    "nodeaction",
    "nodemotion",
    "otros",
)
IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"}

PROMOTE_BLOCKER_BY_KIND: dict[str, str | None] = {
    "explainer_kit": "Disponible en la fase 2",
    "nodeaction": "Usa un motor que todavía vive en el sandbox",
    "mapas": "Usa un motor que todavía vive en el sandbox",
    "pizarra": "Usa un motor que todavía vive en el sandbox",
    "proto": "Usa un motor que todavía vive en el sandbox",
    "hyperframes": "Se da de alta en templates.json, no se mueve",
    "reference": "Material de referencia",
    "other": None,
}


@dataclass
class SandboxItem:
    id: str
    folder: str
    path: str
    kind: str
    title: str
    status: str | None
    design: str | None
    has_index: bool
    has_poster: bool
    has_info: bool
    total_tokens: int | None
    thumbnail_url: str | None
    player: str
    videos: list[str] = field(default_factory=list)
    notes_file: str | None = None
    updated_at: str | None = None
    promotable: bool = False
    promote_blocker: str | None = None
    subcategory: str | None = None


@dataclass
class SandboxFolder:
    folder: str
    label: str
    category_id: str | None
    items: list[SandboxItem] = field(default_factory=list)
    role: str = "projects"


def detect_kind(item_dir: Path) -> str:
    """Detecta el motor usado por un elemento del sandbox."""
    if (item_dir / "manifest.json").is_file():
        return "explainer_kit"

    index = item_dir / "index.html"
    html = index.read_text(encoding="utf-8", errors="replace") if index.is_file() else ""
    if "explainer-kit/engine/loader.js" in html:
        return "explainer_kit"
    if "../_mapas/" in html:
        return "mapas"
    if "../_pizarra/" in html:
        return "pizarra"
    if "../_engine/" in html:
        return "nodeaction"
    if "_proto/proto.js" in html:
        return "proto"
    if any(path.is_file() for path in item_dir.rglob("lyrics.json")):
        return "hyperframes"
    if (item_dir / "NOTAS.md").is_file() and not index.is_file():
        return "hyperframes"
    if not index.is_file() and (any(item_dir.glob("*.mp4")) or _image_paths(item_dir)):
        return "reference"
    return "other"


def _visible_directories(parent: Path) -> list[Path]:
    """Devuelve subcarpetas visibles, sin seguir enlaces fuera del sandbox."""
    if not parent.is_dir():
        return []
    root = parent.resolve()
    return sorted(
        (
            child
            for child in parent.iterdir()
            if child.is_dir()
            and not child.name.startswith(("_", "."))
            and child.resolve().is_relative_to(root)
        ),
        key=lambda child: child.name.casefold(),
    )


def _video_paths(item_dir: Path) -> list[str]:
    """Lista los renders del elemento o sus mp4 sueltos."""
    render_dir = item_dir / "render"
    rendered = sorted(
        path for path in render_dir.glob("*.mp4") if path.is_file() and not path.name.startswith(".")
    ) if render_dir.is_dir() else []
    videos = rendered or sorted(
        path for path in item_dir.glob("*.mp4") if path.is_file() and not path.name.startswith(".")
    )
    return [path.relative_to(item_dir).as_posix() for path in videos]


def _image_paths(item_dir: Path) -> list[Path]:
    """Devuelve imágenes de portada guardadas directamente en la carpeta de la idea."""
    return sorted(
        (
            path
            for path in item_dir.iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS and not path.name.startswith(".")
        ),
        key=lambda path: path.name.casefold(),
    ) if item_dir.is_dir() else []


def _updated_at(item_dir: Path) -> str | None:
    """Fecha ISO (UTC) más reciente entre index, manifest y archivos de render."""
    candidates = [item_dir / "index.html", item_dir / "manifest.json"]
    render_dir = item_dir / "render"
    if render_dir.is_dir():
        candidates.extend(path for path in render_dir.iterdir() if path.is_file())
    timestamps = [path.stat().st_mtime for path in candidates if path.is_file()]
    if not timestamps:
        return None
    return datetime.fromtimestamp(max(timestamps), tz=timezone.utc).isoformat().replace("+00:00", "Z")


def load_item(
    item_dir: Path,
    *,
    busy_ids: set[str] = frozenset(),
    folder: str | None = None,
    subcategory: str | None = None,
) -> SandboxItem | None:
    """Carga una ficha si contiene HTML o algún video mp4."""
    if not item_dir.is_dir() or item_dir.name.startswith(("_", ".")):
        return None
    videos = _video_paths(item_dir)
    images = _image_paths(item_dir)
    index = item_dir / "index.html"
    item_folder = folder or item_dir.parent.name
    is_reference = item_folder == "referencias" and item_dir.parent.name in REFERENCE_CATEGORIES
    if not index.is_file() and not videos and not images and not (is_reference and (item_dir / "NOTAS.md").is_file()):
        return None

    manifest = _read_json(item_dir / "manifest.json")
    kind = "reference" if is_reference else detect_kind(item_dir)
    reference_info = _read_json(item_dir / "info.json") if kind == "reference" else {}
    has_poster = (item_dir / "render" / "poster.jpg").is_file()
    if kind == "reference":
        has_info = (item_dir / "info.json").is_file()
        total_tokens = None
    else:
        has_info, total_tokens = sandbox_info.get_item_costs(item_dir.parents[1], item_dir)
    encoded_folder = quote(item_folder, safe="")
    encoded_id = quote(item_dir.name, safe="")
    encoded_subcategory = quote(subcategory, safe="") if subcategory else None
    relative_item_path = "/".join(
        part for part in ("sandbox", item_folder, subcategory, item_dir.name) if part
    )
    encoded_item_path = "/".join(quote(part, safe="") for part in relative_item_path.split("/"))
    if has_poster:
        thumbnail_url = f"/api/v1/explainer/files/{encoded_item_path}/render/poster.jpg"
    elif kind == "reference" and images:
        image_path = quote(images[0].name, safe="")
        thumbnail_url = f"/api/v1/explainer/files/{encoded_item_path}/{image_path}"
    elif kind == "reference" and videos and subcategory:
        thumbnail_url = (
            f"/api/v1/explainer/sandbox/{encoded_folder}/{encoded_subcategory}/{encoded_id}/thumbnail.jpg"
        )
    elif index.is_file():
        thumbnail_url = f"/api/v1/explainer/sandbox/{encoded_folder}/{encoded_id}/thumbnail.jpg"
    else:
        thumbnail_url = None
    player = "protocol" if index.is_file() else "video" if videos else "none"
    notes_file = next(
        (name for name in ("PLAN.md", "NOTAS.md") if (item_dir / name).is_file()),
        None,
    )
    promote_blocker = PROMOTE_BLOCKER_BY_KIND[kind]
    promotable = False
    if kind == "explainer_kit":
        promote_blocker = promotion.promotion_blocker(item_dir, templates_dir=item_dir.parents[2])
        promotable = promote_blocker is None
        if item_dir.name in busy_ids:
            promote_blocker = BUSY_MESSAGE
            promotable = False

    return SandboxItem(
        id=item_dir.name,
        folder=item_folder,
        path=relative_item_path,
        kind=kind,
        title=str(
            manifest.get("title")
            or reference_info.get("title")
            or (item_dir.name.replace("-", " ").title() if kind == "reference" else item_dir.name)
        ),
        status=manifest.get("status"),
        design=manifest.get("design"),
        has_index=index.is_file(),
        has_poster=has_poster,
        has_info=has_info,
        total_tokens=total_tokens,
        thumbnail_url=thumbnail_url,
        player=player,
        videos=videos,
        notes_file=notes_file,
        updated_at=_updated_at(item_dir),
        promotable=promotable,
        promote_blocker=promote_blocker,
        subcategory=subcategory,
    )


def _folder_details(folder: str) -> tuple[str, str | None]:
    """Nombre visible y categoría dueña de la carpeta: primero por `folder` de niches.json,
    después por nombre (nodemotion → NodeMotion, que no guarda videos en src/templates/)."""
    categories = list_categories()
    category_id = explainer_folders().get(folder) or next(
        (cat_id for cat_id, node in categories.items() if node.display_name.casefold() == folder.casefold()),
        None,
    )
    if folder == "referencias":
        return "Referencias", None
    if category_id:
        return categories[category_id].display_name, category_id
    if folder.startswith("node"):
        return "Node" + folder[4:].title(), None   # nodeaction → NodeAction
    return folder.replace("_", " ").title(), None


def list_sandbox(root: Path | None = None, busy_ids: set[str] = frozenset()) -> list[SandboxFolder]:
    """Lista las carpetas del sandbox y ordena sus elementos por fecha."""
    sandbox_root = root or SANDBOX_DIR
    folder_categories = explainer_folders()
    category_order = {category_id: index for index, category_id in enumerate(folder_categories.values())}
    folders = _visible_directories(sandbox_root)

    def folder_order(path: Path) -> tuple[int, int | str]:
        if path.name in {"referencias", "nuevos"}:
            return 2, path.name.casefold()
        category_id = folder_categories.get(path.name)
        if category_id in category_order:
            return 0, category_order[category_id]
        return 1, path.name.casefold()

    result: list[SandboxFolder] = []
    for folder_dir in sorted(folders, key=folder_order):
        label, category_id = _folder_details(folder_dir.name)
        if folder_dir.name == "referencias":
            nested_items = (
                load_item(
                    item_dir,
                    busy_ids=busy_ids,
                    folder="referencias",
                    subcategory=category_dir.name,
                )
                for category_dir in _visible_directories(folder_dir)
                if category_dir.name in REFERENCE_CATEGORIES
                for item_dir in _visible_directories(category_dir)
            )
        else:
            nested_items = (
                load_item(item_dir, busy_ids=busy_ids)
                for item_dir in _visible_directories(folder_dir)
            )
        items = [item for item in nested_items if item is not None]
        items.sort(key=lambda item: item.id.casefold())
        items.sort(key=lambda item: item.updated_at or "", reverse=True)  # ISO UTC: orden lexicográfico = cronológico
        role = "references" if folder_dir.name in {"referencias", "nuevos"} else "projects"
        result.append(
            SandboxFolder(
                folder=folder_dir.name,
                label=label,
                category_id=category_id,
                items=items,
                role=role,
            )
        )
    return result
