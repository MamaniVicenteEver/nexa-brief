"""Immutable library references and bounded derived-media caches."""
from __future__ import annotations
import hashlib
import json
import os
import subprocess
import tempfile
from contextlib import contextmanager
from contextvars import ContextVar
from functools import lru_cache, wraps
from pathlib import Path, PurePosixPath
from typing import Any
from src.core.library import asset_library

def digest(path: Path) -> str:
    path = path.resolve(strict=True)
    stat = path.stat()
    return _cached_digest(str(path), stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)


@lru_cache(maxsize=2048)
def _cached_digest(name: str, dev: int, ino: int, size: int, mtime: int, ctime: int) -> str:
    path = Path(name)
    expected = (dev, ino, size, mtime, ctime)
    def signature(stat):
        return (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
    h = hashlib.sha256()
    with path.open("rb") as stream:
        if signature(os.fstat(stream.fileno())) != expected:
            raise ValueError("Resource changed during revision check")
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
        if signature(os.fstat(stream.fileno())) != expected or signature(path.stat()) != expected:
            raise ValueError("Resource changed during revision check")
    return h.hexdigest()


_LIBRARY_SNAPSHOT: ContextVar[dict[str, Any] | None] = ContextVar("nodemotion_library_snapshot", default=None)


def _snapshot_identity() -> tuple[Any, ...]:
    from src.core.data import get_data_store
    from src.config.settings import settings
    return (get_data_store(), settings.storage_profile_dir, settings.storage_layout_version,
            settings.data_dir, settings.templates_dir)


def _snapshot_entries() -> dict[str, dict[str, Any]]:
    entries: dict[str, dict[str, Any]] = {}
    for kind, list_fn in (("music", asset_library.list_music), ("image", asset_library.list_images),
                          ("video", asset_library.list_videos)):
        by_id: dict[str, Any] = {}
        for entry in list_fn():
            if entry.asset_id in by_id:
                raise ValueError("Duplicate library asset ID")
            by_id[entry.asset_id] = entry.model_copy(deep=True)
        entries[kind] = by_id
    return entries


def _validate_snapshot(snapshot: dict[str, Any]) -> None:
    if _snapshot_identity() != snapshot["identity"]:
        raise ValueError("Selected profile or data store changed during resource resolution")
    if not snapshot["used"]:
        return
    latest = _snapshot_entries()
    if _snapshot_identity() != snapshot["identity"]:
        raise ValueError("Selected profile or data store changed during resource resolution")
    for kind, asset_id in snapshot["used"]:
        original = snapshot["entries"][kind].get(asset_id)
        current = latest[kind].get(asset_id)
        if (original is None) != (current is None):
            raise ValueError("Library entry changed during resource resolution")
        if original is not None and original.model_dump(mode="json") != current.model_dump(mode="json"):
            raise ValueError("Library entry changed during resource resolution")


@contextmanager
def library_resolution_snapshot():
    """Scope a read-only collection snapshot to one synchronous operation.

    Nested scopes share the same snapshot and revalidate all IDs used so far.
    Missing collection IDs still go through normal production resolution and
    must remain missing. No entry or resolution is retained after the scope.
    """
    snapshot = _LIBRARY_SNAPSHOT.get()
    token = None
    if snapshot is None:
        identity = _snapshot_identity()
        entries = _snapshot_entries()
        if _snapshot_identity() != identity:
            raise ValueError("Selected profile or data store changed during resource resolution")
        snapshot = {"identity": identity, "entries": entries, "used": set()}
        token = _LIBRARY_SNAPSHOT.set(snapshot)
    try:
        yield
    except BaseException:
        raise
    else:
        _validate_snapshot(snapshot)
    finally:
        if token is not None:
            _LIBRARY_SNAPSHOT.reset(token)


def with_library_resolution_snapshot(function):
    """Revalidate one synchronous, read-only operation before returning."""
    @wraps(function)
    def wrapped(*args, **kwargs):
        with library_resolution_snapshot():
            return function(*args, **kwargs)
    return wrapped


def source_metadata(kind: str, asset_id: str) -> dict[str, Any]:
    """Return detached, normalized current metadata with snapshot tracking.

    A missing collection ID follows the normal production-registry lookup.
    Within a snapshot, both present and absent IDs are revalidated on exit.
    """
    if kind not in {"music", "image", "video"} or not isinstance(asset_id, str) or not asset_id:
        raise ValueError("Invalid resource reference")
    snapshot = _LIBRARY_SNAPSHOT.get()
    entry = None
    if snapshot is not None:
        snapshot["used"].add((kind, asset_id))
        entry = snapshot["entries"][kind].get(asset_id)
    if entry is None:
        entry = asset_library.get_entry(kind, asset_id)
    return entry.model_dump(mode="json")


def _asset(kind: str, asset_id: str) -> Path:
    resolvers = {"music": asset_library.resolve_music_path, "image": asset_library.resolve_image_path,
                 "video": asset_library.resolve_video_path}
    if kind not in resolvers or not isinstance(asset_id, str) or not asset_id:
        raise ValueError("Invalid resource reference")
    from src.config.exceptions import AssetNotFoundError
    try:
        snapshot = _LIBRARY_SNAPSHOT.get()
        if snapshot is None:
            path = Path(resolvers[kind](asset_id))
        else:
            snapshot["used"].add((kind, asset_id))
            entry = snapshot["entries"][kind].get(asset_id)
            path = (Path(resolvers[kind](asset_id)) if entry is None else
                    asset_library.resolve_asset_entry_path(kind, entry, from_collection=True))
    except AssetNotFoundError as exc:
        raise FileNotFoundError(f"Missing {kind} resource {asset_id}") from exc
    if not path.is_file():
        raise FileNotFoundError(f"Missing {kind} resource {asset_id}")
    return path


def _variant_asset(kind: str, asset_id: str, relative: str | None) -> Path:
    source = _asset(kind, asset_id)
    if relative is None:
        return source
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ValueError("Invalid resource variant")
    path = PurePosixPath(relative)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in relative.split("/")):
        raise ValueError("Invalid resource variant")
    allowed = {"music": {".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac", ".webm"},
               "image": {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"},
               "video": {".mp4", ".webm", ".mov", ".mkv"}}
    if path.suffix.lower() not in allowed.get(kind, set()) or any(part.startswith(".") for part in path.parts):
        raise ValueError("Invalid resource variant type")
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    from src.adapters.data.runtime_paths import assert_profile_path
    folder = {"music": "music", "image": "images", "video": "videos"}.get(kind)
    if folder is None:
        raise ValueError("Invalid resource variant kind")
    boundary = layout_for_settings(settings).resources_dir / folder
    assert_profile_path(boundary)
    # Bundled files share one hash directory across designs and must never
    # permit sibling selection through a normal library resource reference.
    if (not source.resolve().is_relative_to(boundary.resolve()) or
            source.parent.resolve() == boundary.resolve()):
        raise ValueError("Resource variants require a normal registered resource folder")
    candidate = source.parent / path
    current = candidate
    while current != boundary:
        if current.is_symlink():
            raise ValueError("Symlink in resource variant")
        if current == current.parent:
            raise ValueError("Resource variant escapes its resource")
        current = current.parent
    if not candidate.resolve().is_relative_to(source.parent.resolve()) or not candidate.is_file():
        raise ValueError("Missing resource variant within registered resource")
    return candidate


def asset_ref(kind: str, asset_id: str, *, tail_seconds: float = 0,
              variant_file: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"kind": kind, "asset_id": asset_id,
                              "sha256": digest(_variant_asset(kind, asset_id, variant_file))}
    if variant_file is not None:
        result["variant_file"] = variant_file
    if tail_seconds:
        if kind != "music" or not 0 < tail_seconds <= 60:
            raise ValueError("Invalid audio tail")
        result["tail_seconds"] = tail_seconds
    return result


def _derived_audio(source: Path, ref: dict[str, Any]) -> Path:
    tail = float(ref.get("tail_seconds", 0))
    if not tail:
        return source
    if ref.get("kind") != "music" or not 0 < tail <= 60:
        raise ValueError("Invalid audio tail")
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    directory = layout_for_settings(settings).runtime_dir / "nodemotion" / "audio"
    from src.adapters.data.runtime_paths import assert_profile_path
    assert_profile_path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    assert_profile_path(directory)
    key = hashlib.sha256(f"{ref['sha256']}:{tail}:mp3-apad-v1".encode()).hexdigest()
    target = directory / f"{key}.mp3"
    assert_profile_path(target)
    if not target.is_file():
        fd, name = tempfile.mkstemp(prefix="audio-", suffix=".mp3", dir=directory)
        os.close(fd)
        tmp = Path(name)
        try:
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(source), "-af", f"apad=pad_dur={tail}",
                            "-c:a", "libmp3lame", "-q:a", "2", str(tmp)], check=True, capture_output=True)
            os.replace(tmp, target)
        finally:
            tmp.unlink(missing_ok=True)
    return target


