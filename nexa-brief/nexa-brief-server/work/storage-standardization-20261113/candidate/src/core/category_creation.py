"""Create a top-level explainer category and provision its profile folders.

The API and the standalone CLI share this service so category setup has one
implementation and the filesystem/config stay in sync.
"""

from __future__ import annotations

import fcntl
import json
import os
import re
import tempfile
import unicodedata
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Literal

from pydantic import ValidationError

from src.config.content_paths import production_root
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.categories import (
    CategoryNode,
    CategoryStrategy,
    reload_categories,
    validate_tree,
)

CategoryLanguage = Literal["en", "es-419"]
_RESERVED_IDS = {"sandbox", "otros", "referencias", "nuevos", "sin_categoria"}


class CategoryCreationError(ValueError):
    """Expected, user-correctable category creation failure."""


class CategoryConflictError(CategoryCreationError):
    """The name, id, or required folder already belongs to existing data."""


class CategoryProvisioningError(RuntimeError):
    """The category was valid, but its profile files could not be installed."""


@dataclass(frozen=True)
class CategoryCreationResult:
    category_id: str
    category: CategoryNode
    created_paths: tuple[Path, ...]
    dry_run: bool = False


def _single_line(value: str, *, field: str, limit: int) -> str:
    if not isinstance(value, str):
        raise CategoryCreationError(f"{field} debe ser texto.")
    cleaned = " ".join(value.split()).strip()
    if len(cleaned) > limit:
        raise CategoryCreationError(f"{field} no puede superar {limit} caracteres.")
    return cleaned


def _category_id(display_name: str) -> str:
    # Split PascalCase names so NodeNews and Node News resolve to the same id.
    separated = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", display_name)
    decomposed = unicodedata.normalize("NFKD", separated)
    ascii_name = decomposed.encode("ascii", "ignore").decode("ascii")
    category_id = re.sub(r"[^A-Za-z0-9]+", "_", ascii_name).strip("_").lower()
    category_id = category_id[:48].rstrip("_")
    if not category_id or not category_id[0].isalpha():
        raise CategoryCreationError("El nombre debe incluir letras para generar el identificador.")
    if category_id in _RESERVED_IDS:
        raise CategoryCreationError("Ese nombre está reservado por el sistema.")
    return category_id


def _display_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_name = decomposed.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^A-Za-z0-9]+", "", ascii_name).lower()


def _strategy(display_name: str, topic: str, language: CategoryLanguage) -> CategoryStrategy:
    if language == "en":
        return CategoryStrategy(
            audience=f"Viewers who want to understand {topic} clearly and see why it matters.",
            angle=(
                f"Explain one specific aspect of {topic}, with useful context and verifiable facts."
            ),
            tone="Clear, accessible, factual, and non-sensational.",
            title_formulas=[
                "What you need to know about {topic}",
                "How {topic} works and why it matters",
                "The {topic} story, explained clearly",
            ],
            topic_ideas=[
                f"An introductory explainer about {topic}",
                f"A common misconception about {topic}, checked against reliable sources",
                f"Why {topic} matters and what is still uncertain",
            ],
            hashtags=["#explained", f"#{re.sub(r'[^A-Za-z0-9]', '', display_name)}"],
            rules=[
                "Separate verified facts from interpretation and opinion.",
                "Use identifiable sources for factual claims and current events.",
                "Do not invent dates, figures, quotes, or consequences.",
                "Keep the title faithful to the sources and finished script.",
            ],
            language="en",
            default_cadence="daily",
        )
    return CategoryStrategy(
        audience=f"Personas que quieren entender {topic} con claridad y saber por qué importa.",
        angle=f"Explicar un aspecto concreto de {topic}, con contexto útil y datos verificables.",
        tone="Claro, accesible, factual y sin sensacionalismo.",
        title_formulas=[
            "Lo que necesitas saber sobre {topic}",
            "Cómo funciona {topic} y por qué importa",
            "La historia de {topic}, explicada con claridad",
        ],
        topic_ideas=[
            f"Una explicación introductoria sobre {topic}",
            f"Un mito común sobre {topic}, contrastado con fuentes confiables",
            f"Por qué importa {topic} y qué sigue sin estar claro",
        ],
        hashtags=["#explicado", f"#{re.sub(r'[^A-Za-z0-9]', '', display_name)}"],
        rules=[
            "Distinguir los hechos verificados de la interpretación y la opinión.",
            "Usar fuentes identificables para datos y noticias actuales.",
            "No inventar fechas, cifras, citas ni consecuencias.",
            "Mantener el título fiel a las fuentes y al guion terminado.",
        ],
        language="es-419",
        default_cadence="daily",
    )


