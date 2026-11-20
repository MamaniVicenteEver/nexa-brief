"""Conservative read-only plans for legacy internal campaign workspaces.

A workspace without HTML has no old engine snapshot to reconstruct. Its exact
configuration, timing and prepared resource bytes can still be preserved while
binding the registered design and keeping the workspace out of gallery lists.
"""
from __future__ import annotations

import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile

from src.config.settings import settings
from src.core.nodemotion.promo.prompts import TEMPLATES
from src.core.nodemotion.promo.workspace import prepared_reference
from src.core.nodemotion.shared import execution, resources
from src.templates._tools.nodemotion.shared.assemble import engine_revision, registered

_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_MEDIA = {".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
          ".gif": "image", ".avif": "image", ".svg": "image", ".mp4": "video",
          ".webm": "video", ".mov": "video", ".mkv": "video"}
_REQUIRED = ("brief.json", "music.json", "media-plan.json", "assets/config.json", "assets/lyrics.json")


def _json(path: Path):
    return json.loads(path.read_bytes())


def _bytes_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _relative(value: str) -> str:
    path = Path(value)
    if (not value or path.is_absolute() or "\\" in value or
            any(part in {"", ".", ".."} for part in value.split("/"))):
        raise ValueError("Invalid campaign plan path")
    return path.as_posix()


def _scope(profile: Path, root: Path) -> None:
    if profile.absolute() != Path(settings.storage_profile_dir).absolute():
        raise ValueError("Campaign plan belongs to another selected profile")
    if not root.is_relative_to(profile / "sandbox/nodemotion"):
        raise ValueError("Campaign workspace is outside the selected NodeMotion sandbox")
    for path in (root, *root.parents):
        if path.is_symlink():
            raise ValueError("Symlink in campaign workspace root")
        if path == profile:
            break
    if not root.resolve().is_relative_to(profile.resolve()):
        raise ValueError("Campaign root escapes selected profile")


def _safe_file(root: Path, relative: str) -> Path:
    path = root / _relative(relative)
    current = path
    while current != root:
        if current.is_symlink():
            raise ValueError("Symlink in campaign metadata")
        current = current.parent
    if not path.is_file():
        raise ValueError("Missing safe campaign metadata: " + relative)
    return path


@contextlib.contextmanager
def _staged_posters(sources: dict[str, Path], temporary: Path):
    original = resources._poster_snapshot_path
    directory = temporary / "posters"
    directory.mkdir()
    for sha, source in sources.items():
        target = directory / (sha + ".jpg")
        shutil.copyfile(source, target)
        if resources.digest(target) != sha:
            raise ValueError("Historical poster changed while preparing the plan")
    # Read-only planning imports snapshots only into its disposable stage.
    resources._poster_snapshot_path = lambda sha, create=False: directory / (sha + ".jpg")
    try:
        yield
    finally:
        resources._poster_snapshot_path = original


def _verify_stage(root: Path, manifest: dict, expected: dict[str, str],
                  poster_sources: dict[str, Path]) -> None:
    with tempfile.TemporaryDirectory(prefix="nodemotion-campaign-plan-") as name:
        stage = Path(name)
        (stage / "assets").mkdir()
        for relative in ("assets/config.json",):
            shutil.copyfile(root / relative, stage / relative)
        shutil.copyfile(root / "assets/lyrics.json", stage / "assets/timeline.json")
        (stage / "project.json").write_text(json.dumps(manifest, sort_keys=True, ensure_ascii=False))
        with _staged_posters(poster_sources, stage):
            for relative, expected_sha in expected.items():
                value = execution.resolve_project(stage, relative)
                actual = (_bytes_hash(value) if isinstance(value, bytes) else resources.digest(value)
                          if isinstance(value, Path) else None)
                if actual != expected_sha:
                    raise ValueError("Campaign virtual resource differs: " + relative)
            html = execution.resolve_project(stage, "index.html")
            if not isinstance(html, bytes):
                raise ValueError("Shared campaign engine is unavailable")


