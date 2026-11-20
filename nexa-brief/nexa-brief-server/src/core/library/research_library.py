"""Investigaciones de los videos, registradas una sola vez en la librería.

Cada carpeta `work/research` de producciones y de sandbox —y los research.json sueltos de un
video— se registra en la colección `research_assets` según el hash de su contenido. El registro
guarda tema, fecha, hallazgos, fuentes e imágenes, y el origen (video y carpeta) para enlazar de
vuelta. Los archivos se copian a resources/research/<id>/ para que no se pierdan si se borra la
carpeta de la promo. Leer las carpetas no las modifica.

Sincronizar es idempotente: lo nuevo se registra; lo ya registrado se actualiza en lo derivado
(tema, fecha, contadores, archivos) y conserva sus usos, sus orígenes y las licencias escritas.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import shutil
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from src.core.data import collection

COLLECTION = "research_assets"
MAIN_FILES = ("research.json", "research.md")
IMAGE_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"})
DERIVED_FIELDS = ("topic", "researched_at", "group", "revision", "main", "counts", "files", "tags")
_REVISION = re.compile(r"^(?P<base>.+)-(?P<rev>r\d+)$")
_RESEARCH_ID = re.compile(r"^[0-9a-f]{16}$")
MAX_SUMMARY_CHARS = 200_000

# Una sola sincronización a la vez: dos llamadas simultáneas no deben registrar lo mismo dos veces.
_sync_lock = asyncio.Lock()


@dataclass(frozen=True)
class ResearchFolder:
    root: str  # "production" | "sandbox"
    category: str
    video_id: str
    folder: Path  # carpeta que se lee
    files: tuple[Path, ...]  # archivos que forman la investigación


@dataclass
class SyncReport:
    folders: int = 0
    created: int = 0
    merged: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def revision_of(video_id: str) -> tuple[str, str]:
    """`tema-r2` → ("tema", "r2"). Las carpetas sin sufijo son la versión base."""
    match = _REVISION.match(video_id)
    return (match.group("base"), match.group("rev")) if match else (video_id, "")


def _visible_dirs(path: Path) -> list[Path]:
    return [child for child in path.iterdir() if child.is_dir() and not child.name.startswith(".")]


def discover(roots: Iterable[tuple[str, Path]]) -> list[ResearchFolder]:
    """Carpetas con investigación: `<video>/work/research/` y research.json/md sueltos del video."""
    found: list[ResearchFolder] = []
    for root_name, base in roots:
        if not base.is_dir():
            continue
        for category_dir in sorted(_visible_dirs(base)):
            for video_dir in sorted(_visible_dirs(category_dir)):
                research_dir = video_dir / "work" / "research"
                if research_dir.is_dir():
                    files = tuple(sorted(path for path in research_dir.rglob("*") if path.is_file()))
                    if files:
                        found.append(ResearchFolder(root_name, category_dir.name, video_dir.name, research_dir, files))
                loose = tuple(video_dir / name for name in MAIN_FILES if (video_dir / name).is_file())
                if loose:
                    found.append(ResearchFolder(root_name, category_dir.name, video_dir.name, video_dir, loose))
    return found


def _main_file(folder: ResearchFolder) -> Path | None:
    """El archivo que representa la investigación: research.json, research.md o el HECHOS.md."""
    for name in MAIN_FILES:
        if (folder.folder / name).is_file():
            return folder.folder / name
    markdown = sorted(path for path in folder.files if path.suffix.lower() == ".md")
    hechos = [path for path in markdown if path.name.upper() == "HECHOS.MD"]
    return (hechos or markdown or [None])[0]


def _structured(main: Path, raw: bytes) -> dict[str, Any] | None:
    if main.suffix.lower() != ".json":
        return None
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def _first_sentence(text: str, limit: int = 160) -> str:
    sentence = re.split(r"(?<=[.!?])\s", " ".join(text.split()), maxsplit=1)[0]
    return sentence[:limit].strip()


def _topic(main: Path, data: dict[str, Any] | None, fallback: str) -> str:
    """Tema: `topic` del promo; `scope` de los research.json de producción; o el título del .md."""
    topic = " ".join(str((data or {}).get("topic") or "").split())
    if topic:
        return topic
    scope = str((data or {}).get("scope") or "")
    if scope.strip():
        return _first_sentence(scope)
    for line in main.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("# ") and line[2:].strip():
            return line[2:].strip()
    return fallback


def _researched_at(main: Path, data: dict[str, Any] | None) -> str:
    value = str((data or {}).get("researched_at") or (data or {}).get("consulted_on") or "").strip()
    if value:
        return value[:10]
    return datetime.fromtimestamp(main.stat().st_mtime, tz=timezone.utc).date().isoformat()


def _source_urls(data: dict[str, Any] | None) -> set[str]:
    """URLs de las fuentes: las de cada hallazgo y las de la lista general del research.json."""
    urls: set[str] = set()
    for source in (data or {}).get("sources") or []:
        if isinstance(source, dict) and source.get("url"):
            urls.add(str(source["url"]))
    for item in (data or {}).get("findings") or []:
        if not isinstance(item, dict):
            continue
        for source in item.get("sources") or []:
            if isinstance(source, dict) and source.get("url"):
                urls.add(str(source["url"]))
    return urls


def _counts(data: dict[str, Any] | None, images: int, files: int) -> dict[str, int]:
    findings = [item for item in (data or {}).get("findings") or [] if isinstance(item, dict)]
    discarded = [item for item in (data or {}).get("discarded") or [] if isinstance(item, dict)]
    return {
        "findings": len(findings),
        "sources": len(_source_urls(data)),
        "discarded": len(discarded),
        "images": images,
        "files": files,
    }


def _relative(path: Path, base: Path) -> str:
    try:
        return path.relative_to(base).as_posix()
    except ValueError:
        return path.name


def build_record(folder: ResearchFolder, profile_root: Path) -> dict[str, Any] | None:
    """Registro de una carpeta. None si no tiene nada que leer (p. ej. solo input.json)."""
    main = _main_file(folder)
    if main is None:
        return None
    raw = main.read_bytes()
    data = _structured(main, raw)
    names = [path.relative_to(folder.folder).as_posix() for path in folder.files]
    images = [name for name, path in zip(names, folder.files) if path.suffix.lower() in IMAGE_SUFFIXES]
    base_id, revision = revision_of(folder.video_id)
    return {
        "research_id": hashlib.sha256(raw).hexdigest()[:16],
        "topic": _topic(main, data, folder.video_id),
        "researched_at": _researched_at(main, data),
        "group": base_id,
        "revision": revision,
        "main": main.relative_to(folder.folder).as_posix(),
        "origins": [
            {
                "root": folder.root,
                "category": folder.category,
                "video_id": folder.video_id,
                "path": _relative(folder.folder, profile_root),
            }
        ],
        "counts": _counts(data, len(images), len(names)),
        "images": [{"path": name, "source_url": "", "license": "", "credit": ""} for name in images],
        "files": [{"path": name, "bytes": path.stat().st_size} for name, path in zip(names, folder.files)],
        "tags": sorted({folder.root, folder.category}),
        "used_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _copy_files(folder: ResearchFolder, research_id: str, resources_dir: Path) -> None:
    target_root = resources_dir / "research" / research_id
    for source in folder.files:
        target = target_root / source.relative_to(folder.folder)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.is_file() or target.stat().st_size != source.stat().st_size:
            shutil.copy2(source, target)


def _merged_images(existing: list[dict[str, Any]], fresh: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Imágenes nuevas, conservando la licencia y el autor que ya se hayan escrito."""
    known = {image.get("path"): image for image in existing}
    return [{**image, **{k: v for k, v in known.get(image["path"], {}).items() if v}} for image in fresh]