def _scaffold_plan(
    category_id: str, display_name: str, language: CategoryLanguage
) -> list[tuple[str, Path, str]]:
    """Return (logical path, directory, instructions) for this profile layout."""
    layout = layout_for_settings(settings)
    folder = category_id
    if layout.schema_version >= 2:
        sandbox_dir = layout.sandbox_dir
        productions_dir = layout.productions_dir
    else:
        # Legacy layouts still read drafts and videos from the shared templates tree.
        sandbox_dir = settings.templates_dir / "sandbox"
        productions_dir = production_root()

    language_label = "English" if language == "en" else "Spanish"
    return [
        (
            f"sandbox/{folder}",
            sandbox_dir / folder,
            f"# Sandbox · {display_name}\n\n"
            "Drafts for this category only. Keep each prototype in its own folder,\n"
            "use shared engines by reference, and promote reviewed work through the\n"
            "existing promotion flow.\n",
        ),
        (
            f"productions/{folder}",
            productions_dir / folder,
            f"# Productions · {display_name}\n\n"
            f"Category language: {language_label}. Keep one video per subfolder and store\n"
            "original media under that video's assets directory. Reuse shared designs;\n"
            "do not copy engine code into this folder.\n",
        ),
    ] + (
        [
            (
                f"renders/videos/{folder}",
                layout.renders_dir / "videos" / folder,
                f"# Rendered videos · {display_name}\n\n"
                "Generated video outputs for this category.\n",
            ),
            (
                f"renders/images/{folder}",
                layout.renders_dir / "images" / folder,
                f"# Rendered images · {display_name}\n\n"
                "Generated image outputs for this category.\n",
            ),
        ]
        if layout.schema_version >= 3
        else []
    )


@contextmanager
def _config_lock(path: Path) -> Iterator[None]:
    lock_path = path.with_name(f".{path.name}.category-create.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _write_config_atomically(path: Path, data: dict) -> None:
    if path.is_symlink():
        raise CategoryCreationError("El archivo de categorías no puede ser un enlace simbólico.")
    mode = path.stat().st_mode & 0o777
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temp_name, mode)
        os.replace(temp_name, path)
        temp_name = ""
        try:
            dir_fd = os.open(path.parent, os.O_DIRECTORY)
        except OSError:
            return
        try:
            try:
                os.fsync(dir_fd)
            except OSError:
                # The atomic replace is already committed; some filesystems do
                # not support fsync on directories.
                pass
        finally:
            try:
                os.close(dir_fd)
            except OSError:
                pass
    except Exception:
        if temp_name:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
        raise


def _create_scaffold(plan: list[tuple[str, Path, str]]) -> tuple[list[Path], list[Path]]:
    created_dirs: list[Path] = []
    created_files: list[Path] = []
    _validate_scaffold(plan)
    try:
        for _, directory, instructions in plan:
            if not directory.exists():
                directory.mkdir(parents=True, exist_ok=True)
                created_dirs.append(directory)
            agents_file = directory / "AGENTS.md"
            if not agents_file.exists():
                with agents_file.open("x", encoding="utf-8") as output:
                    output.write(instructions)
                created_files.append(agents_file)
    except Exception:
        _rollback_scaffold(created_dirs, created_files)
        raise
    return created_dirs, created_files


def _rollback_scaffold(created_dirs: list[Path], created_files: list[Path]) -> None:
    for file_path in reversed(created_files):
        try:
            file_path.unlink(missing_ok=True)
        except OSError:
            pass
    for directory in reversed(created_dirs):
        try:
            directory.rmdir()
        except OSError:
            pass


def _validate_scaffold(plan: list[tuple[str, Path, str]]) -> None:
    for _, directory, instructions in plan:
        for ancestor in directory.parents:
            if ancestor.is_symlink():
                raise CategoryConflictError(
                    f"La ruta contiene un enlace simbólico: {ancestor.name}."
                )
        if directory.is_symlink():
            raise CategoryConflictError(
                f"La carpeta destino es un enlace simbólico: {directory.name}."
            )
        if directory.exists() and not directory.is_dir():
            raise CategoryConflictError(
                f"Ya existe un archivo con el nombre de la carpeta {directory.name}."
            )
        if directory.exists():
            existing = list(directory.iterdir())
            if any(item.is_symlink() or item.name != "AGENTS.md" for item in existing):
                raise CategoryConflictError(
                    f"La carpeta destino ya contiene archivos: {directory.name}."
                )
            if existing:
                agents_file = directory / "AGENTS.md"
                if (
                    not agents_file.is_file()
                    or agents_file.read_text(encoding="utf-8") != instructions
                ):
                    raise CategoryConflictError(
                        f"La carpeta destino ya tiene instrucciones distintas: {directory.name}."
                    )


