"""Discover successful jobs and explicit CLI completion events for host backup.

No media is copied here. `discover` returns specs and errors; caller retries errors.
Only CLI events written after a full successful *direct* kit render are accepted.
"""

from __future__ import annotations
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,160}$")
FORMATS = {"16x9", "9x16"}
SKIP_DIRS = {
    "work",
    "render",
    "__pycache__",
    "node_modules",
    ".git",
    ".cache",
    "results",
    "preview",
    "capture-attempt",
    "captured-frames",
    "frames",
    "cache",
    ".venv",
    "venv",
    "accounts",
    "connections",
}
SKIP_EXT = {".pyc", ".tmp", ".log"}


def _stamp(value):
    if not isinstance(value, str):
        raise ValueError("missing timestamp")
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("timestamp requires timezone")
    return dt.astimezone(timezone.utc)


def _safe_id(value):
    if not isinstance(value, str) or not SAFE_ID.fullmatch(value):
        raise ValueError("invalid job/event/video ID")
    return value


def _within(path, root):
    root = Path(root).resolve()
    path = Path(path).resolve(strict=True)
    if not path.is_relative_to(root):
        raise ValueError("path escapes authorized root")
    if not path.is_file():
        raise ValueError("not a regular file")
    return path


def _map_output(path, output_root):
    """Accept exactly host output root or /app/output; reject other historic paths."""
    value = str(path)
    prefix = "/app/output/"
    if value.startswith(prefix):
        path = Path(output_root) / value[len(prefix) :]
    else:
        path = Path(value)
        if not path.is_absolute():
            raise ValueError("output path must be absolute")
    return _within(path, output_root)


def _walk_files(root):
    if not root.is_dir():
        return
    root = root.resolve(strict=True)
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(
            d
            for d in dirs
            if d not in SKIP_DIRS
            and not d.startswith(("work-", "capture-attempt-"))
            and not (Path(current) / d).is_symlink()
        )
        for name in sorted(files):
            p = Path(current) / name
            if (
                p.is_symlink()
                or p.suffix.lower() in SKIP_EXT | {".pem", ".key", ".p12", ".pfx"}
                or name.startswith("frame_")
                or name.startswith(".")
            ):
                continue
            if (
                name in {"accounts.json", "users.json"}
                or name.startswith(("client_secret", ".env"))
                or "token" in name.lower()
            ):
                continue
            yield _within(p, root)


def _video_directories(templates_root):
    """Search production manifests only; never walk kit, sandbox, assets, work or renders."""
    root = Path(templates_root).resolve()
    if not root.is_dir():
        return {}
    found = {}
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(
            d
            for d in dirs
            if d not in SKIP_DIRS | {"sandbox", "_tools", "assets"}
            and not d.startswith(".")
            and not (Path(current) / d).is_symlink()
        )
        if "manifest.json" not in files:
            continue
        p = Path(current) / "manifest.json"
        try:
            data = json.loads(_within(p, root).read_text(encoding="utf-8"))
            video_id = data.get("video_id")
            if isinstance(video_id, str) and SAFE_ID.fullmatch(video_id):
                found.setdefault(video_id, []).append(Path(current).resolve())
        except (ValueError, OSError, json.JSONDecodeError):
            continue
    return found


def _add_file(files, path, target):
    if path.is_file():
        st = path.stat()
        files[str(path)] = {
            "source": str(path),
            "target": target,
            "expected_size": st.st_size,
            "expected_mtime_ns": st.st_mtime_ns,
        }