def plan_campaign(profile: Path, root: Path) -> dict:
    profile, root = Path(profile).absolute(), Path(root).absolute()
    _scope(profile, root)
    if (root / "index.html").exists() or (root / "index.html").is_symlink():
        raise ValueError("Workspace has its own HTML; use verified engine migration")
    if (root / "project.json").exists():
        return {"root": str(root), "status": "already-migrated"}
    inputs = {}
    for relative in _REQUIRED:
        path = _safe_file(root, relative)
        _json(path)
        inputs[relative] = resources.digest(path)
    brief, music, media_plan = (_json(root / name) for name in _REQUIRED[:3])
    design = brief.get("template")
    if design not in TEMPLATES or not registered(design):
        raise ValueError("Unregistered campaign design")
    from src.core.template_config import active_config
    config = active_config(_json(root / "assets/config.json"))
    if config.get("audio", {}).get("src") != "song.mp3" or config.get("lyricsUrl") != "lyrics.json":
        raise ValueError("Unsupported campaign data URLs; exact review is required")
    timeline = _json(root / "assets/lyrics.json")
    if not isinstance(timeline, dict) or not isinstance(timeline.get("segments"), list):
        raise ValueError("Invalid campaign timing")
    owned_timeline = root / "assets/timeline.json"
    if owned_timeline.exists() or owned_timeline.is_symlink():
        path = _safe_file(root, "assets/timeline.json")
        if path.read_bytes() != (root / "assets/lyrics.json").read_bytes():
            raise ValueError("Existing canonical timeline differs from legacy bytes")
        inputs["assets/timeline.json"] = resources.digest(path)
    allowed_ids = {item.get("asset_id") for item in media_plan.get("items", []) if isinstance(item, dict)}
    refs, retire, expected, posters = {}, [], {}, {}
    music_id = music.get("asset_id")
    if not isinstance(music_id, str) or not _ID.fullmatch(music_id):
        raise ValueError("Invalid campaign music identity")
    song = root / "assets/song.mp3"
    if not song.is_file():
        raise ValueError("Missing prepared campaign audio")
    audio_ref = prepared_reference(profile, "music", music_id, music["ready_file"])
    if song.resolve(strict=True) != resources._resolve_ref(audio_ref).resolve(strict=True):
        raise ValueError("Campaign audio link differs from music.json ready_file")
    refs["song.mp3"] = audio_ref
    candidates = [song]
    media_dir = root / "assets/media"
    if media_dir.is_symlink():
        raise ValueError("Symlink in campaign media directory")
    media_files = sorted(media_dir.rglob("*")) if media_dir.exists() else []
    for path in media_files:
        if path.is_dir():
            if path.is_symlink():
                raise ValueError("Symlink in campaign media directory")
            continue
        if path.name.endswith("-poster.jpg"):
            continue
        if path.suffix.lower() not in _MEDIA:
            raise ValueError("Unknown campaign media file: " + path.name)
        kind = _MEDIA[path.suffix.lower()]
        resolved = path.resolve(strict=True)
        folder = profile / "resources" / ("videos" if kind == "video" else "images")
        if not resolved.is_relative_to(folder) or len(resolved.relative_to(folder).parts) < 2:
            raise ValueError("Campaign media does not target a normal registered resource")
        asset_id = resolved.relative_to(folder).parts[0]
        if not _ID.fullmatch(asset_id):
            raise ValueError("Invalid campaign media resource identity")
        relative_file = resolved.relative_to(folder / asset_id).as_posix()
        ref = prepared_reference(profile, kind, asset_id, relative_file)
        if resources._resolve_ref(ref).resolve() != resolved:
            raise ValueError("Campaign prepared media differs from its registered resource")
        refs[path.relative_to(root / "assets").as_posix()] = ref
        candidates.append(path)
        # Sidecars are evidence only; no regeneration or editorial rebuild.
        metadata = folder / asset_id / "resource.json"
        if metadata.is_file() and not metadata.is_symlink():
            inputs[str(metadata.relative_to(root)) if metadata.is_relative_to(root) else "@profile/" + metadata.relative_to(profile).as_posix()] = resources.digest(metadata)
    unused = []
    for path in media_files:
        if path.is_dir() or not path.name.endswith("-poster.jpg"):
            continue
        if path.is_symlink() or not path.is_file():
            raise ValueError("Historical poster must be a regular image")
        ident = path.name[:-len("-poster.jpg")]
        matches = [name for name, ref in refs.items()
                   if name.startswith("media/") and ref["kind"] == "video" and Path(name).stem == ident]
        if len(matches) != 1:
            raise ValueError("Historical poster has no unique verified video source")
        video_ref = refs[matches[0]]
        sha = resources.digest(path)
        virtual = path.relative_to(root / "assets").as_posix()
        refs[virtual] = {**video_ref, "poster": {"recipe": "legacy-v1", "sha256": sha}}
        posters[sha] = path
        candidates.append(path)
    for path in candidates:
        relative = path.relative_to(root).as_posix()
        ref = refs[path.relative_to(root / "assets").as_posix()]
        sha = resources.digest(path)
        expected[relative] = sha
        retire.append({"relative": relative, "sha256": sha, "symlink": path.is_symlink(),
                       "link_target": os.readlink(path) if path.is_symlink() else None,
                       "resolved": str(path.resolve(strict=True))})
        if ref["kind"] != "music" and ref["asset_id"] not in allowed_ids:
            unused.append(relative)
    for entry in config.get("media", []):
        if not isinstance(entry, dict):
            raise ValueError("Invalid campaign config media")
        used_slots = {slot for scene in config.get("scenes", []) for slot in scene.get("media", [])}
        if entry.get("id") in used_slots:
            for key in ("src", "poster"):
                if entry.get(key) and entry[key] not in refs:
                    raise ValueError("Active campaign media is unavailable: " + entry[key])
    source_models = {}
    for ref in refs.values():
        key = ref["kind"] + ":" + ref["asset_id"]
        if key not in source_models:
            source_models[key] = resources.source_metadata(ref["kind"], ref["asset_id"])
    revision = engine_revision(design)
    manifest = {"kind": "nodemotion", "schema_version": 1, "design_id": design,
                "engine": {"policy": "pinned", "revision": revision}, "content_prefix": "assets",
                "timeline": "timeline.json", "workspace_only": True, "assets": refs}
    expected["assets/config.json"] = inputs["assets/config.json"]
    expected["assets/lyrics.json"] = inputs["assets/lyrics.json"]
    _verify_stage(root, manifest, expected, posters)
    if engine_revision(design) != revision:
        raise ValueError("Shared engine changed while preparing campaign plan")
    result = {"root": str(root), "status": "planned", "design_id": design, "project": manifest,
              "inputs": inputs, "retire": retire, "expected": expected,
              "poster_sources": {sha: str(path) for sha, path in posters.items()},
              "source_models": source_models,
              "unused_registered_media": unused, "engine_basis": "workspace-had-no-html",
              "checks": {"exact_config": True, "exact_timing": True, "all_media_bytes": True,
                         "workspace_stays_hidden": True, "no_editorial_rebuild": True}}
    result["plan_sha256"] = _bytes_hash(json.dumps(result, ensure_ascii=False, sort_keys=True).encode())
    return result


