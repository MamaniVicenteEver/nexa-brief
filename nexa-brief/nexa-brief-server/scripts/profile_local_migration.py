"""Offline, journalled, same-profile v1 -> v2 migration.

Credential directories are moved opaquely, never copied or opened. JSON is
staged separately. All paths in the private journal are profile-relative.
"""
from __future__ import annotations

import fcntl
import hashlib
import importlib.util
import json
import os
import posixpath
import re
import shutil
import stat
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
SECRET = re.compile(r"(^\.env($|\.)|^accounts\.json$|^users\.json$|^client_secret|token|credential|secret|oauth|password|passwd|cookie|session|private|api[_-]?key|access[_-]?key|\.(pem|key|p12|pfx)$)", re.I)
ACTIVE = {"creating", "producing", "finishing", "recording", "running", "publishing", "uploading"}
OPAQUE_DATA_DIRS = {"browser_profiles": ".system/browser-profiles"}


def root_path(value: str) -> Path:
    root = Path(value).expanduser()
    if not root.is_absolute() or not root.is_dir():
        raise ValueError("El perfil debe ser un directorio absoluto existente")
    for p in (root, *root.parents):
        if p.is_symlink():
            raise ValueError("No se admiten raíces ni ancestros symlink")
    return root


def safe_path(root: Path, key: str) -> Path:
    rel = Path(key)
    if rel.is_absolute() or not rel.parts or any(p in (".", "..") for p in rel.parts):
        raise ValueError("Ruta de migración inválida")
    p = root / rel
    for part in (p, *p.parents):
        if part.is_symlink():
            raise ValueError("Symlink en ruta de migración")
        if part == root:
            return p
    raise ValueError("Ruta fuera del perfil")


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(prefix=".migration-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(value, out, ensure_ascii=False, indent=2)
            out.write("\n")
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
        fsync_dir(path.parent)
    finally:
        Path(tmp).unlink(missing_ok=True)


def fsync_dir(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


@contextmanager
def exclusive(root: Path):
    directory = safe_path(root, ".system/migrations")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    safe_path(root, ".system/migrations")
    fd = os.open(directory / ".lock", os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally:
        os.close(fd)


def inventory(directory: Path, *, opaque_data: Path | None = None) -> tuple[str, int]:
    """Seal ordinary files by content; opaque files use metadata only."""
    h = hashlib.sha256()
    count = 0
    if opaque_data is None:
        opaque_data = directory
    if not directory.exists():
        return h.hexdigest(), 0
    for current, dirs, files in os.walk(directory, followlinks=False):
        dirs.sort()
        files.sort()
        for name in dirs + files:
            p = Path(current) / name
            st = p.lstat()
            if Path(current) == opaque_data and name in OPAQUE_DATA_DIRS and not stat.S_ISDIR(st.st_mode):
                raise ValueError("La raíz de sesiones de navegador no es un directorio")
            if stat.S_ISLNK(st.st_mode) or not (stat.S_ISREG(st.st_mode) or stat.S_ISDIR(st.st_mode)):
                raise ValueError("Se encontró symlink o archivo especial en data")
            h.update((str(p.relative_to(directory)) + "\0" + str(st.st_ino) + ":" + str(st.st_size) + ":" + str(st.st_mtime_ns)).encode())
            if stat.S_ISREG(st.st_mode) and not any(SECRET.search(part) for part in p.relative_to(directory).parts):
                with p.open("rb") as src:
                    for chunk in iter(lambda: src.read(1024 * 1024), b""):
                        h.update(chunk)
            count += 1
        # Browser sessions are an opaque tree: even walking their names can
        # expose private state. Only the root directory's lstat is recorded.
        if Path(current) == opaque_data:
            dirs[:] = [name for name in dirs if name not in OPAQUE_DATA_DIRS]
    return h.hexdigest(), count


def sandbox_inventory(root: Path) -> str | None:
    """Fingerprint only metadata; never open Sandbox content or private subtrees."""
    directory = safe_path(root, "sandbox")
    if not directory.exists():
        return None
    if not directory.is_dir():
        raise ValueError("El sandbox existente no es un directorio")
    digest = hashlib.sha256()
    for current, dirs, files in os.walk(directory, followlinks=False):
        dirs.sort()
        files.sort()
        for name in dirs + files:
            path = Path(current) / name
            st = path.lstat()
            if stat.S_ISLNK(st.st_mode) or not (stat.S_ISDIR(st.st_mode) or stat.S_ISREG(st.st_mode)):
                raise ValueError("El sandbox contiene symlinks o archivos especiales")
            if st.st_dev != root.stat().st_dev:
                raise ValueError("Las raíces deben estar en el mismo sistema de archivos")
            digest.update(f"{path.relative_to(directory)}\0{st.st_ino}:{st.st_size}:{st.st_mtime_ns}".encode())
        # Opaque private or hidden directories are never traversed.
        dirs[:] = [name for name in dirs if not name.startswith(".") and not SECRET.search(name)]
    st = directory.lstat()
    digest.update(f"root\0{st.st_ino}:{st.st_size}:{st.st_mtime_ns}".encode())
    return digest.hexdigest()


def sandbox_merge_plan(source: Path, target: Path) -> list[Path]:
    """Move disjoint subtrees only; reject collisions before any rename."""
    result = []
    def visit(left: Path, right: Path, relative: Path) -> None:
        for item in sorted(left.iterdir()):
            dest = right / item.name
            if item.is_symlink() or dest.is_symlink():
                raise ValueError("El sandbox contiene symlinks")
            rel = relative / item.name
            if not dest.exists():
                result.append(rel)
            elif item.is_dir() and dest.is_dir() and not item.name.startswith(".") and not SECRET.search(item.name):
                visit(item, dest, rel)
            else:
                raise ValueError("Colisión entre sandbox del perfil y plantillas; no se sobrescribió nada")
    visit(source, target, Path())
    return result


def manifest_v1(root: Path) -> dict:
    p = safe_path(root, "profile.json")
    data = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or type(data.get("schema_version")) is not int or data["schema_version"] != 1:
        raise ValueError("Se requiere un manifiesto v1 válido")
    if not isinstance(data.get("id"), str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,47}", data["id"]):
        raise ValueError("Identidad de perfil inválida")
    return data


def list_data(root: Path):
    data = root / "data"
    if not data.exists():
        return []
    inventory(data)
    files = []
    for current, dirs, names in os.walk(data, followlinks=False):
        if Path(current) == data:
            dirs[:] = [name for name in dirs if name not in OPAQUE_DATA_DIRS]
        files.extend(Path(current) / name for name in names)
    return sorted(files)


def data_destination(rel: Path, *, target_version: int = 2) -> Path | None:
    parts = rel.parts
    if rel.as_posix() in {"image_posts/access.json", "image_posts/account_map.json"}:
        return Path(".system/connections/image-posts") / rel.name
    if any(SECRET.search(p) for p in parts):
        return Path(".system/private/legacy-data") / rel
    if len(parts) >= 4 and parts[:2] == ("library", "files") and parts[2] in {"images", "music", "sounds", "videos"}:
        return Path("resources") / parts[2] / Path(*parts[3:])
    if parts[:2] == ("media-cache", "reel_music") and rel.suffix.lower() == ".mp3":
        return Path("resources/reel_music") / Path(*parts[2:])
    if parts and parts[0] == "publicaciones" and rel.suffix.lower() != ".json":
        return Path("productions/_publicaciones") / Path(*parts[1:])
    if parts and parts[0] == "video_backups":
        return Path(".system/runtime/video_backups") / Path(*parts[1:])
    if parts and parts[0] == "runtime":
        return Path(".system/runtime/legacy-runtime") / Path(*parts[1:])
    if parts and parts[0] == "sandbox-thumbs":
        return Path(".system/cache/sandbox-thumbs") / Path(*parts[1:])
    if parts[:2] == ("library", "cache"):
        if (target_version >= 3 and len(parts) == 4
                and parts[2] in {"image_vision", "video_vision", "lyrics"}
                and rel.suffix == ".json" and not rel.name.startswith(".")):
            return None
        return Path(".system/cache/library") / Path(*parts[2:])
    if parts[:2] == ("prototypes", "logs"):
        return Path("logs/prototypes") / Path(*parts[2:])
    if parts and parts[0] == "agent_logs":
        return Path("logs/agents") / Path(*parts[1:])
    if parts[:2] == ("explainer", "logs"):
        return Path("logs/explainer") / Path(*parts[2:])
    if parts and parts[0] == "model-calls":
        return Path("logs/model-calls") / Path(*parts[1:])
    if rel.suffix == ".json" and not rel.name.startswith("."):
        return None
    return Path(".system/runtime/legacy-data") / rel


def load_json(path: Path):
    # Caller has already filtered credential names and all symlinks.
    with path.open(encoding="utf-8") as src:
        return json.load(src)


def mapping_for(root: Path, files: list[Path], *, target_version: int = 2):
    mappings = {}
    for name, destination in OPAQUE_DATA_DIRS.items():
        source = safe_path(root, f"data/{name}")
        if source.exists():
            if not source.is_dir():
                raise ValueError("La raíz de sesiones de navegador no es un directorio")
            safe_path(root, destination)
            mappings[f"data/{name}"] = destination
    for source in files:
        rel = source.relative_to(root / "data")
        dest = data_destination(rel, target_version=target_version)
        if dest is not None:
            mappings["data/" + rel.as_posix()] = dest.as_posix()
    for old, new in (("output", "renders"), ("connections", ".system/connections"),
                     ("tiktok", ".system/tiktok"), ("web-data", ".system/web-data")):
        if (root / old).exists():
            mappings[old] = new
    return mappings


def validate_legacy_roots(values) -> tuple[str, ...]:
    """Validate operator-declared historical server roots without opening them."""
    roots = []
    for value in values:
        if not isinstance(value, str) or not value.startswith('/') or any(p in ('.', '..') for p in value.split('/')):
            raise ValueError('Raíz legacy inválida')
        path = Path(value)
        if str(path) != value or (value != '/app' and (path.name != 'nexa-brief-server' or len(path.parts) < 4)):
            raise ValueError('Raíz legacy debe ser un checkout de servidor explícito')
        if any(part.is_symlink() for part in (path, *path.parents)):
            raise ValueError('Raíz legacy contiene symlink')
        if value not in roots:
            roots.append(value)
    return tuple(roots)


def rewrite(value, root: Path, mapping: dict[str, str], template_root: Path | None = None, *, legacy_roots=(), provenance=None, provenance_source=None, _compiled=None):
    # A transcript or geometry document can contain thousands of ordinary strings.
    # Compile the small URL table once per document; exact file references use
    # the dict directly instead of scanning every imported file for every word.
    if _compiled is None:
        _compiled = (
            tuple((source[5:], destination) for source, destination in mapping.items() if source.startswith("@url:")),
            tuple(sorted(mapping.items(), key=lambda pair: len(pair[0]), reverse=True)),
        )
    if isinstance(value, list):
        return [rewrite(v, root, mapping, template_root, legacy_roots=legacy_roots, provenance=provenance, provenance_source=provenance_source, _compiled=_compiled) for v in value]
    if isinstance(value, dict):
        return {k: rewrite(v, root, mapping, template_root, legacy_roots=legacy_roots, provenance=provenance, provenance_source=provenance_source, _compiled=_compiled) for k, v in value.items()}
    if not isinstance(value, str):
        return value
    for legacy in legacy_roots:
        for suffix, destination in (('/output', root / 'output'), ('/data', root / 'data'),
                                    ('/src/templates', template_root)):
            prefix = legacy + suffix
            if destination is not None and (value == prefix or value.startswith(prefix + '/')):
                parts = value[len(prefix):].split('/')
                if any(part in ('.', '..') for part in parts):
                    raise ValueError('Referencia legacy insegura')
                normalized = str(destination) + value[len(prefix):]
                return rewrite(normalized, root, mapping, template_root, legacy_roots=(),
                               provenance=provenance, provenance_source=provenance_source, _compiled=_compiled)
    for prefix, destination in _compiled[0]:
        if value == prefix or value.startswith(prefix + "/") or value.startswith(prefix + "?") or value.startswith(prefix + "#"):
            return destination + value[len(prefix):]
    if value.startswith("/") and value in mapping:
        return str(root / mapping[value])
    if template_root and (value == str(template_root) or value.startswith(str(template_root) + "/")):
        rel = value[len(str(template_root)):].lstrip("/")
        parts = Path(rel).parts
        if any(p in (".", "..") for p in parts):
            raise ValueError("Referencia de plantilla insegura")
        if parts and parts[0] == "sandbox":
            return str(root / "sandbox" / Path(*parts[1:]))
        if len(parts) > 1 and not parts[0].startswith((".", "_")) and "muestras" not in parts:
            return str(root / "productions" / Path(*parts))
        return value
    if value.startswith(("/home/", "/tmp/", "/var/", "/mnt/", "/srv/", "/app/")) and not (
        value == str(root) or value.startswith(str(root) + "/") or
        any(value == prefix or value.startswith(prefix + "/") for prefix in ("/app/data", "/app/output", "/app/accounts"))
    ):
        if provenance is not None and provenance_source is not None:
            provenance.append({'source': provenance_source, 'value_sha256': hashlib.sha256(value.encode()).hexdigest(),
                               'state': 'external_unresolved'})
            return value
        raise ValueError("Referencia absoluta externa no resuelta")
    roots = ((str(root), ""), ("/app/output", "output"), ("/app/data", "data"), ("/app/accounts", "connections"))
    for prefix, old in roots:
        if value != prefix and not value.startswith(prefix + "/"):
            continue
        rel = old + value[len(prefix):]
        rel = rel.lstrip("/")
        if any(part in ("..", ".") for part in Path(rel).parts):
            raise ValueError("Referencia absoluta insegura en JSON")
        for source, destination in _compiled[1]:
            if rel == source or rel.startswith(source + "/"):
                rel = destination + rel[len(source):]
                break
        return str(root / rel)
    return value


def read_records(path: Path) -> list[dict]:
    if not path.exists():
        return []
    value = load_json(path)
    if not isinstance(value, list) or any(not isinstance(x, dict) for x in value):
        raise ValueError("Colección de registros inválida")
    return value


def channels_snapshot(root: Path) -> tuple[list[dict], str | None]:
    path = safe_path(root, "connections/channels.json")
    if not path.exists():
        return [], None
    value = read_records(path)
    def check(obj):
        if isinstance(obj, dict):
            for key, child in obj.items():
                if SECRET.search(str(key)):
                    raise ValueError("La metadata de canales contiene campos privados; concilie antes de migrar")
                check(child)
        elif isinstance(obj, list):
            for child in obj:
                check(child)
    check(value)
    return value, hashlib.sha256(path.read_bytes()).hexdigest()


def merge_channels(staged_data: Path, rows: list[dict]) -> None:
    if not rows:
        return
    path = staged_data / "canales/channels.json"
    merged = {}
    for row in read_records(path) + rows:
        key = (row.get("platform"), row.get("alias"))
        if not all(isinstance(item, str) and item for item in key):
            raise ValueError("Identidad de canal inválida")
        merged[key] = {**merged.get(key, {}), **row}
    atomic_json(path, list(merged.values()))


def prepare_indexes(root: Path, staged_data: Path, mappings: dict[str, str], staged_productions: Path, discoveries: dict[str, tuple[str, str]]) -> None:
    """Build v2 identities from known records without reading source templates."""
    prod_path = staged_data / "explainer/productions.json"
    rows = read_records(prod_path)
    videos: dict[str, dict] = {}
    logs = read_records(staged_data / "logs/index.json")
    log_keys = {entry.get("key") for entry in logs}
    for row in rows:
        video, production = row.get("video_id"), row.get("production_id")
        folder = row.get("folder")
        inferred = folder is None or folder == ""
        if inferred and isinstance(video, str) and ID.fullmatch(video) and video in discoveries:
            # Only the unique, operator-owned source identified in the plan may
            # supply a missing folder. Never manufacture an unknown production.
            folder = discoveries[video][0]
            category = row.get("category_path")
            known = {"node_tech": "nodetech", "node_history": "nodehistory", "node_action": "nodeaction",
                     "node_politics": "nodepolitics", "node_economy": "nodeeconomy",
                     "node_motion": "nodemotion", "node_atlas": "nodeatlas"}
            category_root = category.split("/", 1)[0] if isinstance(category, str) else ""
            if category_root in known and known[category_root] != folder:
                raise ValueError("Categoría incompatible con producción descubierta")
            if not (staged_productions / folder / video).is_dir():
                raise ValueError("Origen de producción descubierta ausente")
            row["folder"] = folder
        if not all(isinstance(v, str) and ID.fullmatch(v) for v in (video, production, folder)):
            raise ValueError("Identidad inválida en producción")
        if video in videos and videos[video]["production_id"] != production:
            raise ValueError("Un video está asociado a varias producciones")
        videos[video] = {"video_id": video, "production_id": production}
        details = {"title": row.get("topic", ""), "category_id": row.get("category_path", ""),
                   "design_id": row.get("design", ""), "folder_key": f"productions/{folder}/{video}",
                   "status": row.get("state", ""), "source_missing": not (staged_productions / folder / video).is_dir()}
        if inferred:
            details["legacy_folder_inferred"] = True
        atomic_json(staged_data / "content/video_details" / f"{video}.json", details)
        old_log = f"data/explainer/logs/{production}.log"
        if old_log in mappings:
            key = mappings[old_log]
            ident = hashlib.sha256(key.encode()).hexdigest()
            row["log_id"] = ident
            row["log_path"] = str(root / key)
            if key not in log_keys:
                logs.append({"log_id": ident, "key": key, "kind": "production", "production_id": production, "video_id": video})
                log_keys.add(key)
    for video, (folder, status) in discoveries.items():
        if video in videos:
            continue
        relative = f"{folder}/{video}"
        profile_id = manifest_v1(root)["id"]
        production = "legacy-" + str(uuid.uuid5(uuid.NAMESPACE_URL, f"nexa-profile:{profile_id}:{relative}"))
        videos[video] = {"video_id": video, "production_id": production}
        atomic_json(staged_data / "content/video_details" / f"{video}.json", {
            "title": video, "folder_key": f"productions/{relative}", "status": status,
            "legacy_source": relative, "legacy_id": video,
        })
    resources = read_records(staged_data / "content/resources.json")
    resource_ids = {entry.get("asset_id") for entry in resources}
    details_cache = {}
    for source, key in mappings.items():
        parts = Path(key).parts
        if not source.startswith("/") or len(parts) != 4 or parts[0] != "renders" or parts[2] != "legacy-template":
            continue
        video = parts[1]
        if video not in videos:
            raise ValueError("Un master heredado no tiene identidad de producción; concilie antes de migrar")
        asset = hashlib.sha256(f"{video}:{key}".encode()).hexdigest()
        if asset not in resource_ids:
            resources.append({"asset_id": asset, "video_id": video, "storage_key": key, "kind": "video"})
            resource_ids.add(asset)
        details = details_cache.setdefault(video, load_json(staged_data / "content/video_details" / f"{video}.json"))
        recording_id = "legacy-" + hashlib.sha256(source.encode()).hexdigest()[:16]
        details.setdefault("recordings", {})[recording_id] = {"recording_id": recording_id, "asset_ids": [asset], "source": "legacy-template"}
    for job in read_records(staged_data / "jobs/jobs.json"):
        video, job_id = job.get("video_id"), job.get("job_id")
        if job.get("source") != "explainer" or video not in videos or not isinstance(job_id, str) or not ID.fullmatch(job_id):
            continue
        outputs = []
        for field in ("file_paths", "format_paths"):
            entries = job.get(field) or {}
            if not isinstance(entries, dict):
                raise ValueError("Referencias de salida inválidas")
            for value in entries.values():
                if not isinstance(value, str):
                    continue
                path = Path(value)
                render_root = root / "renders"
                if not path.is_absolute() or not path.is_relative_to(render_root):
                    continue
                rel = path.relative_to(root).as_posix()
                old = root / "output" / path.relative_to(render_root)
                if not old.is_file() or old.is_symlink():
                    continue
                asset = hashlib.sha256(f"{video}:{rel}".encode()).hexdigest()
                if asset not in resource_ids:
                    resources.append({"asset_id": asset, "video_id": video, "storage_key": rel,
                                      "kind": "video" if path.suffix.lower() in {".mp4", ".webm", ".mov"} else "image"})
                    resource_ids.add(asset)
                if asset not in outputs:
                    outputs.append(asset)
        if outputs:
            details = details_cache.setdefault(video, load_json(staged_data / "content/video_details" / f"{video}.json"))
            details.setdefault("recordings", {})[job_id] = {"recording_id": job_id, "asset_ids": outputs}
    for video, details in details_cache.items():
        atomic_json(staged_data / "content/video_details" / f"{video}.json", details)
    if resources:
        atomic_json(staged_data / "content/resources.json", resources)
    if rows:
        atomic_json(prod_path, rows)
    if videos:
        existing = read_records(staged_data / "content/videos.json")
        for entry in existing:
            key = entry.get("video_id")
            if key in videos and entry.get("production_id") != videos[key]["production_id"]:
                raise ValueError("Conflicto en índice de videos")
            videos.setdefault(key, entry)
        atomic_json(staged_data / "content/videos.json", list(videos.values()))
    if logs:
        atomic_json(staged_data / "logs/index.json", logs)


def build_mapping(root: Path, files: list[Path], *, target_version: int = 2) -> dict[str, str]:
    mapping = mapping_for(root, files, target_version=target_version)
    productions = root / "data/explainer/productions.json"
    for row in read_records(productions):
        production, video = row.get("production_id"), row.get("video_id")
        if isinstance(production, str) and ID.fullmatch(production) and isinstance(video, str) and ID.fullmatch(video):
            old = f"data/explainer/logs/{production}.log"
            if old in mapping:
                mapping[old] = f"logs/videos/{video}/{production}.log"
            prefix = f"data/explainer/logs/{production}."
            for key in tuple(mapping):
                if key.startswith(prefix):
                    mapping[key] = f"logs/videos/{video}/" + Path(key).name
    return mapping


def template_files(templates: Path):
    """Yield only user-owned category/sandbox content, excluding bundled samples and secrets."""
    for category in sorted(templates.iterdir()):
        if category.name.startswith((".", "_")) or SECRET.search(category.name):
            continue
        if category.is_symlink():
            raise ValueError("Symlink en plantillas")
        if not category.is_dir() or not ID.fullmatch(category.name):
            continue
        for current, dirs, files in os.walk(category, followlinks=False):
            dirs[:] = [name for name in dirs if name not in {"muestras", "node_modules", "venv"} and not name.startswith((".", "_")) and not SECRET.search(name)]
            for name in list(dirs):
                if (Path(current) / name).is_symlink():
                    link = Path(current) / name
                    if "work" in link.relative_to(templates).parts or "referencias" in link.relative_to(templates).parts:
                        dirs.remove(name)
                    else:
                        raise ValueError("Symlink de directorio en plantillas")
            for name in files:
                if name.startswith(".") or SECRET.search(name):
                    continue
                source = Path(current) / name
                if source.is_symlink():
                    if "work" in source.relative_to(templates).parts:
                        continue
                    resolved = source.resolve(strict=True)
                    if (not resolved.is_relative_to(templates.resolve())
                            or any(SECRET.search(p) for p in resolved.relative_to(templates).parts)
                            or not resolved.is_file()):
                        raise ValueError("Enlace de plantilla fuera de fuentes autorizadas")
                if not stat.S_ISREG(source.stat().st_mode):
                    raise ValueError("Symlink o archivo especial en plantillas")
                rel = source.relative_to(templates)
                if rel.parts[0] == "sandbox":
                    target = Path("sandbox") / Path(*rel.parts[1:])
                elif len(rel.parts) >= 4 and rel.parts[2] == "render":
                    category, video = rel.parts[:2]
                    tail = Path(*rel.parts[3:])
                    preview = any("preview" in p.lower() for p in tail.parts)
                    if not preview and len(tail.parts) == 1 and source.suffix.lower() in {".mp4", ".mov", ".webm", ".mkv"}:
                        target = Path("render-import") / video / "legacy-template" / tail
                    elif source.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and not preview:
                        target = Path("productions") / category / video / "assets/thumbnails" / tail
                    else:
                        target = Path("productions") / category / video / "work/results/test/legacy-render" / tail
                else:
                    target = Path("productions") / rel
                yield source, target


def discover_template_videos(templates: Path, root: Path) -> dict[str, tuple[str, str]]:
    """Find independently owned videos, rejecting ambiguous cross-category IDs."""
    found: dict[str, tuple[str, str]] = {}
    known = {}
    for row in read_records(root / "data/explainer/productions.json"):
        video, folder = row.get("video_id"), row.get("folder")
        if isinstance(video, str) and isinstance(folder, str):
            if video in known and known[video] != folder:
                raise ValueError("Conflicto de video_id entre categorías")
            known[video] = folder
    for category in sorted(templates.iterdir()):
        if category.is_symlink():
            raise ValueError("Symlink en plantillas")
        if not category.is_dir() or category.name == "sandbox" or not ID.fullmatch(category.name) or SECRET.search(category.name):
            continue
        for folder in sorted(category.iterdir()):
            if folder.is_symlink():
                raise ValueError("Symlink en plantillas")
            if not folder.is_dir() or folder.name == "muestras" or not ID.fullmatch(folder.name):
                continue
            manifest = folder / "manifest.json"
            index = folder / "index.html"
            if not manifest.is_file() and not index.is_file():
                continue
            if manifest.is_symlink() or index.is_symlink():
                raise ValueError("Symlink en plantillas")
            if folder.name in found or (folder.name in known and known[folder.name] != category.name):
                raise ValueError("Conflicto de video_id entre categorías")
            status = "unknown"
            if manifest.is_file():
                data = load_json(manifest)
                if not isinstance(data, dict):
                    raise ValueError("Manifiesto de video inválido")
                if isinstance(data.get("status"), str) and data["status"]:
                    status = data["status"]
            found[folder.name] = (category.name, status)
    return found


def check_active(root: Path) -> None:
    for key in ("data/explainer/productions.json", "data/prototypes/runs.json", "data/jobs/jobs.json"):
        for row in read_records(root / key):
            state = row.get("state") or row.get("stage")
            if isinstance(state, str) and state.lower() in ACTIVE:
                raise ValueError("Hay registros de trabajo activo; concilie antes de migrar")


def scaffold_content(staged: Path) -> None:
    """Reuse the versioned profile initializer's categories and agent guides."""
    script = Path(__file__).resolve().parents[2] / "scripts/storage-profile.py"
    spec = importlib.util.spec_from_file_location("nexa_profile_initializer", script)
    initializer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(initializer)
    production = staged / "productions"
    sandbox = staged / "sandbox"
    for name in ("AGENTS.md", "CLAUDE.md"):
        for directory, guide in ((production, initializer.PRODUCTION_GUIDE), (sandbox, initializer.SANDBOX_GUIDE)):
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            if not (directory / name).exists():
                (directory / name).write_text(guide, encoding="utf-8")
        for category in initializer.production_categories():
            directory = production / category
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            if not (directory / name).exists():
                (directory / name).write_text(f"# Categoría {category}\n\n" + initializer.PRODUCTION_GUIDE.split("\n", 1)[1], encoding="utf-8")
        for category in initializer.CATEGORIES:
            directory = sandbox / category
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            if not (directory / name).exists():
                (directory / name).write_text(initializer.SANDBOX_GUIDE, encoding="utf-8")
            (sandbox / "referencias" / category).mkdir(parents=True, exist_ok=True, mode=0o700)


def stage_config_defaults(root: Path, staged: Path) -> None:
    """Install missing versioned catalog defaults without replacing profile overrides."""
    server = Path(__file__).resolve().parents[1]
    defaults = [(server / "niches.json", Path("niches.json"))]
    styles = server / "src/skills/image_posts/styles"
    defaults.extend((p, Path("image-styles") / p.relative_to(styles)) for p in styles.rglob("*") if p.is_file())
    for source, relative in defaults:
        destination = safe_path(root, (Path("config") / relative).as_posix())
        if destination.exists():
            if not destination.is_file():
                raise ValueError("Una configuración existente no es un archivo")
            continue
        target = staged / "config-defaults" / relative
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        shutil.copyfile(source, target)
        if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
            raise ValueError("Falló la verificación de defaults")


def rewrite_template_text(path: Path, destination: Path, mapping: dict[str, str]) -> None:
    """Retarget literal engine and same-profile resource URLs in text sources."""
    text = path.read_text(encoding="utf-8")
    engine = posixpath.relpath("_tools", destination.parent.as_posix()) + "/"
    text = re.sub(r"(?<=[\"'\(\s])(?:\.\./)+_tools/|(?<=[\"'\(\s])/_tools/", lambda _: engine, text)
    for source, new in mapping.items():
        if not source.startswith("@url:"):
            continue
        old = source[5:]
        relative = posixpath.relpath(new.lstrip("/"), destination.parent.as_posix())
        text = re.sub(r"(?<=[\"'\(\s])" + re.escape(old) + r"(?=[/\"'?#\s])", lambda _: relative, text)
    path.write_text(text, encoding="utf-8")


def plan(root: Path, templates: Path | None = None, *, target_version: int = 2) -> dict:
    manifest_v1(root)
    check_active(root)
    files = list_data(root)
    for name in ("output", "connections", "web-data", "tiktok"):
        safe_path(root, name)
    mapping = build_mapping(root, files, target_version=target_version)
    if templates:
        discover_template_videos(templates, root)
    mapped_files = sum(("data/" + p.relative_to(root / "data").as_posix()) in mapping for p in files)
    return {"json_files": len(files) - mapped_files,
            "files_to_move": mapped_files,
            "opaque_directories": sum((root / k).exists() for k in ("connections", "web-data", "tiktok")) + sum((root / "data" / name).exists() for name in OPAQUE_DATA_DIRS),
            "output_present": (root / "output").exists(),
            "template_files": sum(1 for _ in template_files(templates)) if templates else 0}


def prepare(root: Path, templates: Path, *, target_version: int = 2, legacy_roots=()) -> str:
    if target_version not in (2, 3):
        raise ValueError("Versión de destino no admitida")
    legacy_roots = validate_legacy_roots(legacy_roots)
    with exclusive(root):
        original = manifest_v1(root)
        check_active(root)
        original_sandbox = sandbox_inventory(root)
        files = list_data(root)
        mapping = build_mapping(root, files, target_version=target_version)
        discoveries = discover_template_videos(templates, root)
        channels, channels_hash = channels_snapshot(root)
        template_entries = list(template_files(templates))
        for source, destination in template_entries:
            final = Path("renders") / Path(*destination.parts[1:]) if destination.parts[0] == "render-import" else destination
            mapping[str(source)] = final.as_posix()
        destinations = list(mapping.values())
        if len(destinations) != len(set(destinations)):
            raise ValueError("Dos archivos comparten destino de migración")
        for video, (category, _) in discoveries.items():
            mapping[f"@url:/{category}/{video}"] = f"/productions/{category}/{video}"
        txid = uuid.uuid4().hex
        tx = root / ".system/migrations" / txid
        tx.mkdir(mode=0o700)
        staged = tx / "staged/data"
        staged.mkdir(parents=True, mode=0o700)
        try:
            external_provenance = []
            for source, destination in template_entries:
                target = tx / "staged" / destination
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                # Verify each byte of a non-secret owned source; no source is removed.
                with source.open("rb") as inp, target.open("xb") as out:
                    shutil.copyfileobj(inp, out, 1024 * 1024)
                    out.flush()
                    os.fsync(out.fileno())
                def sha(path):
                    h = hashlib.sha256()
                    with path.open("rb") as f:
                        for block in iter(lambda: f.read(1024 * 1024), b""):
                            h.update(block)
                    return h.digest()
                if sha(source) != sha(target):
                    raise ValueError("Una plantilla cambió durante la preparación")
                if source.suffix.lower() == ".json":
                    source_parts = source.relative_to(templates).parts
                    diagnostic = ('review' in source_parts or ('work' in source_parts and
                                  any(part == 'results' or part.startswith('camera-check') for part in source_parts)))
                    value = rewrite(load_json(target), root, mapping, templates, legacy_roots=legacy_roots,
                                    provenance=external_provenance if diagnostic else None,
                                    provenance_source=source.relative_to(templates).as_posix() if diagnostic else None)
                    atomic_json(target, value)
                    if load_json(target) != value:
                        raise ValueError("Falló la verificación de plantilla preparada")
                elif source.suffix.lower() in {".html", ".css", ".js", ".mjs"}:
                    rewrite_template_text(target, destination, mapping)
            (tx / "staged/productions").mkdir(parents=True, exist_ok=True, mode=0o700)
            (tx / "staged/sandbox").mkdir(parents=True, exist_ok=True, mode=0o700)
            scaffold_content(tx / "staged")
            stage_config_defaults(root, tx / "staged")
            for source in files:
                rel = source.relative_to(root / "data")
                if "data/" + rel.as_posix() in mapping:
                    continue
                value = load_json(source)
                expected = rewrite(value, root, mapping, templates, legacy_roots=legacy_roots)
                atomic_json(staged / rel, expected)
                if load_json(staged / rel) != expected:
                    raise ValueError("Falló la verificación de datos preparados")
            merge_channels(staged, rewrite(channels, root, mapping, templates, legacy_roots=legacy_roots))
            prepare_indexes(root, staged, mapping, tx / "staged/productions", discoveries)
            extra = {"mapping": mapping, "target_version": target_version, "legacy_server_roots": list(legacy_roots),
                     "external_provenance": external_provenance}
            if target_version == 3:
                converter_spec = importlib.util.spec_from_file_location(
                    "profile_v3_converter", Path(__file__).with_name("profile_v3_migration.py")
                )
                converter = importlib.util.module_from_spec(converter_spec)
                converter_spec.loader.exec_module(converter)
                converter.transform_staging(root, tx, extra)
                script = Path(__file__).resolve().parents[2] / "scripts/storage-profile.py"
                spec = importlib.util.spec_from_file_location("profile_v3_initializer", script)
                initializer = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(initializer)
                initializer.scaffold_v3(tx / "staged", replace_guides=True)
            # Stage is sealed after all transformations; activation verifies it again.
            staged_fingerprint, _ = inventory(tx / "staged", opaque_data=tx / "staged/data")
            original_fingerprint, _ = inventory(root / "data")
            atomic_json(tx / "profile-before.json", original)
            journal = {"version": 1, "state": "prepared", "mapping": mapping,
                       "sandbox_fingerprint": original_sandbox,
                       "data_fingerprint": original_fingerprint, "channels_fingerprint": channels_hash,
                       "staged_fingerprint": staged_fingerprint, "operations": [], "created_dirs": []}
            journal.update(extra)
            atomic_json(tx / "journal.json", journal)
        except BaseException:
            shutil.rmtree(tx)
            raise
        return txid


def load_tx(root: Path, txid: str) -> tuple[Path, dict]:
    if not re.fullmatch(r"[0-9a-f]{32}", txid):
        raise ValueError("ID de migración inválido")
    tx = safe_path(root, ".system/migrations/" + txid)
    journal = load_json(safe_path(root, f".system/migrations/{txid}/journal.json"))
    if not isinstance(journal, dict) or journal.get("version") != 1:
        raise ValueError("Manifiesto de recuperación inválido")
    return tx, journal


def record_move(root: Path, tx: Path, journal: dict, source: Path, dest: Path) -> None:
    safe_path(root, str(source.relative_to(root)))
    safe_path(root, str(dest.relative_to(root)))
    if not source.exists() or dest.exists():
        raise ValueError("Origen ausente o destino ya existente")
    missing = []
    parent = dest.parent
    while parent != root and not parent.exists():
        missing.append(parent)
        parent = parent.parent
    for directory in reversed(missing):
        rel = directory.relative_to(root).as_posix()
        journal["created_dirs"].append(rel)
        atomic_json(tx / "journal.json", journal)
        directory.mkdir(mode=0o700)
    op = {"source": source.relative_to(root).as_posix(), "destination": dest.relative_to(root).as_posix(), "state": "moving"}
    journal["operations"].append(op)
    atomic_json(tx / "journal.json", journal)
    os.rename(source, dest)
    fsync_dir(source.parent)
    fsync_dir(dest.parent)
    op["state"] = "done"
    atomic_json(tx / "journal.json", journal)


def activate(root: Path, txid: str) -> None:
    with exclusive(root):
        tx, j = load_tx(root, txid)
        target_version = j.get("target_version", 2)
        if target_version not in (2, 3):
            raise ValueError("Versión de migración inválida")
        if j.get("state") != "prepared":
            raise ValueError("La migración no está preparada")
        before = manifest_v1(root)
        if before != load_json(tx / "profile-before.json"):
            raise ValueError("El manifiesto cambió desde la preparación")
        if inventory(root / "data")[0] != j["data_fingerprint"]:
            raise ValueError("Los datos cambiaron desde la preparación")
        if sandbox_inventory(root) != j.get("sandbox_fingerprint"):
            raise ValueError("El sandbox cambió desde la preparación")
        if channels_snapshot(root)[1] != j.get("channels_fingerprint"):
            raise ValueError("La metadata de canales cambió desde la preparación")
        if inventory(tx / "staged", opaque_data=tx / "staged/data")[0] != j["staged_fingerprint"]:
            raise ValueError("El staging cambió desde la preparación")
        # All final top-level destinations must be absent; fail before changing anything.
        for name in ("renders", "resources", "logs", "productions"):
            if (root / name).exists():
                raise ValueError("Existe un destino v2; no se sobrescribirá")
        sandbox = safe_path(root, "sandbox")
        sandbox_moves = sandbox_merge_plan(sandbox, tx / "staged/sandbox") if sandbox.exists() else []
        imports = tx / "staged/render-import"
        if imports.exists() and (root / "output").exists():
            for src in imports.rglob("*"):
                if src.is_file() and (root / "output" / src.relative_to(imports)).exists():
                    raise ValueError("Un render heredado coincide con salida existente")
        for old, new in (("connections", ".system/connections"), ("web-data", ".system/web-data"), ("tiktok", ".system/tiktok")):
            if (root / old).exists() and (root / new).exists():
                raise ValueError("Existe un destino v2; no se sobrescribirá")
        for name, destination in OPAQUE_DATA_DIRS.items():
            source = safe_path(root, f"data/{name}")
            target = safe_path(root, destination)
            if source.exists() and target.exists():
                raise ValueError("Existe un destino v2; no se sobrescribirá")
            if source.exists() and source.stat().st_dev != root.stat().st_dev:
                raise ValueError("Las raíces deben estar en el mismo sistema de archivos")
        for old in ("data", "sandbox", "output", "connections", "web-data", "tiktok"):
            src = root / old
            if src.exists() and src.stat().st_dev != root.stat().st_dev:
                raise ValueError("Las raíces deben estar en el mismo sistema de archivos")
        if target_version == 3:
            if not j.get("v3_transform", {}).get("complete"):
                raise ValueError("La transformación v3 no está completa")
            for name in ("AGENTS.md", "CLAUDE.md"):
                previous = safe_path(root, name)
                if previous.exists() and not previous.is_file():
                    raise ValueError("Una guía del perfil no es un archivo regular")
            destinations = set()
            for item in j.get("output_moves", []) + j.get("staged_render_moves", []):
                destination = safe_path(root, item["destination"])
                if destination.exists() or item["destination"] in destinations:
                    raise ValueError("Colisión en el plan de medios v3")
                destinations.add(item["destination"])
                source = (root / "output" / Path(item["source"]).relative_to("legacy/output")
                          if item["source"].startswith("legacy/output/")
                          else safe_path(tx, item["source"]))
                if not source.is_file() or source.is_symlink():
                    raise ValueError("Un origen de medios v3 cambió o desapareció")
        j["state"] = "activating"
        atomic_json(tx / "journal.json", j)
        try:
            data = root / "data"
            if data.exists():
                record_move(root, tx, j, data, tx / "legacy/data")
            record_move(root, tx, j, tx / "staged/productions", root / "productions")
            if sandbox.exists():
                legacy_sandbox = tx / "legacy/profile-sandbox"
                record_move(root, tx, j, sandbox, legacy_sandbox)
                for relative in sandbox_moves:
                    record_move(root, tx, j, legacy_sandbox / relative, tx / "staged/sandbox" / relative)
            record_move(root, tx, j, tx / "staged/sandbox", root / "sandbox")
            if target_version == 3:
                for name in ("renders", "resources", "logs"):
                    if (tx / "staged" / name).exists():
                        record_move(root, tx, j, tx / "staged" / name, root / name)
            for old, new in (("connections", ".system/connections"),
                             ("web-data", ".system/web-data"), ("tiktok", ".system/tiktok")):
                if (root / old).exists():
                    record_move(root, tx, j, root / old, root / new)
            for old, new in sorted(j["mapping"].items()):
                if not old.startswith("data/"):
                    continue
                source = tx / "legacy" / old
                dest = root / new
                record_move(root, tx, j, source, dest)
            record_move(root, tx, j, tx / "staged/data", root / "data")
            if target_version == 2:
                if (root / "output").exists():
                    record_move(root, tx, j, root / "output", root / "renders")
            elif (root / "output").exists():
                record_move(root, tx, j, root / "output", tx / "legacy/output")
            if target_version == 3:
                for item in j.get("output_moves", []) + j.get("staged_render_moves", []):
                    record_move(root, tx, j, safe_path(tx, item["source"]), safe_path(root, item["destination"]))
            elif imports.exists():
                for src in sorted(p for p in imports.rglob("*") if p.is_file()):
                    record_move(root, tx, j, src, root / "renders" / src.relative_to(imports))
            defaults = tx / "staged/config-defaults"
            if defaults.exists():
                for src in sorted(p for p in defaults.rglob("*") if p.is_file()):
                    record_move(root, tx, j, src, root / "config" / src.relative_to(defaults))
            if target_version == 3:
                for old, name in (("designs", "profile-designs"), ("sandbox/designs", "sandbox-designs")):
                    source = root / old
                    if source.exists():
                        record_move(root, tx, j, source, tx / "legacy" / name)
                for name in ("AGENTS.md", "CLAUDE.md"):
                    previous = safe_path(root, name)
                    if previous.exists():
                        record_move(root, tx, j, previous, tx / "legacy/root-guides" / name)
                    record_move(root, tx, j, tx / "staged" / name, root / name)
            next_manifest = {**before, "schema_version": target_version}
            atomic_json(tx / "profile-v2.json", next_manifest)
            record_move(root, tx, j, root / "profile.json", tx / "profile-v1.original")
            record_move(root, tx, j, tx / "profile-v2.json", root / "profile.json")
            j["state"] = "active"
            j["active_data_fingerprint"] = inventory(root / "data")[0]
            atomic_json(tx / "journal.json", j)
        except BaseException:
            rollback_moves(root, tx, j)
            raise


def rollback_moves(root: Path, tx: Path, journal: dict) -> None:
    journal["state"] = "rolling_back"
    atomic_json(tx / "journal.json", journal)
    for op in reversed(journal["operations"]):
        if op.get("state") == "reverted":
            continue
        source = safe_path(root, op["source"])
        dest = safe_path(root, op["destination"])
        if dest.exists() and not source.exists():
            source.parent.mkdir(parents=True, exist_ok=True)
            os.rename(dest, source)
            fsync_dir(source.parent)
            fsync_dir(dest.parent)
        elif not source.exists() or dest.exists():
            raise ValueError("Estado ambiguo; revisión manual requerida")
        op["state"] = "reverted"
        atomic_json(tx / "journal.json", journal)
    for name in reversed(journal["created_dirs"]):
        path = safe_path(root, name)
        try:
            path.rmdir()
        except OSError:
            pass
    journal["state"] = "rolled_back"
    atomic_json(tx / "journal.json", journal)


def rollback(root: Path, txid: str) -> None:
    with exclusive(root):
        tx, j = load_tx(root, txid)
        if j.get("state") not in {"activating", "active", "rolling_back"}:
            raise ValueError("La migración no se puede revertir en este estado")
        if j.get("state") == "active" and inventory(root / "data")[0] != j.get("active_data_fingerprint"):
            raise ValueError("Los datos v2 cambiaron; no se puede revertir automáticamente")
        rollback_moves(root, tx, j)