async def sync(
    *,
    roots: Iterable[tuple[str, Path]],
    profile_root: Path,
    resources_dir: Path,
    store: Any | None = None,
) -> SyncReport:
    """Registra lo nuevo y actualiza lo derivado de lo ya registrado. Idempotente."""
    async with _sync_lock:
        records = store if store is not None else collection(COLLECTION)
        report = SyncReport()
        folders = discover(roots)
        report.folders = len(folders)
        for folder in folders:
            try:
                record = build_record(folder, profile_root)
                if record is None:
                    report.skipped += 1
                    continue
                origin = record["origins"][0]
                existing = records.get(record["research_id"])
                if existing is not None:
                    known = {(item["root"], item["video_id"]) for item in existing.get("origins") or []}
                    patch: dict[str, Any] = {key: record[key] for key in DERIVED_FIELDS}
                    patch["images"] = _merged_images(existing.get("images") or [], record["images"])
                    if (origin["root"], origin["video_id"]) not in known:
                        patch["origins"] = [*(existing.get("origins") or []), origin]
                    _copy_files(folder, record["research_id"], resources_dir)
                    await records.update(record["research_id"], patch)
                    report.merged += 1
                    continue
                _copy_files(folder, record["research_id"], resources_dir)
                await records.insert(record)
                report.created += 1
            except OSError as exc:
                report.errors.append(f"{folder.video_id}: {exc.__class__.__name__}")
        return report


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.findall(r"[a-z0-9]+", folded))


def _all_records() -> list[dict[str, Any]]:
    return [dict(row) for row in collection(COLLECTION).list()]


def _version_rank(record: dict[str, Any]) -> tuple[str, int]:
    revision = str(record.get("revision") or "")
    return (str(record.get("researched_at") or ""), int(revision[1:]) if revision[1:].isdigit() else 0)