@resources.with_library_resolution_snapshot
def plan_campaigns(profile: Path) -> dict:
    profile = Path(profile).absolute()
    projects = []
    scope = profile / "sandbox/nodemotion"
    for brief in sorted(scope.rglob("brief.json")) if scope.is_dir() else []:
        root = brief.parent
        if not all((root / relative).is_file() for relative in _REQUIRED[:-1]):
            continue
        try:
            projects.append(plan_campaign(profile, root))
        except (OSError, ValueError, KeyError, TypeError) as exc:
            projects.append({"root": str(root), "status": "needs-review", "reason": str(exc)})
    return {"schema_version": 1, "kind": "nodemotion-campaign-plan", "profile": str(profile),
            "projects": projects,
            "counts": {status: sum(row["status"] == status for row in projects)
                       for status in ("planned", "needs-review", "already-migrated")}}


def journal_path(profile: Path, root: Path) -> Path:
    _scope(profile, root)
    key = _bytes_hash(root.relative_to(profile).as_posix().encode())
    return profile / ".system/runtime/nodemotion/campaign-migrations" / (key + ".json")


def _plan_identity(plan: dict) -> str:
    return _bytes_hash(json.dumps({key: value for key, value in plan.items() if key != "plan_sha256"},
                                 ensure_ascii=False, sort_keys=True).encode())


