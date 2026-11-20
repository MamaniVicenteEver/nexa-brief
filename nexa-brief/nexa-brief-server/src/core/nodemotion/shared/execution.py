"""Resolve and temporarily materialize data-only projects."""
from __future__ import annotations
import hashlib
import json
import shutil
from pathlib import Path, PurePosixPath
from typing import Any
from src.core.library import asset_library
from src.core.nodemotion.shared.resources import _resolve_ref, resolve_transcription, snapshot_transcription
from src.templates._tools.nodemotion.shared.assemble import (
    assemble, available_revision, design_manifest, engine_revision, freeze_engine, registered,
    resolve_runtime_asset, runtime_files,
)

PROJECT = "project.json"

def _relative(value: str) -> str:
    path = PurePosixPath(value)
    if not value or "\\" in value or path.is_absolute() or any(x in ("", ".", "..") for x in value.split("/")):
        raise ValueError("Invalid project path")
    return str(path)


def _content_root(root: Path, prefix: str) -> Path:
    root = root.resolve()
    if prefix:
        _relative(prefix)
    content = (root / prefix).resolve()
    if not content.is_relative_to(root):
        raise ValueError("Invalid project content directory")
    return content


def _data_urls(value: Any, refs: dict[str, Any]) -> dict[str, str]:
    required = {"config", "timing", "audio"}
    if not isinstance(value, dict) or not required <= set(value) or set(value) - (required | {"background"}):
        raise ValueError("Invalid project data URLs")
    result = {}
    for kind, raw in value.items():
        if not isinstance(raw, str):
            raise ValueError("Invalid project data URL")
        path = _relative(raw)
        parts = PurePosixPath(path).parts
        if any(part.startswith(".") or part.lower() in {"logs", "work", "private", "project.json",
                                                              "timeline.json", "appearance.json", "private.json",
                                                              "manifest.json"} for part in parts):
            raise ValueError("Private project data URL")
        suffix = PurePosixPath(path).suffix.lower()
        allowed = ({".json"} if kind in {"config", "timing"} else
                   {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"} if kind == "background"
                   else {".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac", ".webm"})
        if suffix not in allowed:
            raise ValueError("Invalid project data URL type")
        result[kind] = path
    if len(set(result.values())) != len(result) or result["config"] in refs or result["timing"] in refs:
        raise ValueError("Conflicting project data URLs")
    audio_ref = refs.get(result["audio"])
    if not isinstance(audio_ref, dict) or audio_ref.get("kind") != "music":
        raise ValueError("Project audio URL has no music resource")
    if "background" in result:
        background_ref = refs.get(result["background"])
        if not isinstance(background_ref, dict) or background_ref.get("kind") not in {"image", "video"}:
            raise ValueError("Project background URL has no visual resource")
    return result


def _extra_data_urls(value: Any, refs: dict[str, Any], data_urls: dict[str, str] | None) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("Invalid extra project data URLs")
    result = []
    for raw in value:
        if not isinstance(raw, str):
            raise ValueError("Invalid extra project data URL")
        path = _relative(raw)
        parts = PurePosixPath(path).parts
        if (PurePosixPath(path).suffix.lower() != ".json" or
                any(part.startswith(".") or part.lower() in {"logs", "work", "private", "project.json",
                                                              "timeline.json", "appearance.json", "private.json",
                                                              "manifest.json"} for part in parts) or
                path in refs or path in (data_urls or {}).values() or path in result):
            raise ValueError("Invalid or conflicting extra project data URL")
        result.append(path)
    return result


def _project_file(root: Path, relative: str) -> Path:
    relative = _relative(relative)
    boundary = root.resolve()
    path = boundary / relative
    for part in (path, *path.parents):
        if part == boundary:
            break
        if part.is_symlink():
            raise ValueError("Symlink in project data path")
    if not path.resolve().is_relative_to(boundary):
        raise ValueError("Project data path escapes project")
    return path


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def create_project(root: Path, design_id: str, assets: dict[str, dict[str, Any]], *,
                   lyrics_asset_id: str | None = None, policy: str = "stable",
                   content_prefix: str = "assets", timeline: dict | None = None,
                   transcription_data: dict | bytes | None = None,
                   data_urls: dict[str, str] | None = None,
                   inject_base: bool | None = None,
                   extra_data_urls: list[str] | None = None,
                   workspace_only: bool = False) -> dict[str, Any]:
    if type(workspace_only) is not bool:
        raise ValueError("Invalid project workspace policy")
    if not registered(design_id) or policy not in {"stable", "pinned"}:
        raise ValueError("Unregistered design or engine policy")
    if timeline is not None and (lyrics_asset_id or transcription_data is not None):
        raise ValueError("Project timing must use either a timeline or a transcription")
    prefix = _relative(content_prefix) if content_prefix else ""
    refs = {_relative(name): ref for name, ref in assets.items()}
    if any(name in {"index.html", "config.json", "lyrics.json", "timeline.json", "project.json"}
           or PurePosixPath(name).suffix.lower() in {".html", ".js", ".css"} for name in refs):
        raise ValueError("Reserved project asset name")
    for ref in refs.values():
        if not isinstance(ref, dict) or set(ref) - {"kind", "asset_id", "sha256", "tail_seconds", "poster", "variant_file"}:
            raise ValueError("Invalid resource reference")
        sha = ref.get("sha256")
        if not isinstance(sha, str) or len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
            raise ValueError("Invalid resource revision")
        _resolve_ref(ref)
    result: dict[str, Any] = {"kind": "nodemotion", "schema_version": 1, "design_id": design_id,
                              "engine": {"policy": policy}, "content_prefix": prefix, "assets": refs}
    if workspace_only:
        result["workspace_only"] = True
    if data_urls is not None:
        result["data_urls"] = _data_urls(data_urls, refs)
        if not _project_file(root, result["data_urls"]["config"]).is_file():
            raise FileNotFoundError("Missing project configuration")
    if extra_data_urls is not None:
        result["extra_data_urls"] = _extra_data_urls(extra_data_urls, refs, result.get("data_urls"))
        for name in result["extra_data_urls"]:
            path = _project_file(root, name)
            if not path.is_file():
                raise FileNotFoundError("Missing extra project data")
            try:
                json.loads(path.read_bytes())
            except (ValueError, UnicodeDecodeError) as exc:
                raise ValueError("Invalid extra project JSON") from exc
    if inject_base is not None and type(inject_base) is not bool:
        raise ValueError("Invalid project base policy")
    if inject_base is not None or data_urls is not None:
        result["inject_base"] = inject_base if inject_base is not None else False
    if policy == "pinned":
        # Pinning must survive direct edits to the canonical engine.
        result["engine"]["revision"] = freeze_engine(design_id)
    if transcription_data is not None or lyrics_asset_id:
        lyrics = transcription_data if transcription_data is not None else asset_library.get_lyrics_cache(lyrics_asset_id)
        if lyrics is None:
            raise FileNotFoundError("Missing transcription")
        result["transcription"] = {"music_asset_id": lyrics_asset_id,
                                   "sha256": snapshot_transcription(lyrics), "storage": "shared"}
    root.mkdir(parents=True, exist_ok=True)
    manifest_path = root / PROJECT
    if manifest_path.is_symlink():
        raise ValueError("Invalid project manifest path")
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        if existing.get("kind") != "nodemotion":
            raise FileExistsError("Refusing to replace another project manifest")
    if timeline is not None:
        if not isinstance(timeline, dict):
            raise ValueError("Invalid promo timeline")
        content = _content_root(root, prefix)
        content.mkdir(parents=True, exist_ok=True)
        timeline_path = content / "timeline.json"
        if timeline_path.is_symlink():
            raise ValueError("Invalid project timeline path")
        timeline_path.write_bytes(_json_bytes(timeline))
        result["timeline"] = "timeline.json"
    manifest_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def load_project(root: Path) -> dict[str, Any] | None:
    path = root / PROJECT
    if not path.is_file():
        return None
    project = json.loads(path.read_text(encoding="utf-8"))
    if project.get("kind") != "nodemotion":
        return None
    if project.get("schema_version") != 1 or not registered(project.get("design_id", "")):
        raise ValueError("Invalid NodeMotion project")
    if "workspace_only" in project and type(project["workspace_only"]) is not bool:
        raise ValueError("Invalid project workspace policy")
    refs = project.get("assets")
    if not isinstance(refs, dict):
        raise ValueError("Invalid project assets")
    for name in refs:
        _relative(name)
        if name in {"index.html", "config.json", "lyrics.json", "timeline.json", "project.json"} or PurePosixPath(name).suffix.lower() in {".html", ".js", ".css"}:
            raise ValueError("Reserved project asset name")
    if "data_urls" in project:
        _data_urls(project["data_urls"], refs)
    if "extra_data_urls" in project:
        _extra_data_urls(project["extra_data_urls"], refs, project.get("data_urls"))
    if "inject_base" in project and type(project["inject_base"]) is not bool:
        raise ValueError("Invalid project base policy")
    transcription = project.get("transcription")
    if transcription is not None:
        if (not isinstance(transcription, dict) or project.get("timeline") or
                transcription.get("storage") not in {None, "shared"}):
            raise ValueError("Invalid project transcription reference")
    engine = project.get("engine", {})
    if engine.get("policy") not in {"stable", "pinned"}:
        raise ValueError("Invalid engine policy")
    if engine["policy"] == "pinned" and not available_revision(project["design_id"], engine.get("revision", "")):
        raise ValueError("Pinned engine revision is unavailable")
    return project


def resolve_project(root: Path, relative: str, *, expected_revision: str | None = None) -> bytes | Path | None:
    project = load_project(root)
    if project is None:
        return None
    relative = _relative(relative)
    design = project["design_id"]
    policy = project["engine"]
    revision = policy.get("revision") if policy["policy"] == "pinned" else engine_revision(design)
    if expected_revision is not None:
        if policy["policy"] == "pinned" and expected_revision != revision:
            raise ValueError("Engine revision changed during execution")
        revision = expected_revision
    if not available_revision(design, revision):
        raise ValueError("Engine revision changed during execution")
    prefix = project.get("content_prefix", "")
    if prefix:
        _relative(prefix)
    if relative == "index.html":
        html = assemble(design, revision=revision)
        appearance = root / "appearance.json"
        if appearance.is_file():
            if appearance.is_symlink() or not appearance.resolve().is_relative_to(root.resolve()):
                raise ValueError("Invalid appearance path")
            from src.core.nodemotion.lyrics.appearance import apply_appearance
            html = apply_appearance(html.decode("utf-8"), json.loads(appearance.read_text(encoding="utf-8"))).encode("utf-8")
        if prefix and project.get("inject_base", True):
            import re
            base = f'<base href="{prefix}/">'.encode()
            html = re.sub(rb"(<head\b[^>]*>)", lambda m: m.group(1) + base, html, count=1, flags=re.I)
        if not available_revision(design, revision):
            raise ValueError("Engine revision changed during assembly")
        return html
    if relative in project.get("extra_data_urls", []):
        candidate = _project_file(root, relative)
        if not candidate.is_file():
            raise FileNotFoundError("Missing extra project data")
        return candidate
    data_urls = project.get("data_urls")
    local = (relative if data_urls else
             (relative[len(prefix) + 1:] if prefix and relative.startswith(prefix + "/") else relative))
    _relative(local)
    refs = project.get("assets", {})
    if local in refs:
        return _resolve_ref(refs[local])
    timing_request = local == data_urls["timing"] if data_urls else local == "lyrics.json"
    config_request = local == data_urls["config"] if data_urls else local == "config.json"
    if timing_request and project.get("timeline"):
        timeline = _relative(project["timeline"])
        content_root = _content_root(root, prefix)
        source = (content_root / timeline).resolve()
        if not source.is_relative_to(content_root) or not source.is_file():
            raise FileNotFoundError("Missing project timeline")
        return source
    if timing_request and project.get("transcription"):
        ref = project["transcription"]
        if ref.get("storage") == "shared":
            return resolve_transcription(ref["sha256"])
        # Older manifests can use a later-created shared snapshot if one exists.
        try:
            return resolve_transcription(ref["sha256"])
        except FileNotFoundError:
            pass
        # Compatibility for projects created before snapshots existed.
        lyrics = asset_library.get_lyrics_cache(ref["music_asset_id"])
        if lyrics is None or hashlib.sha256(_json_bytes(lyrics)).hexdigest() != ref["sha256"]:
            raise ValueError("Transcription revision is unavailable")
        return _json_bytes(lyrics)
    # Only explicitly public project data may shadow the demo. Never expose
    # arbitrary JSON such as the project manifest or execution logs.
    if config_request:
        candidate = _project_file(root, local if data_urls else f"{prefix}/{local}" if prefix else local)
        if candidate.is_file():
            return candidate
        return None
    if timing_request or local in {"song.mp3", "lyrics.json", "config.json", "project.json"}:
        return None
    manifest = design_manifest(design, revision=revision)
    declared = manifest.get("runtime_assets", [])
    allowed = local in manifest.get("runtime_aliases", {}) or any(
        local == item or local.startswith(item.rstrip("/") + "/") for item in declared
    )
    return resolve_runtime_asset(design, local, revision=revision) if allowed else None


def materialize(root: Path, destination: Path) -> tuple[Path, Path, str]:
    project = load_project(root)
    if project is None:
        raise ValueError("Missing NodeMotion project")
    policy = project["engine"]
    selected = policy.get("revision") if policy["policy"] == "pinned" else None
    revision = freeze_engine(project["design_id"], revision=selected)
    prefix = project.get("content_prefix", "")
    if prefix:
        _relative(prefix)
    data_urls = project.get("data_urls")
    content = destination / prefix
    content.mkdir(parents=True, exist_ok=True)
    runtime_root = destination if data_urls else content
    for name, source in runtime_files(project["design_id"], revision=revision).items():
        name = _relative(name)
        dest = runtime_root / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
    if data_urls:
        config_value = resolve_project(root, data_urls["config"], expected_revision=revision)
        if not isinstance(config_value, Path):
            raise FileNotFoundError("Missing project configuration")
        config_dest = destination / data_urls["config"]
        config_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(config_value, config_dest)
    else:
        project_content = _content_root(root, prefix)
        if project_content.is_dir():
            # Only public project data belongs in the temporary web root.
            for name in ("config.json", project.get("timeline")):
                if not name:
                    continue
                name = _relative(name)
                path = project_content / name
                if path.is_symlink() or not path.resolve().is_relative_to(project_content.resolve()):
                    raise ValueError("Invalid project data path")
                if path.is_file():
                    dest = content / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, dest)
    for name in project.get("extra_data_urls", []):
        value = resolve_project(root, name, expected_revision=revision)
        if not isinstance(value, Path):
            raise FileNotFoundError("Missing extra project data")
        dest = destination / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(value, dest)
    names = list(project.get("assets", {}))
    if project.get("transcription") or project.get("timeline"):
        names.append(data_urls["timing"] if data_urls else "lyrics.json")
    for name in names:
        name = _relative(name)
        virtual = name if data_urls else f"{prefix}/{name}" if prefix else name
        value = resolve_project(root, virtual, expected_revision=revision)
        dest = destination / name if data_urls else content / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(value, bytes):
            dest.write_bytes(value)
        elif isinstance(value, Path):
            shutil.copy2(value, dest)
        else:
            raise FileNotFoundError(virtual)
    html = resolve_project(root, "index.html", expected_revision=revision)
    (destination / "index.html").write_bytes(html)
    (destination / ".nodemotion-render.json").write_text(
        json.dumps({"revision": revision, "data_urls": data_urls, "content_prefix": prefix}))
    audio = destination / data_urls["audio"] if data_urls else content / "song.mp3"
    if not audio.is_file():
        raise FileNotFoundError("Missing project audio")
    if not available_revision(project["design_id"], revision):
        raise ValueError("Engine revision changed during materialization")
    return destination / "index.html", audio, revision



def lyrics_for_job(job) -> dict[str, Any] | None:
    """Read project-owned promo text or a verified shared transcription on demand."""
    if job.artifacts.lyrics_json is not None:
        return job.artifacts.lyrics_json
    root = job.artifacts.output_dir
    if root is None:
        return None
    project = load_project(Path(root))
    if project is None or not (project.get("timeline") or project.get("transcription")):
        return None
    prefix = project.get("content_prefix", "")
    name = project["data_urls"]["timing"] if project.get("data_urls") else f"{prefix}/lyrics.json" if prefix else "lyrics.json"
    value = resolve_project(Path(root), name)
    if isinstance(value, Path):
        return json.loads(value.read_text(encoding="utf-8"))
    if isinstance(value, bytes):
        return json.loads(value)
    raise FileNotFoundError("Missing project lyrics")
