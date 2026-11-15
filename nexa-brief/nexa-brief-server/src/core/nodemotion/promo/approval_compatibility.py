"""Preserve existing review identity only across proven byte-exact relocation.

No approval, quality, or revision fields are changed. This proof lets readiness
use its original file labels when every corresponding current resource still
has exactly the reviewed bytes. Changed content or draft choices fail closed.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

NAME = ".nodemotion-review-compatibility.json"
_FIELDS = ("draft_id", "template_id", "inputs", "details", "thumbnails", "preview_url")


def review_path(root: Path) -> Path:
    return root / NAME


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _relative(value: str) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise ValueError("Invalid review proof path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Invalid review proof path")
    return path.as_posix()


def _safe(root: Path, relative: str) -> Path:
    path = root / _relative(relative)
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError("Symlink in review compatibility source")
        if part == root:
            break
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Review compatibility source escapes the project")
    return path


def _fields_hash(draft: dict) -> str:
    from src.core.drafts import Draft
    try:
        draft = Draft.model_validate(draft).model_dump(mode="json")
    except ValueError:
        pass
    return _sha(json.dumps({key: draft.get(key) for key in _FIELDS}, ensure_ascii=False, sort_keys=True, default=str).encode())


def _hash_value(value: bytes | Path | None) -> str | None:
    if isinstance(value, bytes):
        return _sha(value)
    if isinstance(value, Path) and value.is_file():
        from .readiness import _file_hash
        return _file_hash(value)
    return None


def prepare_review_compatibility(root: Path, stage: Path, *, draft_id: str,
                                 retired_paths: Iterable[Path]) -> bytes | None:
    """Prepare proof after stage verification, before publishing project.json.

    Publish the proof first. Legacy readiness ignores this exact metadata file;
    the proof activates only when its exact staged project manifest is present.
    """
    from src.core.data import collection, documents
    from src.core.nodemotion.shared.execution import resolve_project
    from .readiness import _legacy_content_files, _file_hash
    draft = collection("drafts").get(draft_id)
    job = documents("draft_jobs").get(draft_id)
    if not isinstance(draft, dict) or not isinstance(job, dict):
        return None
    artifacts = job.get("artifacts") or {}
    if artifacts.get("output_dir") != str(root):
        raise ValueError("Review proof job belongs to another project")
    content = Path(artifacts.get("assets_dir") or root).resolve(strict=True)
    files = _legacy_content_files(root, content)
    removed = {str(path.relative_to(root)) for path in retired_paths}
    sources = {}
    for label, expected in files.items():
        original = root / label[len("@output/"):] if label.startswith("@output/") else content / label
        relative = original.relative_to(root).as_posix()
        _safe(root, relative)
        value = resolve_project(stage, relative)
        actual = _hash_value(value)
        if actual is None:
            if relative in removed:
                raise ValueError(f"Reviewed file has no migrated replacement: {relative}")
            actual = _file_hash(original)
        if actual != expected:
            raise ValueError(f"Reviewed bytes changed during migration: {relative}")
        sources[label] = {"relative": relative, "retained": relative not in removed}
    manifest = json.loads((stage / "project.json").read_bytes())
    created_timeline = None
    if manifest.get("timeline"):
        prefix = manifest.get("content_prefix", "")
        relative = f"{prefix}/{manifest['timeline']}" if prefix else manifest["timeline"]
        previous = _proof(root)
        pending = previous.get("created_timeline") if previous else None
        if not (root / relative).exists() or (isinstance(pending, dict) and pending.get("relative") == relative):
            created_timeline = {"relative": relative, "sha256": _file_hash(stage / relative)}
    proof = {"schema_version": 1, "kind": "nodemotion-review-relocation", "draft_id": draft_id,
             "design_id": manifest["design_id"], "project_sha256": _file_hash(stage / "project.json"),
             "content_relative": content.relative_to(root).as_posix(), "files": files, "sources": sources,
             "draft_fields_sha256": _fields_hash(draft), "created_timeline": created_timeline}
    return json.dumps(proof, ensure_ascii=False, sort_keys=True, indent=2).encode()


def _proof(root: Path) -> dict[str, Any] | None:
    path = review_path(root)
    if not path.is_file():
        return None
    try:
        _safe(root, NAME)
        if path.stat().st_size > 2 * 1024 * 1024:
            return None
        proof = json.loads(path.read_bytes())
        if proof.get("schema_version") != 1 or proof.get("kind") != "nodemotion-review-relocation":
            return None
        if not isinstance(proof.get("files"), dict) or proof["files"].keys() != proof.get("sources", {}).keys() or len(proof["files"]) > 10000:
            return None
        return proof
    except (OSError, ValueError, TypeError):
        return None


def is_pending_migration_timeline(root: Path, path: Path) -> bool:
    """Ignore only a newly staged timeline while project publication is pending."""
    if (root / "project.json").exists():
        return False
    proof = _proof(root)
    pending = proof.get("created_timeline") if proof else None
    if not isinstance(pending, dict):
        return False
    try:
        relative = path.relative_to(root).as_posix()
        if relative != pending["relative"] or any(item["relative"] == relative for item in proof["sources"].values()):
            return False
        from .readiness import _file_hash
        return _file_hash(_safe(root, relative)) == pending["sha256"]
    except (OSError, KeyError, ValueError, TypeError):
        return False


def compatible_legacy_files(root: Path) -> dict[str, str] | None:
    """Return reviewed labels only when all current bytes still prove equality."""
    proof = _proof(root)
    if proof is None:
        return None
    try:
        from src.core.nodemotion.shared.execution import load_project, resolve_project
        from .readiness import _file_hash, _legacy_content_files
        project = load_project(root)
        if project is None or project["design_id"] != proof["design_id"]:
            return None
        if _file_hash(root / "project.json") != proof["project_sha256"]:
            return None
        # El contrato viejo no enumeraba todas las extensiones (por ejemplo
        # MOV). Aun así cada recurso actual debe conservar su hash inmutable.
        prefix = project.get("content_prefix", "")
        reviewed_relatives = {item["relative"] for item in proof["sources"].values()}
        for relative in project.get("assets", {}):
            virtual = relative if project.get("data_urls") or not prefix else f"{prefix}/{relative}"
            if virtual not in reviewed_relatives and not isinstance(resolve_project(root, virtual), (bytes, Path)):
                return None
        expected_relatives = set()
        for label, source in proof["sources"].items():
            relative = _relative(source["relative"])
            expected_relatives.add(relative)
            actual = _hash_value(resolve_project(root, relative))
            if actual is None and source.get("retained") is True:
                path = _safe(root, relative)
                actual = _file_hash(path) if path.is_file() else None
            if actual != proof["files"][label]:
                return None
        content_relative = proof["content_relative"]
        content = root if content_relative == "." else _safe(root, content_relative)
        # Detect new relevant files as the legacy gate would. Only metadata
        # created by this migration is exempt; content changes need review.
        current = _legacy_content_files(root, content)
        allowed_new = {"project.json", NAME}
        if project.get("timeline"):
            prefix = project.get("content_prefix", "")
            allowed_new.add(f"{prefix}/{project['timeline']}" if prefix else project["timeline"])
        for label in current:
            path = root / label[len("@output/"):] if label.startswith("@output/") else content / label
            relative = path.relative_to(root).as_posix()
            if relative not in expected_relatives and relative not in allowed_new:
                return None
        return dict(proof["files"])
    except (OSError, ValueError, KeyError, TypeError):
        return None


def compatible_thumbnail_manifest(root: Path, draft: dict) -> dict[str, Any] | None:
    """Retain existing thumbnail choices/cache identity across exact relocation."""
    proof = _proof(root)
    if proof is None or _fields_hash(draft) != proof.get("draft_fields_sha256"):
        return None
    if compatible_legacy_files(root) is None:
        return None
    thumbnails = draft.get("thumbnails")
    return thumbnails if isinstance(thumbnails, dict) else None