def _validate_inputs(profile: Path, plan: dict) -> Path:
    root = Path(plan["root"])
    _scope(profile, root)
    if plan.get("status") != "planned" or _plan_identity(plan) != plan.get("plan_sha256"):
        raise ValueError("Campaign plan checksum changed")
    if (root / "index.html").exists() or (root / "index.html").is_symlink():
        raise ValueError("Campaign workspace gained its own HTML after planning")
    manifest = plan["project"]
    if (root / "project.json").exists() or (root / "project.json").is_symlink():
        if _json(_safe_file(root, "project.json")) != manifest:
            raise ValueError("Campaign project manifest changed")
    if (manifest.get("workspace_only") is not True or manifest.get("content_prefix") != "assets"
            or manifest.get("timeline") != "timeline.json" or
            manifest.get("design_id") != plan.get("design_id") or
            manifest.get("engine", {}).get("policy") != "pinned"):
        raise ValueError("Campaign project contract changed")
    for relative, expected_sha in plan["inputs"].items():
        if relative.startswith("@profile/"):
            tail = _relative(relative[len("@profile/"):])
            if not tail.startswith(("resources/videos/", "resources/images/")) or not tail.endswith("/resource.json"):
                raise ValueError("Invalid campaign resource metadata prerequisite")
            path = _safe_file(profile, tail)
        else:
            if relative not in {*_REQUIRED, "assets/timeline.json"}:
                raise ValueError("Invalid campaign metadata prerequisite")
            path = _safe_file(root, relative)
        if resources.digest(path) != expected_sha:
            raise ValueError("Campaign prerequisite changed: " + relative)
    required_models = {ref["kind"] + ":" + ref["asset_id"] for ref in manifest["assets"].values()}
    if set(plan.get("source_models", {})) != required_models:
        raise ValueError("Campaign plan lacks exact source metadata")
    for key, expected_model in plan["source_models"].items():
        kind, asset_id = key.split(":", 1)
        if resources.source_metadata(kind, asset_id) != expected_model:
            raise ValueError("Campaign source metadata changed: " + key)
    allowed = set()
    for item in plan["retire"]:
        relative = _relative(item["relative"])
        if (relative != "assets/song.mp3" and
                (not relative.startswith("assets/media/") or Path(relative).suffix.lower() not in _MEDIA)):
            raise ValueError("Campaign retirement path is not an allowed media file")
        if relative in allowed or relative not in plan["expected"]:
            raise ValueError("Invalid campaign retirement inventory")
        allowed.add(relative)
        local = relative[len("assets/"):]
        if local not in manifest["assets"] or plan["expected"][relative] != item["sha256"]:
            raise ValueError("Campaign media is not an immutable project reference")
        if item["symlink"] is not True and not Path(relative).name.endswith("-poster.jpg"):
            raise ValueError("Only verified media links and imported historical posters may be retired")
        path = root / relative
        current = path.parent
        while current != root:
            if current.is_symlink():
                raise ValueError("Symlink in campaign media parent")
            current = current.parent
    return root


def _validate_sources(profile: Path, plan: dict, *, allow_missing: bool) -> None:
    root = _validate_inputs(profile, plan)
    from src.core.nodemotion.shared import retirement
    protected = retirement._protected_outputs(profile)
    state = _json(root / "draft.json") if (root / "draft.json").is_file() else {}
    if state.get("draft_id"):
        retirement._ensure_not_busy(root, state["draft_id"])
    from src.adapters.data.section_store import Section
    session = re.fullmatch(r"([a-f0-9]{32})-r[1-9][0-9]*", root.name)
    if session and any(row.get("session_id") == session[1] and row.get("state") in {"queued", "running"}
                       for row in Section("jobs").read().get("collections", {}).get("promo_chat_sessions", [])):
        raise ValueError("Campaign has an active preparation operation")
    for item in plan["retire"]:
        relative = item["relative"]
        path = root / relative
        if path in protected:
            raise ValueError("Registered rendered output cannot be retired")
        if not path.exists() and not path.is_symlink():
            if allow_missing:
                continue
            raise ValueError("Campaign media disappeared before retirement")
        if path.is_symlink() != item["symlink"]:
            raise ValueError("Campaign media type changed")
        if item["symlink"] and os.readlink(path) != item["link_target"]:
            raise ValueError("Campaign media link changed")
        if str(path.resolve(strict=True)) != item["resolved"] or resources.digest(path) != item["sha256"]:
            raise ValueError("Campaign media bytes or target changed")
    for local, ref in plan["project"]["assets"].items():
        # Historical poster snapshots may not exist until publication. Their
        # source bytes must still match, or already exist in the durable store.
        poster = ref.get("poster")
        if isinstance(poster, dict):
            historical = root / ("assets/" + local)
            if historical.is_file():
                if historical.is_symlink() or resources.digest(historical) != poster["sha256"]:
                    raise ValueError("Historical campaign poster changed")
            else:
                resources._resolve_ref(ref)
        else:
            source = resources._resolve_ref(ref)
            expected_path = next((item["resolved"] for item in plan["retire"]
                                  if item["relative"] == "assets/" + local), None)
            if expected_path is None or str(source.resolve()) != expected_path:
                raise ValueError("Registered campaign source identity changed")


