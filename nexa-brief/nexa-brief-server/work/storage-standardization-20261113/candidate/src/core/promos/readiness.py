"""Puerta técnica común; la revisión visual final pertenece a la persona."""

from __future__ import annotations
import hashlib
import json
import os
import stat
import threading
from collections import OrderedDict
from pathlib import Path

from src.core.promo_prompts import TEMPLATES


# Hash por streaming; el límite evita mantener una caché por cada video histórico.
_EXTENSIONS = frozenset(
    {
        ".html",
        ".json",
        ".js",
        ".css",
        ".mp4",
        ".webm",
        ".mp3",
        ".wav",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".svg",
        ".woff",
        ".woff2",
    }
)
_SKIP_DIRS = frozenset({"logs", "log", "cache", ".cache", "__pycache__"})
_HASH_CACHE = OrderedDict()
_HASH_LOCK = threading.Lock()
_HASH_CACHE_LIMIT = 512
_MAX_ENTRIES = 10000


def _signature(st):
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def _file_hash(path: Path) -> str:
    before = path.stat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError("Archivo de preview no regular")
    key = (str(path), *_signature(before))
    with _HASH_LOCK:
        cached = _HASH_CACHE.get(key)
        if cached is not None:
            _HASH_CACHE.move_to_end(key)
            return cached
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        if _signature(os.fstat(stream.fileno())) != _signature(before):
            raise ValueError("Archivo cambió durante la revisión")
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
        if _signature(os.fstat(stream.fileno())) != _signature(before):
            raise ValueError("Archivo cambió durante la revisión")
    if _signature(path.stat()) != _signature(before):
        raise ValueError("Archivo cambió durante la revisión")
    value = digest.hexdigest()
    with _HASH_LOCK:
        _HASH_CACHE[key] = value
        _HASH_CACHE.move_to_end(key)
        while len(_HASH_CACHE) > _HASH_CACHE_LIMIT:
            _HASH_CACHE.popitem(last=False)
    return value


def _content_files(draft_id):
    from src.core import drafts

    job = drafts.load_job(draft_id)
    if job is None or job.artifacts.output_dir is None:
        return {}, None
    output = Path(job.artifacts.output_dir).resolve(strict=True)
    content = Path(job.artifacts.content_dir or output).resolve(strict=True)
    if not content.is_relative_to(output) or not output.is_dir() or not content.is_dir():
        raise ValueError("El contenido del preview sale de su output")
    files = {}
    count = 0
    # Preview y miniaturas viven en content; output/assets cubre medios cuando
    # content es una subcarpeta. Se omiten logs y cachés no usados por render.
    roots = [content]
    assets = output / "assets"
    if not assets.is_relative_to(content) and assets.exists():
        roots.append(assets)
    if output != content:
        # Algunos adaptadores sitúan audio y configuración en la raíz de output.
        for candidate in sorted(output.iterdir()):
            if candidate.suffix.lower() not in _EXTENSIONS or candidate.is_dir():
                continue
            path = candidate.resolve(strict=True)
            if not path.is_relative_to(output):
                raise ValueError("Archivo de preview fuera de su output")
            files["@output/" + candidate.name] = _file_hash(path)
    for root in roots:
        if root.is_symlink() or not root.resolve(strict=True).is_relative_to(output):
            raise ValueError("Directorio de preview fuera de su output")
        for directory, subdirs, names in os.walk(
            root, followlinks=False, onerror=lambda exc: (_ for _ in ()).throw(exc)
        ):
            count += len(subdirs) + len(names)
            if count > _MAX_ENTRIES:
                raise ValueError("Demasiados archivos para revisar el preview")
            current = Path(directory)
            for name in subdirs:
                if (current / name).is_symlink():
                    raise ValueError("Enlace de directorio en el preview")
            subdirs[:] = sorted(name for name in subdirs if name not in _SKIP_DIRS)
            for name in sorted(names):
                candidate = current / name
                if candidate.suffix.lower() not in _EXTENSIONS:
                    continue
                path = candidate.resolve(strict=True)
                if not path.is_relative_to(output):
                    raise ValueError("Archivo de preview fuera de su output")
                label = (
                    str(candidate.relative_to(content))
                    if candidate.is_relative_to(content)
                    else "@output/" + str(candidate.relative_to(output))
                )
                files[label] = _file_hash(path)
    return files, job