def _walk_nodes(nodes: dict[str, CategoryNode]) -> Iterator[tuple[str, CategoryNode]]:
    for node_id, node in nodes.items():
        yield node_id, node
        yield from _walk_nodes(node.children)


def _updated_config(
    raw: dict, category_id: str, category: CategoryNode, display_name: str
) -> dict:
    categories = raw.get("categories")
    niches = raw.get("niches", {})
    if not isinstance(categories, dict) or not isinstance(niches, dict):
        raise CategoryCreationError("El archivo activo no contiene categorías y nichos válidos.")
    nodes = {
        node_id: CategoryNode.model_validate(node)
        for node_id, node in categories.items()
    }
    normalized_name = _display_key(display_name)
    for existing_id, existing in _walk_nodes(nodes):
        if existing_id == category_id:
            raise CategoryConflictError(f"Ya existe la categoría {category_id}.")
        existing_name = _display_key(existing.display_name)
        if existing_name == normalized_name:
            raise CategoryConflictError(f"Ya existe una categoría llamada {existing.display_name}.")

    nodes[category_id] = category
    validate_tree(nodes, set(niches))
    updated_categories = dict(categories)
    updated_categories[category_id] = category.model_dump(mode="json")
    updated = dict(raw)
    updated["categories"] = updated_categories
    return updated


def create_category(
    display_name: str,
    *,
    topic: str = "",
    language: CategoryLanguage = "es-419",
    dry_run: bool = False,
    niches_path: Path | None = None,
) -> CategoryCreationResult:
    """Create an empty explainer category and its profile scaffold."""
    name = _single_line(display_name, field="El nombre", limit=48)
    if len(name) < 2:
        raise CategoryCreationError("El nombre debe tener al menos 2 caracteres.")
    topic_value = _single_line(topic, field="El tema", limit=180) or name
    if language not in {"en", "es-419"}:
        raise CategoryCreationError("El idioma debe ser en o es-419.")
    category_id = _category_id(name)
    strategy = _strategy(name, topic_value, language)
    category = CategoryNode(
        display_name=name,
        topic=topic_value,
        status="empty",
        engine="explainer_kit",
        folder=category_id,
        strategy=strategy,
    )
    config_path = (niches_path or settings.niches_path).resolve()
    plan = _scaffold_plan(category_id, name, language)
    created_paths = tuple(directory for _, directory, _ in plan)

    if dry_run:
        try:
            if not config_path.is_file():
                raise CategoryCreationError("No se encontró el archivo de categorías activo.")
            raw = json.loads(config_path.read_text(encoding="utf-8"))
            _updated_config(raw, category_id, category, name)
            _validate_scaffold(plan)
        except CategoryCreationError:
            raise
        except (OSError, json.JSONDecodeError, ValidationError, ValueError) as exc:
            raise CategoryCreationError(f"No se pudo validar la categoría: {exc}") from exc
        return CategoryCreationResult(category_id, category, created_paths, dry_run=True)

    created_dirs: list[Path] = []
    created_files: list[Path] = []
    try:
        with _config_lock(config_path):
            if not config_path.is_file():
                raise CategoryCreationError("No se encontró el archivo de categorías activo.")
            raw = json.loads(config_path.read_text(encoding="utf-8"))
            updated = _updated_config(raw, category_id, category, name)

            created_dirs, created_files = _create_scaffold(plan)
            _write_config_atomically(config_path, updated)
            reload_categories()
    except CategoryCreationError:
        _rollback_scaffold(created_dirs, created_files)
        raise
    except OSError as exc:
        _rollback_scaffold(created_dirs, created_files)
        raise CategoryProvisioningError(
            "No se pudieron crear las carpetas o guardar la configuración."
        ) from exc
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        _rollback_scaffold(created_dirs, created_files)
        raise CategoryCreationError(f"No se pudo validar la categoría: {exc}") from exc

    return CategoryCreationResult(category_id, category, created_paths)
