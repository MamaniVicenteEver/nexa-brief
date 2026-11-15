"""Resolve and assemble the single NodeMotion engine for demos and projects.

Assembly is byte-preserving: fragments replace only their recorded markers;
script tags, scope, execution order, whitespace, and relative URLs stay intact.
"""
from __future__ import annotations

import errno
import fcntl
import hashlib
import json
import os
import re
import tempfile
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT.parents[1]
_REVISION = re.compile(r"[a-f0-9]{64}\Z")
ENGLISH_RUNTIME_NAMES = {
    "escenas.js": "scenes.js", "transiciones.js": "transitions.js",
    "fondo.js": "background.js", "garabatos.js": "scribbles.js",
    "trazo.css": "stroke.css", "decadas.css": "decades.css",
    "galeria.html": "gallery.html", "outroV2.js": "outro-v2.js",
    "index-V1-MOVIL.html": "index-v1-mobile.html",
    "index-V1-DESKTOP.html": "index-v1-desktop.html",
    "index-V1-DESKTOP-V1.html": "index-v1-desktop-v1.html",
}
_ID = re.compile(r"[a-z0-9][a-z0-9-]*\Z")
_BLOCK = re.compile(rb"<(?P<tag>style|script)\b(?P<attrs>[^>]*?)>(?P<body>.*?)</(?P=tag)\s*>", re.I | re.S)


def _design_root(design_id: str) -> Path:
    if not isinstance(design_id, str) or not _ID.fullmatch(design_id):
        raise KeyError(design_id)
    for family in ("lyrics", "promo"):
        root = ROOT / family / "designs" / design_id
        if (root / "manifest.json").is_file():
            return root
    raise KeyError(f"Unregistered shared NodeMotion design: {design_id}")


def registered(design_id: str) -> bool:
    try:
        _design_root(design_id)
        return True
    except (KeyError, TypeError):
        return False


def design_ids() -> tuple[str, ...]:
    return tuple(sorted(path.parent.name for family in ("lyrics", "promo")
                        for path in (ROOT / family / "designs").glob("*/manifest.json")))


def _read_manifest(root: Path) -> dict[str, Any]:
    return json.loads((root / "manifest.json").read_text(encoding="utf-8"))


