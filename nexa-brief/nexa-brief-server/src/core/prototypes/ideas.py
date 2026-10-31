"""Persistencia de ideas de prototipos dentro del sandbox.

Ejemplo:
    idea = create_idea("otros", "Mi idea", "Una escena nocturna", [("ref.png", png_bytes)])
    idea = get_idea("otros", "mi-idea")
"""

from __future__ import annotations

import json
import re
import shutil
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path, PurePosixPath
from typing import BinaryIO, Iterable

from src.config.settings import settings

REFERENCE_CATEGORIES = (
    "nodetech",
    "nodehistory",
    "nodepolitics",
    "nodeeconomy",
    "nodeaction",
    "nodemotion",
    "otros",
)
ALLOWED_EXTENSIONS = frozenset({".mp4", ".mov", ".webm", ".jpg", ".png", ".webp", ".gif"})
MAX_UPLOAD_BYTES = 300 * 1024 * 1024
_CHUNK_SIZE = 1024 * 1024


class IdeaInputError(ValueError):
    """Entrada inválida al crear una idea."""


class UploadTooLargeError(IdeaInputError):
    """Un archivo supera el límite de subida por archivo."""


@dataclass(frozen=True)
class IdeaFile:
    name: str
    path: Path

    @property
    def is_video(self) -> bool:
        return self.path.suffix.lower() in {".mp4", ".mov", ".webm"}


@dataclass(frozen=True)
class Idea:
    category: str
    slug: str
    title: str
    notes: str
    path: Path
    files: tuple[IdeaFile, ...]


def _templates_dir(templates_dir: Path | None) -> Path:
    return (templates_dir or settings.templates_dir).resolve()


def _reference_dir(templates_dir: Path | None = None) -> Path:
    return _templates_dir(templates_dir) / "sandbox" / "referencias"


def _safe_segment(value: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value))


def _slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.casefold()).strip("-")
    return slug or "idea"


def _upload_name(filename: str) -> str:
    normalized = filename.replace("\\", "/")
    name = PurePosixPath(normalized).name.strip()
    if not name or name in {".", ".."}:
        raise IdeaInputError("Cada archivo debe tener un nombre válido.")
    if Path(name).suffix.lower() not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise IdeaInputError(f"Tipo de archivo no permitido: {name}. Extensiones permitidas: {allowed}.")
    if len(name) > 180:
        suffix = Path(name).suffix.lower()
        name = f"{name[: 180 - len(suffix)]}{suffix}"
    return name


def _available_filename(directory: Path, filename: str) -> str:
    candidate = Path(filename)
    stem, suffix = candidate.stem, candidate.suffix
    counter = 2
    name = filename
    while (directory / name).exists():
        name = f"{stem}-{counter}{suffix}"
        counter += 1
    return name


def _write_upload(source: bytes | BinaryIO, destination: Path) -> None:
    size = 0
    stream: BinaryIO
    if isinstance(source, bytes):
        chunks: Iterable[bytes] = (source[index : index + _CHUNK_SIZE] for index in range(0, len(source), _CHUNK_SIZE))
    else:
        stream = source

        def read_chunks() -> Iterable[bytes]:
            while chunk := stream.read(_CHUNK_SIZE):
                yield chunk

        chunks = read_chunks()

    with destination.open("wb") as output:
        for chunk in chunks:
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise UploadTooLargeError(
                    f"{destination.name} supera el límite de {MAX_UPLOAD_BYTES // 2**20} MB por archivo."
                )
            output.write(chunk)


def _load_idea(category: str, slug: str, item_dir: Path) -> Idea:
    info_path = item_dir / "info.json"
    try:
        info = json.loads(info_path.read_text(encoding="utf-8")) if info_path.is_file() else {}
    except (OSError, json.JSONDecodeError):
        info = {}
    if not isinstance(info, dict):
        info = {}
    notes_path = item_dir / "NOTAS.md"
    notes = ""
    if notes_path.is_file():
        content = notes_path.read_text(encoding="utf-8")
        notes = content.partition("\n")[2].lstrip("\n") if content.startswith("# ") else content
    files = tuple(
        IdeaFile(name=path.name, path=path)
        for path in sorted(item_dir.iterdir(), key=lambda item: item.name.casefold())
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS
    )
    return Idea(
        category=category,
        slug=slug,
        title=str(info.get("title") or slug.replace("-", " ").title()),
        notes=notes,
        path=item_dir,
        files=files,
    )


def create_idea(
    category: str,
    title: str,
    notes: str,
    files: Iterable[tuple[str, bytes | BinaryIO]],
    *,
    templates_dir: Path | None = None,
) -> Idea:
    """Crea una idea, su NOTAS.md y los archivos adjuntos.

    Los archivos admiten bytes o streams binarios; cada archivo tiene un máximo de 300 MiB.
    """
    if category not in REFERENCE_CATEGORIES:
        raise IdeaInputError("La categoría no existe en referencias del sandbox.")
    clean_title = title.strip()
    if not clean_title:
        raise IdeaInputError("El título es obligatorio.")

    uploads = [(_upload_name(name), content) for name, content in files]
    reference_dir = _reference_dir(templates_dir)
    category_dir = reference_dir / category
    category_dir.mkdir(parents=True, exist_ok=True)
    base_slug = _slugify(clean_title)
    suffix = 1
    while True:
        slug = base_slug if suffix == 1 else f"{base_slug}-{suffix}"
        if not _safe_segment(slug):
            raise IdeaInputError("No se pudo generar un identificador válido para la idea.")
        item_dir = category_dir / slug
        try:
            item_dir.mkdir()
            break
        except FileExistsError:
            suffix += 1

    try:
        (item_dir / "NOTAS.md").write_text(
            f"# {clean_title}\n\n{notes.strip()}\n",
            encoding="utf-8",
        )
        (item_dir / "info.json").write_text(
            json.dumps(
                {
                    "title": clean_title,
                    "summary": notes.strip()[:500],
                    "created_at": date.today().isoformat(),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        for filename, content in uploads:
            destination_name = _available_filename(item_dir, filename)
            _write_upload(content, item_dir / destination_name)
    except Exception:
        shutil.rmtree(item_dir, ignore_errors=True)
        raise

    return _load_idea(category, slug, item_dir)


def list_ideas(*, templates_dir: Path | None = None) -> list[Idea]:
    """Lista las ideas guardadas en las siete categorías habilitadas."""
    root = _reference_dir(templates_dir)
    ideas = []
    for category in REFERENCE_CATEGORIES:
        category_dir = root / category
        if not category_dir.is_dir():
            continue
        for item_dir in sorted(category_dir.iterdir(), key=lambda item: item.name.casefold()):
            if item_dir.is_dir() and _safe_segment(item_dir.name):
                ideas.append(_load_idea(category, item_dir.name, item_dir))
    return ideas


def get_idea(category: str, slug: str, *, templates_dir: Path | None = None) -> Idea:
    """Obtiene una idea por categoría e identificador o lanza FileNotFoundError."""
    if category not in REFERENCE_CATEGORIES or not _safe_segment(slug):
        raise FileNotFoundError("referencia no encontrada")
    root = _reference_dir(templates_dir).resolve()
    item_dir = (root / category / slug).resolve()
    if not item_dir.is_relative_to(root) or not item_dir.is_dir():
        raise FileNotFoundError("referencia no encontrada")
    return _load_idea(category, slug, item_dir)