def _source_bundle(files, video_dir, templates_root, design=None, *, kit_root=None):
    root = Path(templates_root).resolve()
    if not video_dir.resolve().is_relative_to(root) or any(
        x in {"sandbox", "_tools"} for x in video_dir.relative_to(root).parts
    ):
        raise ValueError("template outside production")
    video_target = "project/templates/" + video_dir.relative_to(root).as_posix()
    for name in (
        "index.html",
        "PLAN.md",
        "manifest.json",
        "publish.json",
        "info.json",
        "CREDITS.md",
        "usage.json",
    ):
        p = video_dir / name
        if p.exists():
            _add_file(files, _within(p, root), video_target + "/" + name)
    for p in _walk_files(video_dir / "assets"):
        _add_file(
            files,
            _within(p, root),
            video_target + "/assets/" + p.relative_to(video_dir / "assets").as_posix(),
        )
    # The shared kit is preserved with its relative structure. Selected subtrees
    # contain engine, design components and dependencies; exclude tests/work/cache.
    kit_owner = Path(kit_root).resolve() if kit_root is not None else root
    kit = kit_owner / "_tools" / "explainer-kit"
    for sub in ("engine", "designs", "component-library", "vendor", "outro"):
        for p in _walk_files(kit / sub):
            _add_file(
                files,
                _within(p, kit_owner),
                "project/templates/_tools/explainer-kit/"
                + p.relative_to(kit).as_posix(),
            )
    for name in (
        "brands.json",
        "catalog.json",
        "component-library.json",
        "lengths.json",
    ):
        p = kit / name
        if p.exists():
            _add_file(
                files,
                _within(p, kit_owner),
                "project/templates/_tools/explainer-kit/" + name,
            )