def _resolve_ref(ref: dict[str, Any]) -> Path:
    source = _variant_asset(ref.get("kind"), ref.get("asset_id"), ref.get("variant_file"))
    if digest(source) != ref.get("sha256"):
        raise ValueError("Resource revision is unavailable")
    if ref.get("poster"):
        if ref.get("kind") != "video":
            raise ValueError("Invalid poster reference")
        poster = ref["poster"]
        if isinstance(poster, dict):
            if set(poster) != {"recipe", "sha256"} or poster.get("recipe") != "legacy-v1":
                raise ValueError("Invalid immutable poster reference")
            target = _poster_snapshot_path(poster["sha256"])
            if target.is_symlink() or not target.is_file() or digest(target) != poster["sha256"]:
                raise ValueError("Poster revision is unavailable")
            return target
        from src.config.profile_layout import layout_for_settings
        from src.config.settings import settings
        directory = layout_for_settings(settings).runtime_dir / "nodemotion" / "posters"
        from src.adapters.data.runtime_paths import assert_profile_path
        assert_profile_path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        assert_profile_path(directory)
        if poster == "legacy-v1":
            target = directory / (ref["sha256"] + "-poster-legacy-v1.jpg")
            assert_profile_path(target)
            if target.is_symlink():
                raise ValueError("Symlink in poster cache")
            if not target.is_file():
                with tempfile.TemporaryDirectory(prefix="legacy-poster-", dir=directory) as temporary:
                    tmp = Path(temporary) / "poster.jpg"
                    # Exact recipe used by the campaign builder before sharing:
                    # JPEG defaults, frame at .5 s, no added quality setting.
                    subprocess.run(["ffmpeg", "-v", "error", "-n", "-ss", "0.5", "-i", str(source),
                                    "-frames:v", "1", "-update", "1", str(tmp)],
                                   check=True, capture_output=True)
                    os.replace(tmp, target)
            return target
        if poster is not True:
            raise ValueError("Invalid poster recipe")
        target = directory / (ref["sha256"] + "-poster-v1.jpg")
        assert_profile_path(target)
        if not target.is_file():
            fd, name = tempfile.mkstemp(prefix="poster-", suffix=".jpg", dir=directory)
            os.close(fd)
            tmp = Path(name)
            try:
                subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "0.5", "-i", str(source),
                                "-frames:v", "1", "-q:v", "2", str(tmp)], check=True, capture_output=True)
                os.replace(tmp, target)
            finally:
                tmp.unlink(missing_ok=True)
        return target
    return _derived_audio(source, ref)



