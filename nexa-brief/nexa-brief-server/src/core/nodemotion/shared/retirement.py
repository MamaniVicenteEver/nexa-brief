"""Guarded retirement of verified legacy NodeMotion code and media duplicates.

The migration first publishes and verifies project.json. This second phase
reconciles exact operational references, then removes only enumerated files
whose original hash and replacement are still verified. The journal contains
hashes and paths, never a backup of content. Rendered outputs are never retired.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import stat
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

from src.adapters.data.section_store import Section
from src.config.settings import settings
from src.core.nodemotion.shared.execution import load_project, resolve_project
from src.core.nodemotion.shared.resources import digest, _transcription_path, with_library_resolution_snapshot

_SECTIONS = ("resources", "videos", "jobs", "schedule", "publicaciones")
_OUTPUT_FIELDS = {"youtube_video_path", "reels_video_path", "tiktok_video_path", "thumbnail_path"}
_OUTPUT_NAMES = {"video.mp4", "youtube_video.mp4", "reels_video.mp4", "tiktok_video.mp4", "thumbnail.jpg"}
_PROTECTED_PARTS = {"logs", "work", "thumbnails", "results", "renders", "render", "output"}
_PATH_FIELDS = {"storage_key", "path", "file", "src", "config", "audio", "image", "video"}


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json_sha(data: bytes) -> str:
    return _sha(json.dumps(json.loads(data), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())


def _relative(value: str) -> str:
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        raise ValueError("Invalid retirement relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in value.split("/")):
        raise ValueError("Invalid retirement relative path")
    return path.as_posix()


def _safe(root: Path, path: Path, *, allow_root: bool = False) -> Path:
    if not path.is_absolute() or ".." in path.parts or not path.is_relative_to(root):
        raise ValueError("Retirement path is outside its selected root")
    if path == root and not allow_root:
        raise ValueError("Retirement cannot target a root directory")
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError("Retirement path traverses a symlink")
        if part == root:
            break
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Retirement path escapes its selected root")
    return path


def _scope(profile: Path, root: Path) -> tuple[Path, Path]:
    if not profile.is_absolute() or not root.is_absolute():
        raise ValueError("Profile and project must be absolute paths")
    if Path(settings.storage_profile_dir or "").resolve() != profile.resolve() or settings.storage_layout_version != 3:
        raise ValueError("Retirement requires the explicitly selected v3 profile")
    _safe(profile, root)
    if not any(root.is_relative_to(profile / name / "nodemotion") and root != profile / name / "nodemotion"
               for name in ("productions", "sandbox")):
        raise ValueError("Retirement is limited to NodeMotion projects")
    if not profile.is_dir() or not root.is_dir():
        raise ValueError("Missing retirement profile or project")
    return profile, root


def journal_path(profile: Path, root: Path) -> Path:
    profile, root = _scope(profile, root)
    key = _sha(root.relative_to(profile).as_posix().encode())
    path = profile / ".system/runtime/nodemotion/migrations" / f"{key}.json"
    return _safe(profile, path)


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _safe(Path(value["profile"]), path)
    fd, temporary = tempfile.mkstemp(prefix=".retirement-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        Path(temporary).unlink(missing_ok=True)


def _value_bytes(value: bytes | Path | None) -> bytes:
    if isinstance(value, bytes):
        return value
    if isinstance(value, Path) and value.is_file():
        return value.read_bytes()
    raise ValueError("Replacement is unavailable")


def _path_strings(value: Any, *, output: bool = False) -> set[str]:
    result: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            is_output = output or key in _OUTPUT_FIELDS or key in {"file_paths", "format_paths"}
            if is_output and isinstance(item, str):
                result.add(item)
            elif isinstance(item, (dict, list)):
                result.update(_path_strings(item, output=is_output))
    elif isinstance(value, list):
        for item in value:
            result.update(_path_strings(item, output=output))
    return result


def _ensure_not_busy(root: Path, draft_id: str) -> None:
    data = Section("videos").read()
    for row in data.get("collections", {}).get("drafts", []):
        if row.get("draft_id") == draft_id and row.get("status") in {"previewing", "preparing", "rendering"}:
            raise ValueError("Project has an active draft operation")
    # Unrelated operations in the same section are preserved by locked mutations.


def _protected_outputs(profile: Path) -> set[Path]:
    protected: set[Path] = set()
    for section in ("videos", "jobs", "schedule", "publicaciones"):
        for value in _path_strings(Section(section).read()):
            path = Path(value)
            if not path.is_absolute():
                path = profile / path
            protected.add(path)
    return protected


def _entry(root: Path, path: Path, virtual: str, category: str) -> dict[str, Any]:
    _safe(root, path)
    relative = path.relative_to(root).as_posix()
    _relative(relative)
    if any(part in _PROTECTED_PARTS for part in Path(relative).parts) or (path.parent == root and path.name in _OUTPUT_NAMES):
        raise ValueError(f"Protected output or history file cannot be retired: {relative}")
    if not path.is_file():
        raise ValueError(f"Retirement source is missing: {relative}")
    resolved = resolve_project(root, virtual)
    original = path.read_bytes() if category in {"document", "lyrics"} else None
    target = _value_bytes(resolved) if category in {"document", "lyrics"} else None
    expected = digest(path)
    if category == "lyrics":
        equivalent = _json_sha(original) == _json_sha(target)
    elif category == "document":
        equivalent = original == target
    else:
        equivalent = isinstance(resolved, Path) and digest(resolved) == expected
    if not equivalent:
        raise ValueError(f"Replacement differs before retirement: {relative}")
    result = {"relative": relative, "virtual": virtual, "category": category,
              "sha256": expected, "status": "pending"}
    if isinstance(resolved, Path):
        result["replacement_path"] = str(resolved)
        result["replacement_sha256"] = digest(resolved)
    else:
        result["replacement_sha256"] = _sha(target)
    if category == "lyrics":
        result["json_sha256"] = _json_sha(original)
    return result


@with_library_resolution_snapshot
def _plan(profile: Path, root: Path, draft_id: str, code: dict[str, Path], media: dict[str, Path]) -> dict[str, Any]:
    profile, root = _scope(profile, root)
    project = load_project(root)
    if project is None or project["engine"]["policy"] != "pinned":
        raise ValueError("Retirement requires a verified pinned project manifest")
    _ensure_not_busy(root, draft_id)
    prefix = project.get("content_prefix", "")
    if prefix:
        _relative(prefix)
    native = project.get("data_urls")
    protected = _protected_outputs(profile)
    entries = [_entry(root, root / "index.html", "index.html", "document")]
    for category, sources in (("code", code), ("media", media)):
        for virtual, source in sorted(sources.items()):
            _relative(virtual)
            relative = virtual if native or not prefix else f"{prefix}/{virtual}"
            expected_path = root / relative
            if source != expected_path:
                raise ValueError("Inventory source differs from its declared project path")
            if source in protected:
                raise ValueError(f"Registered rendered output cannot be retired: {relative}")
            entry = _entry(root, source, relative, category)
            if category == "media":
                target = Path(entry["replacement_path"])
                _safe(profile, target)
                if not target.is_relative_to(profile / "resources"):
                    raise ValueError("Retired media must have a durable same-profile resource replacement")
            entries.append(entry)
    timing_relative = native["timing"] if native else (f"{prefix}/lyrics.json" if prefix else "lyrics.json")
    lyrics = root / _relative(timing_relative)
    lyric_entry = _entry(root, lyrics, timing_relative, "lyrics")
    if "replacement_path" not in lyric_entry:
        ref = project.get("transcription")
        if not isinstance(ref, dict) or ref.get("storage") != "shared":
            raise ValueError("Retired lyrics must have a durable shared transcription")
        lyric_entry["replacement_path"] = str(_transcription_path(ref["sha256"]))
    entries.append(lyric_entry)
    if len({item["relative"] for item in entries}) != len(entries):
        raise ValueError("Duplicate retirement inventory path")
    retained = {}
    config_relative = native["config"] if native else (f"{prefix}/config.json" if prefix else "config.json")
    for relative in ("project.json", config_relative,
                     f"{prefix}/timeline.json" if prefix else "timeline.json", "appearance.json",
                     ".nodemotion-review-compatibility.json", *project.get("extra_data_urls", [])):
        path = root / relative
        _safe(root, path)
        if path.is_file():
            retained[relative] = digest(path)
    return {"schema_version": 1, "kind": "nodemotion-retirement", "profile": str(profile), "root": str(root),
            "draft_id": draft_id, "design_id": project["design_id"], "engine_revision": project["engine"]["revision"],
            "state": "planned", "retained": retained, "entries": entries,
            "updated_sections": [], "reference_updates": 0}


@with_library_resolution_snapshot
def _validate(plan: dict[str, Any], *, allow_missing: bool) -> tuple[Path, Path]:
    if plan.get("schema_version") != 1 or plan.get("kind") != "nodemotion-retirement":
        raise ValueError("Invalid retirement journal")
    profile, root = _scope(Path(plan["profile"]), Path(plan["root"]))
    _ensure_not_busy(root, plan["draft_id"])
    project = load_project(root)
    if (project is None or project.get("design_id") != plan["design_id"] or
            project.get("engine") != {"policy": "pinned", "revision": plan["engine_revision"]}):
        raise ValueError("Project engine changed after retirement was planned")
    for relative, expected in plan["retained"].items():
        path = _safe(root, root / _relative(relative))
        if not path.is_file() or digest(path) != expected:
            raise ValueError(f"Retained project data changed: {relative}")
    protected = _protected_outputs(profile)
    for item in plan["entries"]:
        relative = _relative(item["relative"])
        if relative in plan["retained"] or item.get("virtual") != relative:
            raise ValueError("Retirement inventory conflicts with retained or virtual data")
        category = item.get("category")
        prefix = project.get("content_prefix", "")
        native = project.get("data_urls")
        local = relative if native else (relative[len(prefix) + 1:] if prefix and relative.startswith(prefix + "/") else relative)
        if category not in {"document", "code", "media", "lyrics"}:
            raise ValueError("Invalid retirement category")
        if category == "document" and relative != "index.html":
            raise ValueError("Invalid retirement document path")
        timing_relative = native["timing"] if native else (f"{prefix}/lyrics.json" if prefix else "lyrics.json")
        if category == "lyrics" and relative != timing_relative:
            raise ValueError("Invalid retirement timing path")
        if category == "code" and Path(local).suffix.lower() not in {".js", ".css", ".html", ".woff", ".woff2", ".ttf", ".otf", ".svg"}:
            raise ValueError("Invalid retirement runtime support path")
        if category == "media" and local not in project["assets"]:
            raise ValueError("Retirement media is not an explicit project reference")
        if category != "lyrics" and item["sha256"] != item["replacement_sha256"]:
            raise ValueError("Retirement hashes do not identify the same bytes")
        path = _safe(root, root / relative)
        if path in protected or any(part in _PROTECTED_PARTS for part in Path(relative).parts) or (path.parent == root and path.name in _OUTPUT_NAMES):
            raise ValueError(f"Protected output cannot be retired: {relative}")
        if path.exists():
            if not path.is_file() or digest(path) != item["sha256"]:
                raise ValueError(f"Retirement source changed: {relative}")
        elif not allow_missing or plan["state"] not in {"references-updated", "retiring", "complete"}:
            raise ValueError(f"Retirement source disappeared before authorized deletion: {relative}")
        resolved = resolve_project(root, item["virtual"])
        if item["category"] == "lyrics":
            if _json_sha(_value_bytes(resolved)) != item["json_sha256"]:
                raise ValueError(f"Retirement timeline replacement changed: {relative}")
        elif isinstance(resolved, Path):
            if str(resolved) != item.get("replacement_path") or digest(resolved) != item["replacement_sha256"]:
                raise ValueError(f"Retirement resource replacement changed: {relative}")
        elif _sha(_value_bytes(resolved)) != item["replacement_sha256"]:
            raise ValueError(f"Retirement document replacement changed: {relative}")
    return profile, root


def _replacements(plan: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    profile, root = Path(plan["profile"]), Path(plan["root"])
    absolute, relative = {}, {}
    for item in plan["entries"]:
        # HTML and JS remain virtual project URLs; only media/timing paths have
        # profile-confined persistent replacements for registry consumers.
        if item["category"] not in {"media", "lyrics"}:
            continue
        source = root / item["relative"]
        target = Path(item["replacement_path"])
        _safe(profile, target)
        absolute[str(source)] = str(target)
        relative[source.relative_to(profile).as_posix()] = target.relative_to(profile).as_posix()
    return absolute, relative


def _rewrite(value: Any, replacements: dict[str, str], *, path_context: bool = False) -> int:
    count = 0
    if isinstance(value, dict):
        for key, item in list(value.items()):
            context = path_context or key in {"file_paths", "format_paths"}
            is_path = context or key in _PATH_FIELDS or key.endswith(("_path", "_dir"))
            if is_path and isinstance(item, str) and item in replacements:
                value[key] = replacements[item]
                count += 1
            elif isinstance(item, (dict, list)):
                count += _rewrite(item, replacements, path_context=context)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            if path_context and isinstance(item, str) and item in replacements:
                value[index] = replacements[item]
                count += 1
            elif isinstance(item, (dict, list)):
                count += _rewrite(item, replacements, path_context=path_context)
    return count


def _reconcile_section(name: str, plan: dict[str, Any]) -> int:
    absolute, relative = _replacements(plan)
    replacements = {**absolute, **relative}
    root = Path(plan["root"])
    def mutate(section):
        count = _rewrite(section, replacements)
        if name == "videos":
            jobs = section.get("documents", {}).get("draft_jobs", {})
            for job in jobs.values():
                artifacts = job.get("artifacts") if isinstance(job, dict) else None
                if not isinstance(artifacts, dict) or artifacts.get("output_dir") != str(root):
                    continue
                for field in ("lyrics_json", "html_path"):
                    if artifacts.get(field) is not None:
                        artifacts[field] = None
                        count += 1
                inputs = job.get("input")
                if isinstance(inputs, dict) and inputs.get("promo_timeline") is not None:
                    inputs["promo_timeline"] = None
                    count += 1
                artifacts["assets_dir"] = str(root / load_project(root).get("content_prefix", ""))
        if name == "resources":
            aliases = section.setdefault("documents", {}).setdefault("legacy_path_aliases", {})
            for source, target in replacements.items():
                key = _sha(source.encode())
                target_path = Path(target)
                if target_path.is_absolute():
                    target = target_path.relative_to(Path(plan["profile"])).as_posix()
                replacement = {"legacy_key": source, "storage_key": target,
                               "sha256": digest(Path(plan["profile"]) / target), "migration": "nodemotion-retirement-v1"}
                old = aliases.get(key)
                if old is not None and (not isinstance(old, dict) or old.get("legacy_key") != source):
                    raise ValueError("Conflicting legacy path alias")
                if old != replacement:
                    aliases[key] = replacement
                    count += 1
        return count
    return Section(name).mutate(mutate)


def _unlink_verified(root: Path, relative: str, expected: str) -> bool:
    """Hash and unlink through anchored descriptors; never traverse a new link."""
    parts = PurePosixPath(_relative(relative)).parts
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    descriptors: list[int] = []
    source_fd = None
    try:
        parent = os.open(root, directory_flags)
        descriptors.append(parent)
        for name in parts[:-1]:
            parent = os.open(name, directory_flags, dir_fd=parent)
            descriptors.append(parent)
        try:
            source_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        except FileNotFoundError:
            return False
        before = os.fstat(source_fd)
        if not stat.S_ISREG(before.st_mode):
            raise ValueError("Retirement source is no longer a regular file")
        def signature(value):
            return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns)
        content = hashlib.sha256()
        for chunk in iter(lambda: os.read(source_fd, 1024 * 1024), b""):
            content.update(chunk)
        after = os.fstat(source_fd)
        named = os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)
        if (signature(before) != signature(after) or signature(after) != signature(named)
                or not stat.S_ISREG(named.st_mode) or content.hexdigest() != expected):
            raise ValueError("Retirement source changed immediately before unlink")
        os.unlink(parts[-1], dir_fd=parent)
        os.fsync(parent)
        return True
    except FileNotFoundError:
        return False
    finally:
        if source_fd is not None:
            os.close(source_fd)
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def _run(plan: dict[str, Any], *, apply: bool) -> dict[str, Any]:
    profile, root = _validate(plan, allow_missing=True)
    path = journal_path(profile, root)
    if not apply:
        return {**plan, "mode": "dry-run", "planned_files": len(plan["entries"]),
                "planned_bytes": sum((root / entry["relative"]).stat().st_size for entry in plan["entries"]
                                     if (root / entry["relative"]).is_file())}
    path.parent.mkdir(parents=True, exist_ok=True)
    _safe(profile, path.parent)
    lock_path = path.with_suffix(".lock")
    _safe(profile, lock_path)
    with lock_path.open("a+b") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        if path.is_file():
            current = json.loads(path.read_text(encoding="utf-8"))
            if current["root"] != plan["root"] or current["retained"] != plan["retained"]:
                raise ValueError("Conflicting existing retirement journal")
            plan = current
        else:
            _atomic_json(path, plan)
        _validate(plan, allow_missing=True)
        for section in _SECTIONS:
            if section not in plan["updated_sections"]:
                plan["reference_updates"] += _reconcile_section(section, plan)
                plan["updated_sections"].append(section)
                _atomic_json(path, plan)
        plan["state"] = "references-updated"
        _atomic_json(path, plan)
        _validate(plan, allow_missing=True)
        plan["state"] = "retiring"
        _atomic_json(path, plan)
        for entry in plan["entries"]:
            _safe(root, root / _relative(entry["relative"]))
            _unlink_verified(root, entry["relative"], entry["sha256"])
            entry["status"] = "retired"
            _atomic_json(path, plan)
        plan["state"] = "complete"
        _atomic_json(path, plan)
        return {**plan, "mode": "apply", "retired_files": len(plan["entries"]), "journal": str(path)}


def resume_retirement(profile: Path, root: Path, *, apply: bool = False) -> dict[str, Any] | None:
    path = journal_path(profile, root)
    if not path.is_file():
        return None
    plan = json.loads(path.read_text(encoding="utf-8"))
    if plan.get("profile") != str(profile) or plan.get("root") != str(root):
        raise ValueError("Retirement journal belongs to another project")
    return _run(plan, apply=apply)


def retire_project(profile: Path, root: Path, *, draft_id: str, code: dict[str, Path],
                   media: dict[str, Path], apply: bool = False) -> dict[str, Any]:
    """Read-only plan by default; apply only an already verified pinned project."""
    resumed = resume_retirement(profile, root, apply=apply)
    if resumed is not None:
        return resumed
    return _run(_plan(profile, root, draft_id, code, media), apply=apply)