def _fingerprint(files):
    values = []
    for item in sorted(files.values(), key=lambda x: (x["target"], x["source"])):
        values.append(
            [
                item["target"],
                item["source"],
                item["expected_size"],
                item["expected_mtime_ns"],
            ]
        )
    return hashlib.sha256(
        json.dumps(values, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


def _finish(job_id, files, metadata):
    if not files:
        raise ValueError("empty fileset")
    targets = [i["target"] for i in files.values()]
    if len(targets) != len(set(targets)):
        raise ValueError("duplicate target")
    metadata["fingerprint"] = _fingerprint(files)
    return {
        "job_id": _safe_id(job_id),
        "metadata": metadata,
        "files": sorted(files.values(), key=lambda x: x["target"]),
    }


def _profile_job_spec(record, output_root, templates_root, video_index, production_root):
    """Bundle a profile production and its separately stored rendered videos."""
    job_id = _safe_id(record.get("job_id"))
    production_root = Path(production_root).resolve()
    profile = production_root.parent
    render_root = Path(output_root).resolve()
    if render_root != (profile / "renders").resolve():
        raise ValueError("render root does not belong to selected profile")
    raw_dir = Path(record.get("output_dir") or "")
    if not raw_dir.is_absolute() or ".." in raw_dir.parts or not raw_dir.is_relative_to(production_root):
        raise ValueError("invalid production directory")
    current = production_root
    for part in raw_dir.relative_to(production_root).parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("symlink in production directory")
    host_dir = raw_dir.resolve(strict=True)
    if not host_dir.is_relative_to(production_root) or not host_dir.is_dir():
        raise ValueError("invalid production directory")
    relative = host_dir.relative_to(production_root)
    if len(relative.parts) < 2:
        raise ValueError("invalid production directory")
    video_id = record.get("video_id")
    identity = _safe_id(video_id) if record.get("source") == "explainer" else job_id
    if relative.name != identity:
        raise ValueError("production does not belong to job")
    if record.get("source") == "explainer" and video_index.get(identity) != [host_dir]:
        raise ValueError("missing or ambiguous explainer production source")

    files = {}
    expected_v3 = render_root / "videos" / relative.parts[0] / identity
    expected_v2 = render_root / identity

    def reject_links(path, root):
        path, root = Path(path), Path(root)
        if not path.is_absolute() or not path.is_relative_to(root):
            raise ValueError("path outside selected root")
        current = root
        for part in path.relative_to(root).parts:
            current = current / part
            if current.is_symlink():
                raise ValueError("symlink in job path")

    def map_media(value):
        raw = Path(render_root / value[len("/app/output/"):] if value.startswith("/app/output/") else value)
        reject_links(raw, render_root)
        path = _map_output(value, render_root)
        if not (path.is_relative_to(expected_v3) or path.is_relative_to(expected_v2)):
            raise ValueError("video outside job renders")
        if path.suffix.lower() != ".mp4" or path.stat().st_size == 0:
            raise ValueError("invalid video")
        if any(part.startswith("preview-") for part in path.relative_to(render_root).parts):
            raise ValueError("preview is not a completed render")
        target = "output/" + path.relative_to(render_root).as_posix()
        _add_file(files, path, target)
        return target

    def logical_paths(raw):
        if not isinstance(raw, dict):
            return {}
        result = {}
        for key, value in raw.items():
            if not isinstance(value, str):
                continue
            if key in ("16x9", "9x16", "youtube", "reels", "tiktok", "instagram"):
                result[key] = map_media(value)
            elif key == "thumbnail":
                path = Path(value)
                if not path.is_absolute() or ".." in path.parts:
                    raise ValueError("invalid thumbnail")
                reject_links(path, production_root)
                path = _within(path, production_root)
                if not path.is_relative_to(host_dir):
                    raise ValueError("thumbnail outside production")
                target = "output/" + path.relative_to(host_dir).as_posix()
                _add_file(files, path, target)
                result[key] = target
        return result

    format_paths = logical_paths(record.get("format_paths"))
    file_paths = logical_paths(record.get("file_paths"))
    if not format_paths and not any(key != "thumbnail" for key in file_paths):
        raise ValueError("no video paths")
    for name in ("index.html", "manifest.json", "publish.json", "PLAN.md"):
        path = host_dir / name
        if path.is_file() and not path.is_symlink():
            _add_file(files, _within(path, production_root), "output/" + name)
    for path in _walk_files(host_dir / "assets"):
        _add_file(files, _within(path, production_root), "output/assets/" + path.relative_to(host_dir / "assets").as_posix())
    manifest_path = host_dir / "manifest.json"
    if manifest_path.is_file() and not manifest_path.is_symlink():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        formats = manifest.get("video_formats") or []
        declared = {entry.get("output_filename"): entry for entry in formats if isinstance(entry, dict)}
        for value in manifest.get("files") or {}:
            part = PurePosixPath(value)
            if part.is_absolute() or not part.parts or any(x in ("..", "work", "render", "logs") for x in part.parts):
                raise ValueError("invalid manifest file path")
            if value in declared:
                entry = declared[value]
                orientation = {"16:9": "16x9", "9:16": "9x16"}.get(entry.get("aspect_ratio"))
                if entry.get("id") not in file_paths and orientation not in format_paths:
                    raise ValueError("missing declared video format")
                continue  # Actual renders are validated and recorded from job paths above.
            candidates = (host_dir / Path(*part.parts), host_dir / "assets" / Path(*part.parts))
            path = next((p for p in candidates if p.is_file() and not p.is_symlink()), None)
            if path is None:
                raise ValueError("missing manifest dependency")
            path = _within(path, production_root)
            if not path.is_relative_to(host_dir):
                raise ValueError("manifest file outside production")
            _add_file(files, path, "output/" + path.relative_to(host_dir).as_posix())
        for name in ("image", "music", "background_video"):
            entry = manifest.get(name)
            if not isinstance(entry, dict) or not entry.get("path"):
                continue
            rel = PurePosixPath(entry["path"])
            if rel.is_absolute() or len(rel.parts) < 3 or ".." in rel.parts or not (
                rel.parts[:2] == ("data", "library") or rel.parts[0] == "resources" and rel.parts[1] in {"images", "music", "sounds", "videos"}
            ):
                raise ValueError("invalid library asset path")
            if any(part.startswith(".") or part.lower() in {"accounts.json", "users.json"} or part.lower().startswith("client_secret") or "token" in part.lower() for part in rel.parts):
                raise ValueError("private library asset path")
            reject_links(profile.joinpath(*rel.parts), profile / rel.parts[0])
            path = _within(profile.joinpath(*rel.parts), profile / rel.parts[0])
            _add_file(files, path, "project/profile/" + rel.as_posix())
    if record.get("source") == "explainer":
        _source_bundle(files, host_dir, production_root, record.get("design"), kit_root=templates_root)
        thumbnail = (record.get("file_paths") or {}).get("thumbnail")
        if isinstance(thumbnail, str):
            resolved = _within(thumbnail, production_root)
            file_paths["thumbnail"] = files[str(resolved)]["target"]
    return _finish(job_id, files, {
        "kind": "job", "source": record.get("source") or "pipeline",
        "category": record.get("category"), "video_id": video_id, "design": record.get("design"),
        "title": record.get("title"), "created_at": record.get("created_at"),
        "duration_seconds": record.get("duration_seconds"),
        "file_paths": file_paths, "format_paths": format_paths,
    })


def job_spec(record, output_root, templates_root, video_index, production_root=None):
    if production_root:
        raw_dir = Path(record.get("output_dir") or "")
        if raw_dir.is_absolute() and raw_dir.resolve().is_relative_to(Path(production_root).resolve()):
            return _profile_job_spec(record, output_root, templates_root, video_index, production_root)
    job_id = _safe_id(record.get("job_id"))
    raw_paths = record.get("format_paths") or record.get("file_paths") or {}
    if not isinstance(raw_paths, dict):
        raise ValueError("invalid file paths")
    media = [
        v
        for k, v in raw_paths.items()
        if k in ("16x9", "9x16", "youtube", "reels", "tiktok", "instagram")
        and isinstance(v, str)
    ]
    if not media:
        raise ValueError("no video paths")
    mapped = [_map_output(p, output_root) for p in media]
    if any(p.suffix.lower() != ".mp4" or p.stat().st_size == 0 for p in mapped):
        raise ValueError("invalid video")
    out_dir = Path(record.get("output_dir") or "").as_posix()
    host_dir = (
        Path(output_root) / out_dir[len("/app/output/") :]
        if out_dir.startswith("/app/output/")
        else Path(out_dir)
    )
    host_dir = host_dir.resolve(strict=True)
    if (
        not host_dir.is_relative_to(Path(output_root).resolve())
        or not host_dir.is_dir()
    ):
        raise ValueError("invalid output directory")
    files = {}
    for p in sorted(set(mapped)):
        if not p.is_relative_to(host_dir):
            raise ValueError("video outside job output")
        _add_file(files, p, "output/" + p.relative_to(host_dir).as_posix())
    # Necessary flat output assets, metadata and thumbnail, never arbitrary recursive work.
    allowed_names = {
        "index.html",
        "manifest.json",
        "config.json",
        "lyrics.json",
        "song.mp3",
        "bg.jpg",
        "bg.png",
        "bg.webp",
        "bg.mp4",
        "thumbnail.jpg",
        "thumbnail-9x16.jpg",
    }
    for name in sorted(allowed_names):
        p = host_dir / name
        if p.is_file() and not p.is_symlink():
            _add_file(files, _within(p, output_root), "output/" + name)
    # Include files named by the pipeline manifest, plus the actual source assets
    # it references from the active profile library. Never read credential files.
    manifest_path = host_dir / "manifest.json"
    if manifest_path.is_file() and not manifest_path.is_symlink():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for rel in manifest.get("files") or {}:
            part = PurePosixPath(rel)
            if (
                part.is_absolute()
                or not part.parts
                or any(x in ("..", "work", "render", "logs") for x in part.parts)
            ):
                raise ValueError("invalid manifest file path")
            p = _within(host_dir / Path(*part.parts), output_root)
            if not p.is_relative_to(host_dir):
                raise ValueError("manifest file outside job output")
            _add_file(files, p, "output/" + part.as_posix())
        data_root = Path(output_root).resolve().parent / "data"
        for name in ("image", "music", "background_video"):
            entry = manifest.get(name)
            if not isinstance(entry, dict) or not entry.get("path"):
                continue
            rel = PurePosixPath(entry["path"])
            if (
                rel.is_absolute()
                or not rel.parts
                or rel.parts[0] != "data"
                or ".." in rel.parts
            ):
                raise ValueError("invalid library asset path")
            p = _within(data_root / Path(*rel.parts[1:]), data_root)
            _add_file(files, p, "project/profile/" + rel.as_posix())
    for p in _walk_files(host_dir / "assets"):
        _add_file(
            files,
            _within(p, output_root),
            "output/assets/" + p.relative_to(host_dir / "assets").as_posix(),
        )
    thumbnail = (record.get("file_paths") or {}).get("thumbnail")
    if thumbnail:
        p = _map_output(thumbnail, output_root)
        if not p.is_relative_to(host_dir):
            raise ValueError("thumbnail outside job output")
        _add_file(files, p, "output/" + p.relative_to(host_dir).as_posix())
    summary = host_dir / "logs" / "08_resumen_final.json"
    if summary.is_file() and not summary.is_symlink():
        _add_file(
            files, _within(summary, output_root), "output/logs/08_resumen_final.json"
        )
    video_id = record.get("video_id")
    if record.get("source") == "explainer":
        _safe_id(video_id)
        dirs = video_index.get(video_id, [])
        if len(dirs) != 1:
            raise ValueError("missing or ambiguous explainer production source")
        _source_bundle(files, dirs[0], production_root or templates_root, record.get("design"),
                       kit_root=templates_root if production_root else None)

    # Keep a restorable, non-secret subset of the library entry. Paths point
    # into the bundle rather than the host/container they were discovered on.
    def logical_paths(raw):
        result = {}
        if not isinstance(raw, dict):
            return result
        for key, value in raw.items():
            if key not in (
                "16x9",
                "9x16",
                "youtube",
                "reels",
                "tiktok",
                "instagram",
                "thumbnail",
            ) or not isinstance(value, str):
                continue
            p = _map_output(value, output_root)
            if not p.is_relative_to(host_dir):
                raise ValueError("library path outside output")
            result[key] = "output/" + p.relative_to(host_dir).as_posix()
        return result

    meta = {
        "kind": "job",
        "source": record.get("source") or "pipeline",
        "category": record.get("category"),
        "video_id": video_id,
        "design": record.get("design"),
        "title": record.get("title"),
        "created_at": record.get("created_at"),
        "duration_seconds": record.get("duration_seconds"),
        "file_paths": logical_paths(record.get("file_paths")),
        "format_paths": logical_paths(record.get("format_paths")),
    }
    return _finish(job_id, files, meta)


def _cli_profile_spec(event, templates_root, profile_root):
    if profile_root is None:
        raise ValueError("profile root required for v2 event")
    profile = Path(profile_root).resolve()
    event_id = _safe_id(event.get("event_id"))
    video_id = _safe_id(event.get("video_id"))
    source_key = event.get("source_key")
    if not isinstance(source_key, str) or "\\" in source_key:
        raise ValueError("invalid production key")
    source = PurePosixPath(source_key)
    if len(source.parts) != 3 or source.parts[0] != "productions" or source.parts[-1] != video_id or any(
        part.startswith(".") or part == ".." for part in source.parts
    ):
        raise ValueError("invalid production key")
    if event_id != hashlib.sha256(source_key.encode()).hexdigest()[:32]:
        raise ValueError("event id does not match production key")
    source_root = profile / "productions"
    video_dir = profile.joinpath(*source.parts).resolve(strict=True)
    if not video_dir.is_relative_to(source_root.resolve()) or not video_dir.is_dir():
        raise ValueError("production directory not found")
    manifest = json.loads(_within(video_dir / "manifest.json", source_root).read_text(encoding="utf-8"))
    if manifest.get("video_id") != video_id:
        raise ValueError("video identity mismatch")
    formats, expected = event.get("formats"), event.get("outputs")
    if not isinstance(formats, list) or not formats or set(formats) - FORMATS:
        raise ValueError("invalid formats")
    if not isinstance(expected, dict) or set(expected) != set(formats):
        raise ValueError("missing output signatures")
    files = {}
    for fmt in set(formats):
        signature = expected[fmt]
        if not isinstance(signature, dict) or set(signature) != {"storage_key", "size", "mtime_ns"}:
            raise ValueError("invalid output signature")
        key = signature["storage_key"]
        if not isinstance(key, str) or "\\" in key:
            raise ValueError("invalid render key")
        parts = PurePosixPath(key).parts
        valid_v3 = (event.get("schema_version") == 3 and len(parts) == 6
                    and parts[:3] == ("renders", "videos", source.parts[1])
                    and parts[3] == video_id and parts[-1] == "video.mp4"
                    and parts[4].endswith("-" + fmt))
        valid_v2 = (event.get("schema_version") == 2 and len(parts) >= 4
                    and parts[0] == "renders" and parts[1] == video_id
                    and parts[-1] == f"{video_id}-{fmt}.mp4")
        if not (valid_v3 or valid_v2) or any(p.startswith(".") for p in parts):
            raise ValueError("invalid render key")
        render = _within(profile.joinpath(*parts), profile / "renders")
        st = render.stat()
        if st.st_size == 0 or signature["size"] != st.st_size or signature["mtime_ns"] != st.st_mtime_ns:
            raise ValueError("render changed since completion event")
        _add_file(files, render, "output/" + (f"{video_id}-{fmt}.mp4" if valid_v3 else render.name))
    _source_bundle(files, video_dir, source_root, manifest.get("design"), kit_root=templates_root)
    return _finish("cli-" + event_id, files, {"kind": "cli", "video_id": video_id,
        "event_id": event_id, "finished_at": event.get("finished_at"), "design": manifest.get("design")})


def cli_spec(event, templates_root, profile_root=None):
    if event.get("schema_version") in (2, 3):
        return _cli_profile_spec(event, templates_root, profile_root)
    if "schema_version" in event:
        raise ValueError("unsupported event schema")
    event_id = _safe_id(event.get("event_id"))
    video_id = _safe_id(event.get("video_id"))
    relative = PurePosixPath(event.get("template_relative", ""))
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in (".", "..", "sandbox", "_tools") for part in relative.parts)
    ):
        raise ValueError("invalid template path")
    identity = hashlib.sha256(relative.as_posix().encode()).hexdigest()[:32]
    if event_id != identity:
        raise ValueError("event id does not match template path")
    root = Path(templates_root).resolve()
    video_dir = (root / Path(*relative.parts)).resolve(strict=True)
    if not video_dir.is_relative_to(root) or not video_dir.is_dir():
        raise ValueError("template path outside root")
    manifest = json.loads(
        _within(video_dir / "manifest.json", root).read_text(encoding="utf-8")
    )
    if manifest.get("video_id") != video_id:
        raise ValueError("video identity mismatch")
    formats = event.get("formats")
    if not isinstance(formats, list) or not formats or set(formats) - FORMATS:
        raise ValueError("invalid formats")
    expected = event.get("outputs")
    if not isinstance(expected, dict) or set(expected) != set(formats):
        raise ValueError("missing output signatures")
    files = {}
    for fmt in set(formats):
        p = _within(video_dir / "render" / f"{video_id}-{fmt}.mp4", root)
        st = p.stat()
        if st.st_size == 0:
            raise ValueError("empty render")
        if expected[fmt] != {"size": st.st_size, "mtime_ns": st.st_mtime_ns}:
            raise ValueError("render changed since completion event")
        _add_file(files, p, "output/" + p.name)
    _source_bundle(files, video_dir, root, manifest.get("design"))
    return _finish(
        "cli-" + event_id,
        files,
        {
            "kind": "cli",
            "video_id": video_id,
            "event_id": event_id,
            "finished_at": event.get("finished_at"),
            "design": manifest.get("design"),
        },
    )