def _poster_snapshot_path(revision: str, *, create: bool = False) -> Path:
    if not isinstance(revision, str) or len(revision) != 64 or any(c not in "0123456789abcdef" for c in revision):
        raise ValueError("Invalid poster revision")
    from src.adapters.data.runtime_paths import assert_profile_path
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    directory = layout_for_settings(settings).resources_dir / "nodemotion" / "posters"
    assert_profile_path(directory)
    if create:
        directory.mkdir(parents=True, exist_ok=True)
        assert_profile_path(directory)
    target = directory / (revision + ".jpg")
    assert_profile_path(target)
    return target


def _link_immutable(temporary: str, target: Path) -> None:
    """Publish a new immutable file and durably record its directory entry."""
    try:
        os.link(temporary, target)
    except FileExistsError:
        return
    descriptor = os.open(target.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def poster_ref(video_ref: dict[str, Any], *, historical: Path | None = None) -> dict[str, Any]:
    """Share the exact legacy poster, preserving historical JPEG bytes."""
    if video_ref.get("kind") != "video" or video_ref.get("poster"):
        raise ValueError("Poster requires an unmodified video reference")
    if historical is not None and (historical.is_symlink() or not historical.is_file()):
        raise ValueError("Invalid historical poster")
    source = historical if historical is not None else _resolve_ref({**video_ref, "poster": "legacy-v1"})
    revision = digest(source)
    target = _poster_snapshot_path(revision, create=True)
    if not target.exists():
        fd, temporary = tempfile.mkstemp(prefix=".poster-", suffix=".tmp", dir=target.parent)
        try:
            with os.fdopen(fd, "wb") as stream, source.open("rb") as original:
                for chunk in iter(lambda: original.read(1024 * 1024), b""):
                    stream.write(chunk)
                stream.flush()
                os.fsync(stream.fileno())
            if digest(Path(temporary)) != revision:
                raise ValueError("Poster changed during sharing")
            _link_immutable(temporary, target)
        finally:
            Path(temporary).unlink(missing_ok=True)
    result = {**video_ref, "poster": {"recipe": "legacy-v1", "sha256": revision}}
    _resolve_ref(result)
    return result


def _transcription_path(revision: str, *, create: bool = False) -> Path:
    """Content-addressed project resources, never the disposable runtime cache."""
    if not isinstance(revision, str) or len(revision) != 64 or any(c not in "0123456789abcdef" for c in revision):
        raise ValueError("Invalid transcription revision")
    from src.adapters.data.runtime_paths import assert_profile_path
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings
    directory = layout_for_settings(settings).resources_dir / "nodemotion" / "transcriptions"
    assert_profile_path(directory)
    if create:
        directory.mkdir(parents=True, exist_ok=True)
        assert_profile_path(directory)
    path = directory / f"{revision}.json"
    assert_profile_path(path)
    return path


def resolve_transcription(revision: str) -> bytes:
    path = _transcription_path(revision)
    if not path.is_file() or path.is_symlink():
        raise FileNotFoundError(f"Transcription revision unavailable: {revision}")
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != revision:
        raise ValueError("Corrupt transcription revision")
    return content


def snapshot_transcription(data: dict[str, Any] | bytes) -> str:
    """Atomically publish an immutable transcription, preserving supplied JSON bytes."""
    if isinstance(data, bytes):
        try:
            value = json.loads(data)
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValueError("Transcription must be valid JSON") from exc
        if not isinstance(value, dict):
            raise ValueError("Transcription must be an object")
        content = data
    elif isinstance(data, dict):
        content = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    else:
        raise ValueError("Transcription must be an object or JSON bytes")
    revision = hashlib.sha256(content).hexdigest()
    target = _transcription_path(revision, create=True)
    if target.exists():
        if resolve_transcription(revision) != content:
            raise ValueError("Corrupt transcription revision")
        return revision
    fd, temporary = tempfile.mkstemp(prefix=".transcription-", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        _link_immutable(temporary, target)
        if resolve_transcription(revision) != content:
            raise ValueError("Corrupt transcription revision")
    finally:
        Path(temporary).unlink(missing_ok=True)
    return revision
