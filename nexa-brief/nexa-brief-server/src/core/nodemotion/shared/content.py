"""Locate virtual NodeMotion content only inside the selected profile.

Generic file routes and local recorder hosts share this bounded dispatch. A
recognized project owns its virtual namespace; unavailable or private content
never falls through to a physical legacy file in that namespace.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path, PurePosixPath
import re
from urllib.parse import unquote, urlsplit

from src.config.content_paths import is_private_content_key
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings

_PUBLIC_SUFFIXES = frozenset({
    ".html", ".json", ".js", ".css", ".woff", ".woff2", ".ttf", ".otf", ".svg",
    ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp",
})
_REVISION = re.compile(r"[0-9a-f]{64}\Z")


@dataclass(frozen=True)
class ProjectContent:
    root: Path
    relative: str


def _no_links(root: Path, target: Path) -> None:
    if not target.is_relative_to(root) or ".." in target.parts:
        raise ValueError("NodeMotion content is outside the selected profile")
    for part in (target, *target.parents):
        if part.is_symlink():
            raise ValueError("NodeMotion content cannot traverse a symlink")
        if part == root:
            break
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError("NodeMotion content escapes the selected profile")


def locate_project_content(path: Path) -> ProjectContent | None:
    """Return a registered project and URL tail, without guessing its design."""
    layout = layout_for_settings(settings)
    if layout.schema_version < 2 or not settings.storage_profile_dir:
        return None
    if not path.is_absolute() or ".." in path.parts or "\\" in str(path):
        raise ValueError("Invalid NodeMotion content path")
    scope = next((root for root in (layout.productions_dir / "nodemotion", layout.sandbox_dir / "nodemotion")
                  if path.is_relative_to(root)), None)
    if scope is None:
        return None
    _no_links(layout.root, path)
    from .execution import load_project
    for directory in (path, *path.parents):
        if directory == scope:
            break
        if not directory.is_relative_to(scope):
            break
        marker = directory / "project.json"
        if not marker.is_file():
            continue
        _no_links(layout.root, marker)
        project = load_project(directory)
        if project is None:
            continue
        relative = path.relative_to(directory).as_posix()
        if relative == ".":
            relative = "index.html"
        if is_private_content_key(relative):
            raise ValueError("Private NodeMotion content")
        return ProjectContent(directory, relative)
    return None


def has_project_entry(directory: Path) -> bool:
    """A data-only registered project has the same public index entry as before."""
    try:
        found = locate_project_content(directory / "index.html")
        if found is None or found.root != directory:
            return False
        from .execution import load_project
        return load_project(directory).get("workspace_only") is not True
    except (OSError, ValueError, KeyError):
        return False


def _revision_path(relative: str) -> tuple[str, str | None]:
    parts = relative.split("/", 2)
    if parts[0] != "revision":
        return relative, None
    if len(parts) != 3 or not _REVISION.fullmatch(parts[1]):
        raise ValueError("Invalid NodeMotion execution revision URL")
    return parts[2], parts[1]


def _scope_html(html: bytes, *, original_relative: str, relative: str,
                request_path: str, revision: str) -> bytes:
    current_path = unquote(urlsplit(request_path).path)
    if current_path.endswith(original_relative):
        root_url = current_path[:-len(original_relative)]
    elif current_path.endswith("/") and relative == "index.html":
        root_url = current_path
    else:
        raise ValueError("Cannot determine the NodeMotion static URL root")
    directory = PurePosixPath(relative).parent.as_posix()
    route = root_url + "revision/" + revision + "/"
    if directory != ".":
        route += directory + "/"
    base = re.search(rb'<base\s+href="([^"]*)">', html, flags=re.I)
    if base:
        return html[:base.start(1)] + route.encode() + base[1] + html[base.end(1):]
    return re.sub(rb"(<head\b[^>]*>)", lambda m: m[1] + f'<base href="{route}">'.encode(), html, count=1, flags=re.I)


def resolve_static_project_content(path: Path, request_path: str) -> bytes | Path | None:
    """Resolve local recorder requests; missing project data fails closed."""
    found = locate_project_content(path)
    if found is None:
        return None
    relative, revision = _revision_path(found.relative)
    if (is_private_content_key(relative) or PurePosixPath(relative).suffix.lower() not in _PUBLIC_SUFFIXES
            or any(part in {"", ".", ".."} for part in relative.split("/"))):
        raise ValueError("Private or invalid NodeMotion content")
    from .execution import load_project, resolve_project
    from src.templates._tools.nodemotion.shared.assemble import freeze_engine
    project = load_project(found.root)
    if PurePosixPath(relative).suffix.lower() == ".html" and revision is None:
        engine = project["engine"]
        revision = freeze_engine(project["design_id"], engine.get("revision") if engine["policy"] == "pinned" else None)
    value = resolve_project(found.root, relative, expected_revision=revision)
    if value is None:
        raise FileNotFoundError("NodeMotion project resource is unavailable")
    if PurePosixPath(relative).suffix.lower() == ".html":
        html = value if isinstance(value, bytes) else value.read_bytes()
        return _scope_html(html, original_relative=found.relative, relative=relative,
                           request_path=request_path, revision=revision) if revision else html
    return value
