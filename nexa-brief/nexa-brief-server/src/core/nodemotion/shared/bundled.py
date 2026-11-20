"""Content-addressed bundled demo resources and a read-only relocation planner."""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from contextlib import ExitStack
from collections.abc import Iterable
from pathlib import Path, PurePosixPath
from typing import Any

from src.config.settings import settings
from src.core.nodemotion.shared.resources import digest

_RESOURCE = re.compile(r"([0-9a-f]{64})(\.[a-z0-9]{1,12})\Z")
_MEDIA = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg",
    ".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a", ".ogg", ".opus",
    ".woff", ".woff2", ".ttf", ".otf",
}
_KIND_BY_SUFFIX = {
    **{suffix: "image" for suffix in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg")},
    **{suffix: "video" for suffix in (".mp4", ".webm", ".mov")},
    **{suffix: "music" for suffix in (".mp3", ".wav", ".m4a", ".ogg", ".opus")},
}


def _relative(value: str) -> str:
    path = PurePosixPath(value)
    if (not value or "\\" in value or path.is_absolute() or
            any(part in ("", ".", "..") for part in value.split("/"))):
        raise ValueError("Invalid bundled resource path")
    return str(path)


def resource_root() -> Path:
    templates = Path(settings.templates_dir).resolve()
    root = templates / "_tools/nodemotion/shared/resources"
    for part in (root, *root.parents):
        if part == templates:
            break
        if part.is_symlink():
            raise ValueError("Symlink in bundled resource path")
    if not root.resolve().is_relative_to(templates):
        raise ValueError("Bundled resource root escapes templates")
    return root


def resolve_bundled_key(key: str) -> Path:
    """Resolve only a hash-named immutable asset under the configured templates root."""
    if not isinstance(key, str) or not _RESOURCE.fullmatch(key):
        raise ValueError("Invalid bundled resource key")
    root = resource_root()
    path = root / key
    if root.is_symlink() or path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Bundled resource escapes its root")
    if not path.is_file():
        raise FileNotFoundError(f"Bundled resource unavailable: {key}")
    if digest(path) != key[:64]:
        raise ValueError("Bundled resource revision mismatch")
    return path


def bundled_key_for_path(path: Path) -> str | None:
    """Return a validated common resource key, otherwise None for legacy files."""
    root = resource_root()
    path = Path(path)
    if not path.is_absolute():
        return None
    if path.parent.resolve() != root.resolve():
        return None
    resolved = resolve_bundled_key(path.name)
    if resolved.resolve() != path.resolve():
        raise ValueError("Invalid bundled resource path")
    return path.name


def demo_aliases(design_id: str) -> dict[str, str]:
    from src.templates._tools.nodemotion.shared.assemble import design_manifest
    aliases = design_manifest(design_id).get("demo_resource_aliases", {})
    if not isinstance(aliases, dict):
        raise ValueError("Invalid demo resource aliases")
    result = {}
    for relative, key in aliases.items():
        relative = _relative(relative)
        if not isinstance(key, str) or not _RESOURCE.fullmatch(key):
            raise ValueError("Invalid bundled resource key")
        result[relative] = key
    return result


def resolve_demo_resource(design_id: str, relative: str) -> Path | None:
    """Translate an unchanged demo-relative URL into the common resource store."""
    relative = _relative(relative)
    key = demo_aliases(design_id).get(relative)
    return resolve_bundled_key(key) if key is not None else None


def demo_design_for_root(root: Path) -> str | None:
    from src.templates._tools.nodemotion.shared.assemble import design_ids, design_manifest
    templates = Path(settings.templates_dir).resolve()
    target = Path(root).resolve()
    if not target.is_relative_to(templates):
        return None
    for design in design_ids():
        demo = (templates / design_manifest(design)["demo_folder"]).resolve()
        if demo.is_relative_to(templates) and demo == target:
            return design
    return None


def logical_name_for_key(design_id: str, key: str) -> str | None:
    return next((name for name, value in demo_aliases(design_id).items() if value == key), None)


def plan_demo_resources(templates_root: Path, design_ids: list[str] | None = None) -> dict[str, Any]:
    """Read-only SHA-256 inventory. No files, manifests, or media are modified."""
    from src.templates._tools.nodemotion.shared.assemble import design_ids as all_designs, design_manifest
    templates = Path(templates_root).resolve(strict=True)
    rows = []
    for design in sorted(design_ids if design_ids is not None else all_designs()):
        manifest = design_manifest(design)
        relative_demo = _relative(manifest["demo_folder"])
        if not relative_demo.startswith(("nodemotion/lyrics/", "nodemotion/commercial/")):
            raise ValueError("Design is outside the NodeMotion demo families")
        demo = (templates / relative_demo).resolve(strict=True)
        if not demo.is_relative_to(templates):
            raise ValueError("Demo root escapes templates")
        for source in sorted(demo.rglob("*")):
            if source.suffix.lower() not in _MEDIA:
                continue
            if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(demo):
                raise ValueError(f"Invalid demo resource: {source}")
            relative = source.relative_to(demo).as_posix()
            rows.append({"design_id": design, "relative": relative,
                         "source": source.relative_to(templates).as_posix(),
                         "sha256": digest(source), "size": source.stat().st_size,
                         "extension": source.suffix.lower()})
    # Equal bytes always share one canonical file, even across extensions.
    # Reuse existing aliases on later builds so the choice is stable.
    existing_keys: dict[str, str] = {}
    wanted_hashes = {row["sha256"] for row in rows}
    for design in all_designs():
        for key in design_manifest(design).get("demo_resource_aliases", {}).values():
            if not isinstance(key, str) or not _RESOURCE.fullmatch(key):
                raise ValueError("Invalid existing bundled resource key")
            if key[:64] not in wanted_hashes:
                continue
            candidate = _contained_path(templates, "_tools/nodemotion/shared/resources/" + key)
            if not candidate.is_file() or digest(candidate) != key[:64]:
                raise ValueError("Existing bundled resource is missing or changed")
            existing_keys[key[:64]] = min(existing_keys.get(key[:64], key), key)
    suffixes: dict[str, str] = {}
    for row in rows:
        sha, ext = row["sha256"], row["extension"]
        suffixes[sha] = min(suffixes.get(sha, ext), ext)
    aliases: dict[str, dict[str, str]] = {}
    for row in rows:
        key = existing_keys.get(row["sha256"], row["sha256"] + suffixes[row["sha256"]])
        row["key"] = key
        aliases.setdefault(row["design_id"], {})[row["relative"]] = key
        del row["extension"]
    return {"schema_version": 1, "templates_root": str(templates), "resources": rows, "aliases": aliases,
            "unique_bytes": sum(next(row["size"] for row in rows if row["sha256"] == sha) for sha in suffixes)}


async def ensure_design_resources(
    design_id: str,
    relative_paths: Iterable[str] | None = None,
) -> dict[str, dict[str, Any]]:
    """Register bundled demo resources once, optionally limited to selected paths."""
    from src.core.library import asset_library
    from src.core.nodemotion.shared.resources import asset_ref
    from src.templates._tools.nodemotion.shared.assemble import runtime_files
    requested = None if relative_paths is None else set(relative_paths)
    if requested is None:
        files = runtime_files(design_id)
    else:
        files = {
            relative: path
            for relative in sorted(requested)
            if (path := resolve_demo_resource(design_id, relative)) is not None
        }
    refs: dict[str, dict[str, Any]] = {}
    known: dict[tuple[str, str], Any] = {}
    for relative, path in files.items():
        key = bundled_key_for_path(path)
        kind = _KIND_BY_SUFFIX.get(Path(relative).suffix.lower())
        if key is None or kind is None:
            continue
        identity = (kind, key)
        if identity not in known:
            known[identity] = await asset_library.register_bundled_resource(kind, design_id, key, relative)
        refs[relative] = asset_ref(kind, known[identity].asset_id)
    return refs



def _contained_path(root: Path, relative: str) -> Path:
    relative = _relative(relative)
    path = root / relative
    for parent in (path, *path.parents):
        if parent == root:
            break
        if parent.is_symlink():
            raise ValueError("Symlink in relocation path")
    if not path.resolve().is_relative_to(root):
        raise ValueError("Relocation path escapes templates")
    return path


def _sync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def apply_demo_resource_plan(plan: dict[str, Any], retire_verified: bool = True, *,
                             allow_alias_updates: bool = False,
                             expected_revisions: dict[str, str] | None = None) -> dict[str, int]:
    """Publish verified shared hardlinks, aliases, then retire only planned source links.

    The plan is untrusted input. All sources are verified before the first write.
    A partial failure retains any unretired originals and can be resumed safely.
    """
    from src.templates._tools.nodemotion.shared import assemble as engines
    templates = Path(settings.templates_dir).resolve()
    if (not isinstance(plan, dict) or plan.get("schema_version") != 1 or
            Path(plan.get("templates_root", "")).resolve() != templates or
            Path(engines.TEMPLATES).resolve() != templates):
        raise ValueError("Plan targets a different templates root")
    rows, aliases = plan.get("resources"), plan.get("aliases")
    if not isinstance(rows, list) or not isinstance(aliases, dict):
        raise ValueError("Invalid resource relocation plan")
    designs = sorted(aliases)
    if any(not isinstance(item, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", item) for item in designs):
        raise ValueError("Invalid relocation design")
    with ExitStack() as stack:
        for design in designs:
            stack.enter_context(engines._engine_lock(design))
        manifests = {design: engines.design_manifest(design) for design in designs}
        manifest_paths = {}
        for design in designs:
            path = engines._design_root(design) / "manifest.json"
            if not path.is_relative_to(templates):
                raise ValueError("Engine manifest escapes templates")
            manifest_paths[design] = _contained_path(templates, path.relative_to(templates).as_posix())
        if allow_alias_updates:
            if not expected_revisions or set(expected_revisions) != set(designs):
                raise ValueError("Alias updates require archived engine revisions")
            for design in designs:
                if (not engines.available_revision(design, expected_revisions[design]) or
                        engines.engine_revision(design) != expected_revisions[design]):
                    raise ValueError("Engine changed before alias update")
        validated = []
        seen = set()
        expected_aliases: dict[str, dict[str, str]] = {design: {} for design in designs}
        root = resource_root()
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("Invalid resource row")
            design, relative, source_name = row.get("design_id"), row.get("relative"), row.get("source")
            key, expected, size = row.get("key"), row.get("sha256"), row.get("size")
            if design not in manifests or not isinstance(relative, str) or not isinstance(source_name, str):
                raise ValueError("Invalid resource identity")
            relative = _relative(relative)
            demo = _relative(manifests[design]["demo_folder"])
            if source_name != f"{demo}/{relative}" or source_name in seen:
                raise ValueError("Resource does not belong to its design")
            seen.add(source_name)
            if (not isinstance(key, str) or not _RESOURCE.fullmatch(key) or key[:64] != expected or
                    type(size) is not int or size < 0 or Path(relative).suffix.lower() not in _MEDIA):
                raise ValueError("Invalid resource fingerprint")
            if relative in expected_aliases[design]:
                raise ValueError("Duplicate demo resource path")
            expected_aliases[design][relative] = key
            source = _contained_path(templates, source_name)
            target = _contained_path(templates, "_tools/nodemotion/shared/resources/" + key)
            existing_alias = manifests[design].get("demo_resource_aliases", {}).get(relative)
            if existing_alias is not None and existing_alias != key and not allow_alias_updates:
                raise ValueError("Conflicting existing demo resource alias")
            if source.exists() and (not source.is_file() or source.stat().st_size != size or digest(source) != expected):
                raise ValueError("Source resource changed after planning")
            if target.exists() and (not target.is_file() or target.stat().st_size != size or digest(target) != expected):
                raise ValueError("Shared resource conflicts with plan")
            if not source.exists() and not target.exists():
                raise FileNotFoundError(f"Both resource copies are missing: {source_name}")
            validated.append((design, relative, source, target, expected, size))
        if expected_aliases != aliases:
            raise ValueError("Plan aliases do not match resource rows")
        root.mkdir(parents=True, exist_ok=True)
        if root.is_symlink():
            raise ValueError("Invalid shared resource root")
        # Require hardlinks on one filesystem: no large temporary copies.
        root_device = root.stat().st_dev
        if any(source.exists() and source.stat().st_dev != root_device for _, _, source, _, _, _ in validated):
            raise ValueError("Source and shared resources must be on one filesystem")
        created = 0
        for _, _, source, target, expected, size in validated:
            if not target.exists():
                if not source.is_file() or source.stat().st_size != size or digest(source) != expected:
                    raise ValueError("Source resource changed before linking")
                try:
                    os.link(source, target, follow_symlinks=False)
                    created += 1
                except FileExistsError:
                    pass
            if target.is_symlink() or not target.is_file() or target.stat().st_size != size or digest(target) != expected:
                raise ValueError("Shared resource failed verification")
        if created:
            _sync_directory(root)
        for design in designs:
            manifest = manifests[design]
            manifest["demo_resource_aliases"] = {**manifest.get("demo_resource_aliases", {}), **aliases[design]}
            path = manifest_paths[design]
            fd, name = tempfile.mkstemp(prefix=".resources-", suffix=".tmp", dir=path.parent)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as stream:
                    json.dump(manifest, stream, ensure_ascii=False, indent=2)
                    stream.write("\n")
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(name, path)
                _sync_directory(path.parent)
            finally:
                Path(name).unlink(missing_ok=True)
        for design, relative, _, target, expected, _ in validated:
            resolved = resolve_demo_resource(design, relative)
            if resolved != target or digest(resolved) != expected:
                raise ValueError("Published demo alias failed verification")
        retired = 0
        retired_directories: set[Path] = set()
        if retire_verified:
            for _, _, source, target, expected, size in validated:
                if not source.exists():
                    continue
                if (source.is_symlink() or not source.is_file() or source.stat().st_size != size or
                        digest(source) != expected or digest(target) != expected):
                    raise ValueError("Source resource changed before retirement")
                source.unlink()
                retired_directories.add(source.parent)
                retired += 1
            for directory in retired_directories:
                _sync_directory(directory)
        return {"resources": len(validated), "linked": created, "retired": retired}


def publish_generated_resources(design_id: str) -> dict[str, int]:
    """Re-home new compiler media only after archiving the previous engine."""
    from src.templates._tools.nodemotion.shared import assemble as engines
    if not demo_aliases(design_id):
        return {"resources": 0, "linked": 0, "retired": 0}
    plan = plan_demo_resources(Path(settings.templates_dir), [design_id])
    if not plan["resources"]:
        return {"resources": 0, "linked": 0, "retired": 0}
    revision = engines.freeze_engine(design_id)
    return apply_demo_resource_plan(plan, allow_alias_updates=True, expected_revisions={design_id: revision})


def main() -> None:
    parser = argparse.ArgumentParser(description="Inventory or relocate shared NodeMotion demo resources")
    parser.add_argument("--templates-root", type=Path, required=True)
    parser.add_argument("--design", action="append", dest="designs")
    parser.add_argument("--plan", type=Path, help="Read a previously generated relocation plan")
    parser.add_argument("--apply", action="store_true", help="Apply and verify the supplied plan")
    parser.add_argument("--keep-originals", action="store_true", help="Publish shared aliases without retiring sources")
    args = parser.parse_args()
    if args.apply:
        if not args.plan or args.design:
            parser.error("--apply requires --plan and does not accept --design")
        plan = json.loads(args.plan.read_text(encoding="utf-8"))
        if Path(args.templates_root).resolve() != Path(settings.templates_dir).resolve():
            parser.error("--templates-root must be the configured templates directory")
        result = apply_demo_resource_plan(plan, retire_verified=not args.keep_originals)
    else:
        if args.plan or args.keep_originals:
            parser.error("--plan and --keep-originals require --apply")
        result = plan_demo_resources(args.templates_root, args.designs)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