def _publish_exact(path: Path, content: bytes, profile: Path) -> None:
    from src.core.nodemotion.shared.retirement import _safe
    _safe(profile, path)
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError("Refusing to overwrite changed campaign publication")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    _safe(profile, path.parent)
    fd, name = tempfile.mkstemp(prefix=".campaign-", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path)
        except FileExistsError:
            if path.is_symlink() or path.read_bytes() != content:
                raise ValueError("Concurrent campaign publication changed")
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def _verify_published(profile: Path, plan: dict) -> list[dict]:
    root = _validate_inputs(profile, plan)
    actual = execution.load_project(root)
    if actual != plan["project"]:
        raise ValueError("Published campaign manifest changed")
    if resources.digest(root / "assets/timeline.json") != plan["inputs"]["assets/lyrics.json"]:
        raise ValueError("Published campaign timeline bytes changed")
    entries = []
    for item in plan["retire"]:
        value = execution.resolve_project(root, item["relative"])
        if not isinstance(value, Path) or resources.digest(value) != item["sha256"]:
            raise ValueError("Published campaign media differs before retirement")
        if not value.resolve().is_relative_to(profile / "resources"):
            raise ValueError("Campaign replacement is not a durable same-profile resource")
        entries.append({**item, "category": "media", "replacement_path": str(value)})
    if not isinstance(execution.resolve_project(root, "index.html"), bytes):
        raise ValueError("Published campaign engine is unavailable")
    return entries