def snapshot_fingerprint(draft: dict) -> str:
    fields = ("draft_id", "template_id", "inputs", "details", "thumbnails", "preview_url")
    value = {key: draft.get(key) for key in fields}
    files, _ = _content_files(str(draft.get("draft_id") or ""))
    value["files"] = files
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def evaluate(draft: dict, *, checks=None) -> dict:
    files, job = _content_files(draft["draft_id"])
    details = draft.get("details") or {}
    copies = details.get("copies") or {}
    thumbnails = (draft.get("thumbnails") or {}).get("options") or {}
    entries = [
        {"id": "promo", "label": "Plantilla comercial reconocida", "passed": draft.get("template_id") in TEMPLATES},
        {
            "id": "prepared",
            "label": "Preview y Detalles preparados",
            "passed": draft.get("status") == "prepared" and not draft.get("errors"),
        },
        {
            "id": "preview",
            "label": "Preview persistido disponible",
            "passed": job is not None
            and any(name in files for name in ("index.html", "@output/index.html"))
            and bool(draft.get("preview_url")),
        },
        {
            "id": "config",
            "label": "Configuración y guion disponibles",
            "passed": any(k.endswith("config.json") for k in files) and any(k.endswith("lyrics.json") for k in files),
        },
        {
            "id": "publication",
            "label": "Textos de las cuatro redes",
            "passed": all(
                isinstance(copies.get(p), dict) and copies[p].get("title") and copies[p].get("description")
                for p in ("youtube", "facebook", "instagram", "tiktok")
            ),
        },
        {
            "id": "thumbnails",
            "label": "Opciones de miniatura A y B",
            "passed": all(isinstance(thumbnails.get(k), dict) and thumbnails[k].get("text") for k in ("A", "B")),
        },
    ]
    entries.extend(checks or [])
    errors = [entry["label"] for entry in entries if not entry["passed"]]
    return {
        "passed": not errors,
        "checks": entries,
        "errors": errors,
        "warnings": [],
        "human_review_required": True,
        "review_checklist": [
            "Texto y continuidad sin relleno",
            "Hechos, fuentes y fechas",
            "Medios reales y licencias",
            "Lectura en móvil y escritorio",
            "Miniaturas A/B a 320 px",
        ],
        "fingerprint": snapshot_fingerprint(draft),
    }


def is_archived_draft(draft) -> bool:
    """Una sesión retirada también oculta sus revisiones de acceso directo."""
    if draft.template_id not in TEMPLATES or getattr(draft, "original", False):
        return False
    from src.core.data import collection
    return any(row.get("archived_at") and draft.draft_id in [row.get("draft_id"), *(row.get("draft_history") or [])]
               for row in collection("promo_chat_sessions").list(where={"template_id": draft.template_id}))


def approved_for_recording(draft) -> bool:
    """Las promos creadas necesitan revisión; la demo preparada usa su flujo original."""
    if draft.template_id not in TEMPLATES:
        return True
    if is_archived_draft(draft):
        return False
    # `original` se asigna exclusivamente en el endpoint que construye la demo
    # con los medios propios de la plantilla; no es un campo de creación pública.
    # El control de Job y de recuperación permanece en drafts.can_render.
    if getattr(draft, "original", False):
        return draft.details is not None and draft.status in ("prepared", "failed")
    from src.core.data import collection

    raw = draft.model_dump(mode="json")
    for row in collection("promo_chat_sessions").list(where={"template_id": draft.template_id}):
        if row.get("draft_id") == draft.draft_id:
            if row.get("archived_at"):
                return False
            try:
                fingerprint = snapshot_fingerprint(raw)
            except (OSError, ValueError):
                return False
            return (
                row.get("state") == "ready"
                and row.get("approved_revision") == row.get("revision")
                and row.get("quality", {}).get("passed") is True
                and row.get("reviewed_fingerprint") == fingerprint
            )
    return False