def discover(jobs_path, output_root, templates_root, activation, cli_events_dir=None, profile_root=None):
    """Return (specs, errors). No mutation; repeat after errors or app restart."""
    watermark = _stamp(activation) if isinstance(activation, str) else activation
    if watermark.tzinfo is None:
        raise ValueError("activation requires timezone")
    jobs_path = Path(jobs_path)
    records = (
        json.loads(jobs_path.read_text(encoding="utf-8")) if jobs_path.exists() else []
    )
    if isinstance(records, dict) and records.get("schema_version") == 1 and "collections" in records:
        records = records["collections"].get("jobs", [])
    if not isinstance(records, list):
        raise ValueError("jobs must be a JSON list or section")
    production_root = Path(profile_root) / "productions" if profile_root else None
    index = _video_directories(production_root or templates_root)
    specs = []
    errors = []
    for record in records:
        if not isinstance(record, dict) or record.get("stage") not in (
            "packaged",
            "published",
        ):
            continue
        try:
            if _stamp(record.get("updated_at")) < watermark:
                continue
            specs.append(job_spec(record, output_root, templates_root, index, production_root))
        except (ValueError, OSError, TypeError) as exc:
            errors.append(
                {"kind": "job", "id": str(record.get("job_id", "")), "error": str(exc)}
            )
    if cli_events_dir and Path(cli_events_dir).is_dir():
        for path in sorted(Path(cli_events_dir).glob("*.json")):
            if path.is_symlink():
                continue
            try:
                event = json.loads(path.read_text(encoding="utf-8"))
                if _stamp(event.get("finished_at")) < watermark:
                    continue
                if path.stem != event.get("event_id"):
                    raise ValueError("event filename mismatch")
                specs.append(cli_spec(event, templates_root, profile_root))
            except (ValueError, OSError, TypeError, json.JSONDecodeError) as exc:
                errors.append({"kind": "cli", "id": path.stem, "error": str(exc)})
    return specs, errors