def groups(records: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Versiones de un mismo tema, la más nueva primero."""
    grouped: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        grouped.setdefault(str(record.get("group") or record["research_id"]), []).append(record)
    for versions in grouped.values():
        versions.sort(key=_version_rank, reverse=True)
    return grouped


def _card(latest: dict[str, Any], version_count: int) -> dict[str, Any]:
    origin = latest["origins"][0]
    cover = next((image["path"] for image in latest.get("images") or []), None)
    return {
        "research_id": latest["research_id"],
        "topic": latest["topic"],
        "researched_at": latest["researched_at"],
        "origin_root": origin["root"],
        "origin_category": origin["category"],
        "origin_video_id": origin["video_id"],
        "origin_path": origin["path"],
        "revision": latest.get("revision", ""),
        "version_count": version_count,
        "tags": latest.get("tags") or [],
        "counts": latest.get("counts") or {},
        "videos": len(latest.get("used_by") or []),
        "cover_path": cover,
    }


def list_cards(*, q: str = "", category: str = "", page: int = 1, page_size: int = 12) -> tuple[list[dict[str, Any]], int]:
    needle = _fold(q).split()
    cards: list[dict[str, Any]] = []
    for versions in groups(_all_records()).values():
        latest = versions[0]
        origin = latest["origins"][0]
        if category and origin["category"] != category:
            continue
        haystack = _fold(" ".join([latest["topic"], *(latest.get("tags") or []), origin["category"], origin["video_id"]]))
        if not all(token in haystack for token in needle):
            continue
        cards.append(_card(latest, len(versions)))
    cards.sort(key=lambda card: card["researched_at"], reverse=True)
    start = (page - 1) * page_size
    return cards[start : start + page_size], len(cards)


def categories() -> list[str]:
    return sorted({record["origins"][0]["category"] for record in _all_records() if record.get("origins")})


def _read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")[:MAX_SUMMARY_CHARS]


def _findings(data: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Hallazgos con sus fuentes. Las fuentes que son solo un id se buscan en la lista general."""
    listed = {
        str(source.get("id")): source
        for source in (data or {}).get("sources") or []
        if isinstance(source, dict) and source.get("id")
    }
    rows: list[dict[str, Any]] = []
    for item in (data or {}).get("findings") or []:
        if not isinstance(item, dict):
            continue
        sources: list[dict[str, str]] = []
        for source in item.get("sources") or []:
            if isinstance(source, str):
                source = listed.get(source, {"title": source})
            if not isinstance(source, dict):
                continue
            sources.append(
                {
                    "title": str(source.get("title") or source.get("publisher") or ""),
                    "url": str(source.get("url") or ""),
                    "data_date": str(source.get("data_date") or source.get("consulted_on") or ""),
                    "accessed_at": str(source.get("accessed_at") or source.get("consulted_on") or ""),
                }
            )
        rows.append(
            {
                "id": str(item.get("id") or ""),
                "claim": str(item.get("claim") or ""),
                "strength": item.get("strength") if isinstance(item.get("strength"), int) else None,
                "recency": str(item.get("recency") or ""),
                "sources": sources,
            }
        )
    return rows


def _discarded(data: dict[str, Any] | None) -> list[dict[str, str]]:
    return [
        {"claim": str(item.get("claim") or ""), "reason": str(item.get("reason") or "")}
        for item in (data or {}).get("discarded") or []
        if isinstance(item, dict)
    ]


def _summary_from_data(data: dict[str, Any] | None) -> str:
    """Resumen para los research.json sin research.md: alcance, decisión editorial y nota de medios."""
    parts = [str((data or {}).get(key) or "").strip() for key in ("scope", "editorial_decision", "media_note")]
    return "\n\n".join(part for part in parts if part)


def read_detail(research_id: str, resources_dir: Path) -> dict[str, Any] | None:
    """Todo lo que la pantalla necesita de una investigación, leído de su copia en la librería."""
    if not _RESEARCH_ID.match(research_id):
        return None
    record = collection(COLLECTION).get(research_id)
    if record is None:
        return None
    record = dict(record)
    base = resources_dir / "research" / research_id
    main_name = str(record.get("main") or "research.md")
    data: dict[str, Any] | None = None
    if main_name.lower().endswith(".json") and (base / main_name).is_file():
        try:
            loaded = json.loads((base / main_name).read_text(encoding="utf-8"))
            data = loaded if isinstance(loaded, dict) else None
        except (OSError, ValueError):
            data = None
    if main_name.lower().endswith(".md"):
        summary = _read_text(base / main_name)
    else:
        summary = _read_text(base / "research.md") or _summary_from_data(data)
    versions = groups(_all_records()).get(str(record.get("group") or research_id), [record])
    return {
        **record,
        "summary": summary,
        "findings": _findings(data),
        "discarded": _discarded(data),
        "versions": [
            {
                "research_id": version["research_id"],
                "revision": version.get("revision", ""),
                "researched_at": version.get("researched_at", ""),
                "topic": version.get("topic", ""),
            }
            for version in versions
        ],
    }


def file_location(research_id: str, relative: str, resources_dir: Path) -> Path | None:
    """Ruta de un archivo copiado, solo si está registrado en esa investigación."""
    if not _RESEARCH_ID.match(research_id):
        return None
    record = collection(COLLECTION).get(research_id)
    if record is None or relative not in {item["path"] for item in record.get("files") or []}:
        return None
    base = (resources_dir / "research" / research_id).resolve()
    target = (base / relative).resolve()
    if base not in target.parents or not target.is_file():
        return None
    return target