def _unlink_entry(profile: Path, root: Path, item: dict) -> bool:
    """Unlink only the verified link/file through profile-anchored descriptors."""
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    descriptors = []
    source_fd = None
    def signature(value):
        return value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns
    try:
        parent = os.open(profile, flags)
        descriptors.append(parent)
        parts = (*root.relative_to(profile).parts, *Path(_relative(item["relative"])).parts)
        for part in parts[:-1]:
            parent = os.open(part, flags, dir_fd=parent)
            descriptors.append(parent)
        try:
            before = os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            return False
        if item["symlink"]:
            if not stat.S_ISLNK(before.st_mode) or os.readlink(parts[-1], dir_fd=parent) != item["link_target"]:
                raise ValueError("Campaign media link changed immediately before unlink")
        else:
            source_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
            opened = os.fstat(source_fd)
            if not stat.S_ISREG(opened.st_mode) or signature(opened) != signature(before):
                raise ValueError("Campaign poster changed immediately before unlink")
            digest = hashlib.sha256()
            for chunk in iter(lambda: os.read(source_fd, 1024 * 1024), b""):
                digest.update(chunk)
            if digest.hexdigest() != item["sha256"] or signature(os.fstat(source_fd)) != signature(before):
                raise ValueError("Campaign poster bytes changed immediately before unlink")
        named = os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)
        if signature(named) != signature(before):
            raise ValueError("Campaign media changed immediately before unlink")
        os.unlink(parts[-1], dir_fd=parent)
        os.fsync(parent)
        return True
    finally:
        if source_fd is not None:
            os.close(source_fd)
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def apply_campaign_plan(profile: Path, plan: dict, *, retire_verified: bool = False) -> dict:
    """Publish exact refs first; only then retire the reviewed whitelist.

    The caller supplies the reviewed immutable plan. Journals allow retries
    after each publication, section reconciliation or individual unlink.
    """
    from src.core.nodemotion.shared import retirement
    from src.templates._tools.nodemotion.shared.assemble import freeze_engine
    profile = Path(profile).absolute()
    with resources.library_resolution_snapshot():
        root = _validate_inputs(profile, plan)
    path = journal_path(profile, root)
    retirement._safe(profile, path)
    path.parent.mkdir(parents=True, exist_ok=True)
    retirement._safe(profile, path.parent)
    lock = path.with_suffix(".lock")
    fd = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "a+b") as stream:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
            if path.is_file():
                journal = _json(path)
                if journal.get("plan", {}).get("plan_sha256") != plan["plan_sha256"]:
                    raise ValueError("Campaign journal belongs to another reviewed plan")
            else:
                with resources.library_resolution_snapshot():
                    _validate_sources(profile, plan, allow_missing=False)
                journal = {"profile": str(profile), "kind": "nodemotion-campaign-migration",
                           "state": "planned", "plan": plan, "retired": []}
                retirement._atomic_json(path, journal)
            allow_missing = journal["state"] in {"references-updated", "retiring", "complete"}
            with resources.library_resolution_snapshot():
                _validate_sources(profile, plan, allow_missing=allow_missing)
            if journal["state"] == "planned":
                selected = plan["project"]["engine"]["revision"]
                if freeze_engine(plan["design_id"], revision=selected) != selected:
                    raise ValueError("Campaign engine revision changed")
                for local, ref in plan["project"]["assets"].items():
                    if isinstance(ref.get("poster"), dict):
                        historical = root / ("assets/" + local)
                        if historical.is_file():
                            original = {key: value for key, value in ref.items() if key != "poster"}
                            if resources.poster_ref(original, historical=historical) != ref:
                                raise ValueError("Historical poster identity changed during sharing")
                _publish_exact(root / "assets/timeline.json", (root / "assets/lyrics.json").read_bytes(), profile)
                _publish_exact(root / "project.json",
                               json.dumps(plan["project"], ensure_ascii=False, indent=2).encode(), profile)
                journal["state"] = "published"
                retirement._atomic_json(path, journal)
            with resources.library_resolution_snapshot():
                _validate_sources(profile, plan, allow_missing=allow_missing)
                entries = _verify_published(profile, plan)
            if not retire_verified:
                return {"root": str(root), "state": journal["state"], "retired": len(journal["retired"])}
            if journal["state"] == "published":
                reconciliation = {"profile": str(profile), "root": str(root), "entries": entries}
                for section in retirement._SECTIONS:
                    retirement._reconcile_section(section, reconciliation)
                journal["state"] = "references-updated"
                retirement._atomic_json(path, journal)
            # Re-read used library models after publication/reconciliation and
            # before the first unlink. Per-file bytes and link inode guards
            # additionally protect every individual deletion.
            with resources.library_resolution_snapshot():
                _validate_sources(profile, plan, allow_missing=True)
                _verify_published(profile, plan)
            if journal["state"] != "complete":
                journal["state"] = "retiring"
                retirement._atomic_json(path, journal)
                for item in plan["retire"]:
                    if item["relative"] in journal["retired"]:
                        continue
                    _unlink_entry(profile, root, item)
                    journal["retired"].append(item["relative"])
                    retirement._atomic_json(path, journal)
                journal["state"] = "complete"
                retirement._atomic_json(path, journal)
            return {"root": str(root), "state": journal["state"], "retired": len(journal["retired"])}
    except BaseException:
        # fdopen owns the descriptor after entering its with block.
        raise


def resume_campaign(profile: Path, root: Path, *, retire_verified: bool = False) -> dict | None:
    path = journal_path(Path(profile).absolute(), Path(root).absolute())
    if not path.is_file():
        return None
    from src.core.nodemotion.shared.retirement import _safe
    _safe(Path(profile).absolute(), path)
    return apply_campaign_plan(profile, _json(path)["plan"], retire_verified=retire_verified)