def _revision_for_root(root: Path, manifest: dict[str, Any]) -> str:
    paths = [manifest["document"], *(item["path"] for item in manifest["fragments"]),
             *manifest["runtime_aliases"].values()]
    digest = hashlib.sha256()
    descriptor = {"document": manifest["document"], "fragments": manifest["fragments"],
                  "runtime_aliases": manifest["runtime_aliases"]}
    if manifest.get("demo_resource_aliases"):
        descriptor["demo_resource_aliases"] = manifest["demo_resource_aliases"]
    digest.update(json.dumps(descriptor, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\0")
    for relative in sorted(set(paths)):
        path = _contained(root, relative)
        if path is None:
            raise ValueError("Invalid NodeMotion revision path")
        digest.update(relative.encode("utf-8") + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def _select_root(design_id: str, revision: str | None = None) -> Path:
    root = _design_root(design_id)
    if revision is None:
        return root
    if not isinstance(revision, str) or not _REVISION.fullmatch(revision):
        raise KeyError("Invalid NodeMotion engine revision")
    archived = _contained(root, "revisions/" + revision)
    if archived is not None and (archived / "manifest.json").is_file():
        manifest = _read_manifest(archived)
        if manifest.get("revision") != revision or _revision_for_root(archived, manifest) != revision:
            raise ValueError(f"Corrupt NodeMotion engine revision: {design_id}/{revision}")
        return archived
    if _revision_for_root(root, _read_manifest(root)) == revision:
        return root
    raise KeyError(f"Unavailable NodeMotion engine revision: {design_id}/{revision}")


def available_revision(design_id: str, revision: str) -> bool:
    try:
        _select_root(design_id, revision)
        return True
    except (KeyError, ValueError, OSError):
        return False


def design_manifest(design_id: str, revision: str | None = None) -> dict[str, Any]:
    return _read_manifest(_select_root(design_id, revision))


def _contained(root: Path, relative: str) -> Path | None:
    if not isinstance(relative, str) or not relative or "\\" in relative or "\x00" in relative:
        return None
    path = PurePosixPath(relative)
    if path.is_absolute() or ".." in path.parts:
        return None
    candidate = (root / path).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def demo_folder(design_id: str, revision: str | None = None) -> Path:
    manifest = design_manifest(design_id, revision)
    path = _contained(TEMPLATES, manifest["demo_folder"])
    if path is None:
        raise ValueError("Invalid NodeMotion demo folder")
    return path


def assemble(design_id: str, revision: str | None = None) -> bytes:
    root = _select_root(design_id, revision)
    manifest = _read_manifest(root)
    document = (root / manifest["document"]).read_bytes()
    for fragment in manifest["fragments"]:
        marker = fragment["marker"].encode("ascii")
        if document.count(marker) != 1:
            raise ValueError(f"Invalid fragment marker in {design_id}: {fragment['path']}")
        path = _contained(root, fragment["path"])
        if path is None:
            raise ValueError("Invalid NodeMotion fragment path")
        document = document.replace(marker, path.read_bytes(), 1)
    return document


def runtime_assets(design_id: str, revision: str | None = None) -> dict[str, Path]:
    """Canonical code keyed by its unchanged URL relative to a project."""
    root = _select_root(design_id, revision)
    result: dict[str, Path] = {}
    for relative, canonical in _read_manifest(root)["runtime_aliases"].items():
        path = _contained(root, canonical)
        if path is None:
            raise ValueError("Invalid NodeMotion runtime path")
        result[relative] = path
    return result


def resolve_runtime_asset(design_id: str, relative_path: str, revision: str | None = None) -> Path | None:
    # Rechazar traversal antes de resolver tanto alias como medios de la demo.
    if _contained(demo_folder(design_id, revision), relative_path) is None:
        return None
    normalized = PurePosixPath(relative_path).as_posix()
    path = runtime_assets(design_id, revision).get(normalized)
    if path is None:
        from src.core.nodemotion.shared.bundled import demo_aliases, resolve_bundled_key
        aliases = demo_aliases(design_id)
        aliases.update(design_manifest(design_id, revision).get("demo_resource_aliases", {}))
        key = aliases.get(normalized)
        if key is not None:
            path = resolve_bundled_key(key)

    if path is None:
        path = _contained(demo_folder(design_id, revision), normalized)
    return path if path is not None and path.is_file() else None


def runtime_files(design_id: str, revision: str | None = None) -> dict[str, Path]:
    """Files for a temporary recorder export; code always comes from the engine."""
    root = demo_folder(design_id, revision)
    manifest = design_manifest(design_id, revision)
    result: dict[str, Path] = {}
    for relative in manifest.get("runtime_assets", []):
        source = _contained(root, relative)
        if source is None:
            raise ValueError("Invalid declared NodeMotion runtime asset")
        if source.is_dir():
            for path in source.rglob("*"):
                if path.is_file() and _contained(root, path.relative_to(root).as_posix()) is not None:
                    result[path.relative_to(root).as_posix()] = path
        elif source.is_file():
            result[relative] = source
    from src.core.nodemotion.shared.bundled import demo_aliases, resolve_bundled_key
    aliases = demo_aliases(design_id)
    aliases.update(manifest.get("demo_resource_aliases", {}))
    for relative, key in aliases.items():
        if any(relative == declared or relative.startswith(declared.rstrip("/") + "/")
               for declared in manifest.get("runtime_assets", [])):
            result[relative] = resolve_bundled_key(key)
    result.update(runtime_assets(design_id, revision))
    return result


def engine_revision(design_id: str, revision: str | None = None) -> str:
    root = _select_root(design_id, revision)
    return _revision_for_root(root, _read_manifest(root))


def archive_engine(design_id: str, html: bytes | str,
                   runtime_files: Mapping[str, Path | bytes] | None = None, *,
                   expected_revision: str | None = None) -> str:
    """Preserve a prepared snapshot as an immutable, shared engine revision.

    The caller supplies implementation and runtime support assets (fonts/SVG).
    Config, lyrics, audio, and scene media remain data in the project.
    Identical engine bytes and URL mappings reuse the same content hash.
    """
    if isinstance(html, str):
        html = html.encode("utf-8")
    base = _design_root(design_id)
    current = _read_manifest(base)
    document, fragments, files = split_document(html)
    files["document.html"] = document
    aliases: dict[str, str] = {}
    for relative, source in sorted((runtime_files or {}).items()):
        if _contained(base, relative) is None or PurePosixPath(relative).suffix.lower() not in (".js", ".css", ".html", ".woff", ".woff2", ".ttf", ".otf", ".svg"):
            raise ValueError(f"Only safe relative runtime code or support assets may be archived: {relative}")
        relative = PurePosixPath(relative).as_posix()
        if relative == "index.html":
            raise ValueError("Pass the main HTML as the document, not a runtime file")
        canonical = current["runtime_aliases"].get(relative)
        if canonical is None:
            canonical = "runtime/" + "/".join(ENGLISH_RUNTIME_NAMES.get(part, part) for part in PurePosixPath(relative).parts)
        if _contained(base, canonical) is None:
            raise ValueError(f"Invalid canonical runtime path: {canonical}")
        if canonical in aliases.values():
            raise ValueError(f"Runtime path collision while archiving {relative}")
        aliases[relative] = canonical
        files[canonical] = source if isinstance(source, bytes) else Path(source).read_bytes()
    manifest = {"schema_version": 1, "design_id": design_id, "family": current["family"],
                "demo_folder": current["demo_folder"], "document": "document.html",
                "fragments": fragments, "runtime_aliases": aliases,
                "runtime_assets": current.get("runtime_assets", []),
                "source_sha256": hashlib.sha256(html).hexdigest(), "immutable": True,
                "contract_sources": current.get("contract_sources", {})}
    if current.get("demo_resource_aliases"):
        manifest["demo_resource_aliases"] = dict(current["demo_resource_aliases"])
    # Calcular el mismo hash que engine_revision, sin escribir una copia temporal.
    descriptor = {"document": manifest["document"], "fragments": fragments, "runtime_aliases": aliases}
    if manifest.get("demo_resource_aliases"):
        descriptor["demo_resource_aliases"] = manifest["demo_resource_aliases"]
    digest = hashlib.sha256(json.dumps(descriptor, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\0")
    for relative in sorted(files):
        digest.update(relative.encode("utf-8") + b"\0" + files[relative] + b"\0")
    revision = digest.hexdigest()
    if expected_revision is not None and revision != expected_revision:
        raise ValueError("NodeMotion engine changed while capturing its revision")
    archived = base / "revisions" / revision
    if (archived / "manifest.json").is_file():
        saved = _read_manifest(archived)
        if saved.get("revision") != revision or _revision_for_root(archived, saved) != revision:
            raise ValueError(f"Corrupt existing NodeMotion revision: {revision}")
        return revision
    revisions = base / "revisions"
    revisions.mkdir(parents=True, exist_ok=True)
    # El manifiesto se publica al final en un rename atómico: ningún lector
    # puede aceptar una revisión incompleta por cuota, cancelación o concurrencia.
    with tempfile.TemporaryDirectory(prefix=".archive-", dir=revisions) as directory:
        staging = Path(directory)
        for relative, body in files.items():
            path = staging / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        manifest["revision"] = revision
        (staging / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        if _revision_for_root(staging, manifest) != revision:
            raise ValueError("NodeMotion revision failed integrity before publication")
        try:
            staging.rename(archived)
        except OSError as exc:
            if exc.errno not in (errno.EEXIST, errno.ENOTEMPTY):
                raise
            saved = _read_manifest(archived)
            if saved.get("revision") != revision or _revision_for_root(archived, saved) != revision:
                raise ValueError(f"Corrupt concurrent NodeMotion revision: {revision}") from exc
    return revision


@contextmanager
def _engine_lock(design_id: str):
    key = hashlib.sha256(str(_design_root(design_id).resolve()).encode()).hexdigest()
    directory = Path(tempfile.gettempdir()) / f"nodemotion-engine-locks-{os.getuid()}"
    directory.mkdir(mode=0o700, exist_ok=True)
    with (directory / (key + ".lock")).open("a+b") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def freeze_engine(design_id: str, revision: str | None = None) -> str:
    """Select immutable code for one preview or recorder execution.

    A stable project still follows the current engine at the next execution;
    every file in this execution comes from one archived revision. Verify the
    captured hash to detect a compiler editing canonical files during capture.
    """
    base = _design_root(design_id)
    with _engine_lock(design_id):
        for _ in range(3):
            before = engine_revision(design_id)
            selected_revision = revision or before
            selected = _select_root(design_id, selected_revision)
            if selected != base:
                return selected_revision
            document = assemble(design_id)
            code = {relative: path.read_bytes() for relative, path in runtime_assets(design_id).items()}
            after = engine_revision(design_id)
            if before != after:
                continue
            try:
                return archive_engine(design_id, document, code, expected_revision=selected_revision)
            except ValueError as exc:
                if "changed while capturing" not in str(exc):
                    raise
    raise ValueError("NodeMotion engine changed while freezing the execution revision")


def split_document(html: bytes) -> tuple[bytes, list[dict[str, str]], dict[str, bytes]]:
    """Extract inline bodies without parsing or serializing the original markup."""
    fragments: list[dict[str, str]] = []
    files: dict[str, bytes] = {}
    counts = {"style": 0, "script": 0}

    def replace(match: re.Match[bytes]) -> bytes:
        tag = match["tag"].decode("ascii").lower()
        if tag == "script" and re.search(rb"\bsrc\s*=", match["attrs"], re.I):
            return match[0]
        counts[tag] += 1
        if tag == "style":
            relative = f"styles/{counts[tag]:02d}-design.css"
        else:
            role = "hyperframes-clock" if b"data-nb-hf-clock" in match["attrs"].lower() else "runtime"
            relative = f"scripts/{counts[tag]:02d}-{role}.js"
        marker = f"<!-- nodemotion-fragment:{relative} -->"
        if marker.encode("ascii") in html:
            raise ValueError("Source already contains a NodeMotion fragment marker")
        fragments.append({"path": relative, "marker": marker, "kind": tag})
        files[relative] = match["body"]
        start, end = match.start("body") - match.start(), match.end("body") - match.start()
        return match[0][:start] + marker.encode("ascii") + match[0][end:]

    return _BLOCK.sub(replace, html), fragments, files


def update_engine(design_id: str, html: bytes | str) -> Path:
    """Publish compiler output while excluding concurrent execution snapshots."""
    with _engine_lock(design_id):
        return _update_engine(design_id, html)


def _update_engine(design_id: str, html: bytes | str) -> Path:
    """Compiler output target. Never replace the thin demo entry with a code copy."""
    if isinstance(html, str):
        html = html.encode("utf-8")
    root = _design_root(design_id)
    manifest = design_manifest(design_id)
    # Toda revisión fijada debe seguir disponible después de una compilación.
    archive_engine(design_id, assemble(design_id), runtime_assets(design_id))
    document, fragments, files = split_document(html)
    # Los archivos dejan de ser fuente solo después de escribir el nuevo manifiesto.
    stale = {item["path"] for item in manifest["fragments"]} - set(files)
    for relative, body in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    (root / manifest["document"]).write_bytes(document)
    manifest["fragments"] = fragments
    manifest["source_sha256"] = hashlib.sha256(html).hexdigest()
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for relative in stale:
        path = _contained(root, relative)
        if path is not None:
            path.unlink(missing_ok=True)
    return root / manifest["document"]


def catalog(design_id: str) -> dict[str, Any]:
    """Selective catalog derived from the authoritative metadata, never engine code."""
    from .discovery import catalog as discover
    return discover(design_id)


def component_contract(design_id: str, entry_id: str) -> dict[str, Any]:
    from .discovery import component_contract as discover
    return discover(design_id, entry_id)
