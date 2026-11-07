"""Logical content namespaces independent of the on-disk profile layout."""

from pathlib import Path, PurePosixPath

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings

SANDBOX_SHARED_DIRS = frozenset({"_proto", "_engine", "_mapas", "_pizarra", "_avatar", "_player", "_atlas", "_vida", "_tactico"})


def is_public_showcase_engine_key(parts: tuple[str, ...]) -> bool:
    """Explicit shared showcase code only; never fall back to episode data."""
    # The gallery's modules resolve assets relative to the episode root. This
    # alias is served exclusively from the active profile by resolve_content_key.
    if parts[:4] == ("sandbox", "nodehistory", "atlas-en-movimiento", "assets"):
        return len(parts) >= 5 and not is_private_content_key("/".join(parts))
    if any(p.startswith(".") or p in {"work", "test", "tests", "assets", "logs"} for p in parts):
        return False
    if any(p.lower() in {"accounts.json", "users.json", "access.json"} or p.lower().startswith("client_secret") for p in parts):
        return False
    cara = ("sandbox", "nodeaction", "cara-a-cara")
    atlas = ("sandbox", "nodehistory", "atlas-en-movimiento")
    if parts[:3] == cara:
        return len(parts) == 4 and parts[3] in {"showcase.html", "showcase.js", "showcase-preview.html"} or len(parts) >= 5 and parts[3] == "showcase"
    if parts[:3] == atlas:
        return len(parts) >= 5 and (parts[3] == "engine" or parts[3:5] == ("preview", "tactico"))
    return False


def is_shared_template_key(parts: tuple[str, ...]) -> bool:
    """Repository code/examples are shared; legacy episodes have an owner."""
    if len(parts) >= 3 and parts[:2] in {("_tools", "explainer-kit"), ("_tools", "player")}:
        return True
    if len(parts) >= 3 and parts[1] == "muestras":
        return True
    return bool(parts and parts[0] == "sandbox" and (
        (len(parts) >= 3 and parts[1] == "_proto")
        or (len(parts) >= 4 and parts[2] in SANDBOX_SHARED_DIRS)
    ))


def production_root() -> Path:
    layout = layout_for_settings(settings)
    return layout.productions_dir if layout.schema_version >= 2 else settings.templates_dir


def sandbox_root() -> Path:
    layout = layout_for_settings(settings)
    return layout.sandbox_dir if layout.schema_version >= 2 else settings.templates_dir / "sandbox"


def preview_directory(video_dir: Path) -> Path:
    layout = layout_for_settings(settings)
    if layout.schema_version >= 2 and video_dir.resolve().is_relative_to(layout.root.resolve()):
        return video_dir / "assets" / "thumbnails"
    return video_dir / "render"


def content_key(path: Path) -> str:
    """A portable URL path; never expose an absolute host path."""
    layout = layout_for_settings(settings)
    namespaces = []
    if layout.schema_version >= 2:
        namespaces += [(layout.productions_dir, "productions"), (layout.sandbox_dir, "sandbox"),
                       (layout.renders_dir, "renders")]
    namespaces.append((settings.templates_dir, "bundled" if layout.schema_version >= 2 else ""))
    resolved = path.resolve()
    for root, prefix in namespaces:
        if resolved.is_relative_to(root.resolve()):
            relative = resolved.relative_to(root.resolve()).as_posix()
            if layout.schema_version >= 2 and root == settings.templates_dir and not (is_shared_template_key(tuple(relative.split("/"))) or layout.schema_version >= 3 and is_public_showcase_engine_key(tuple(relative.split("/")))):
                raise ValueError("Legacy episodes are not shared between profiles")
            if root == settings.templates_dir and relative.startswith("_tools/"):
                return relative
            return f"{prefix}/{relative}" if prefix else relative
    raise ValueError("Content is outside the selected profile and template roots")


def resolve_content_key(key: str) -> Path:
    """Resolve a logical content path; reject traversal and symlink escapes."""
    parts = PurePosixPath(key).parts
    if not parts or key.startswith("/") or "\\" in key or any(p in {".", ".."} or p.startswith(".") for p in key.split("/")):
        raise ValueError("Invalid content key")
    layout = layout_for_settings(settings)
    atlas_assets = ("bundled", "sandbox", "nodehistory", "atlas-en-movimiento", "assets")
    if layout.schema_version >= 3 and parts[:5] == atlas_assets:
        # Do not resolve this alias through bundled templates, even when the
        # selected profile does not contain the file.
        if is_private_content_key(key):
            raise ValueError("Private content key")
        root, tail = layout.sandbox_dir, parts[2:]
    else:
        root, tail = None, None
    roots = {"productions": layout.productions_dir, "sandbox": layout.sandbox_dir,
             "renders": layout.renders_dir, "bundled": settings.templates_dir} if layout.schema_version >= 2 else {}
    if root is not None:
        pass
    elif parts[0] in roots:
        root, tail = roots[parts[0]], parts[1:]
        shared = SANDBOX_SHARED_DIRS
        if parts[0] == "bundled" and not (is_shared_template_key(parts[1:]) or layout.schema_version >= 3 and is_public_showcase_engine_key(parts[1:])):
            raise ValueError("Legacy episodes are not shared between profiles")
        if parts[0] == "sandbox" and (parts[1] in shared if len(parts) > 1 else False):
            root = settings.templates_dir / "sandbox"
        elif parts[0] == "sandbox" and len(parts) > 2 and parts[2] in shared:
            root = settings.templates_dir / "sandbox"
    else:
        if layout.schema_version >= 2 and not is_shared_template_key(parts):
            raise ValueError("Content is not owned by the selected profile")
        root, tail = settings.templates_dir, parts
    if root.is_symlink():
        raise ValueError("Content roots cannot be symbolic links")
    current = root
    for part in tail:
        current = current / part
        if current.is_symlink():
            raise ValueError("Content keys cannot traverse symbolic links")
    target = root.joinpath(*tail).resolve()
    if target == root.resolve() or not target.is_relative_to(root.resolve()):
        raise ValueError("Content key escapes its root")
    return target


def is_private_content_key(key: str) -> bool:
    parts = key.lower().replace("\\", "/").split("/")
    return (any(p.startswith(".") or p in {"work", "test", "tests", "logs", "connections", "browser_profiles", "browser-profiles"} for p in parts)
            or any(p in {"accounts.json", "users.json", "access.json"} or p.startswith("client_secret") for p in parts))
