"""Manifest único por template_id: nombre público, descripción, y TODAS las
rutas de archivo (index.html, prompts, config de ejemplo).

Fuente de verdad: src/templates/templates.json. `folder` (nombre físico en
disco) vive solo acá, desacoplado de `template_id` (el identificador lógico
estable, usado por remotion_adapter.py/frontend/data/template_configs — no
cambia aunque se renombre la carpeta). niches.json ya no tiene rutas
hardcodeadas: ver get_template_paths(). Cacheado en memoria: el archivo no
cambia en runtime, solo se lee una vez por proceso.
"""

from __future__ import annotations

import json
import shutil
from functools import lru_cache
from pathlib import Path

from src.config.settings import settings

_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_VIDEO_SUFFIXES = {".mp4", ".webm", ".mov"}


@lru_cache(maxsize=1)
def _load_catalog() -> dict:
    manifest_path = settings.templates_dir / "templates.json"
    if not manifest_path.exists():
        return {}
    return json.loads(manifest_path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_manifest() -> dict:
    return _load_catalog().get("templates", {})


def list_template_catalog() -> list[tuple[str, dict]]:
    """Devuelve el catálogo declarativo ordenado por categoría y prioridad.

    `templates.json` es la fuente de verdad del catálogo público. `niches.json`
    sigue describiendo el comportamiento del pipeline, pero no debe decidir
    qué plantillas existen en la web: así una plantilla de showcase puede
    aparecer antes de tener un nicho ejecutable.
    """
    catalog = _load_catalog()
    categories = catalog.get("categories", {})
    entries = []
    for template_id, entry in catalog.get("templates", {}).items():
        category_id = entry.get("category_id", "uncategorized")
        category_order = categories.get(category_id, {}).get("order", 999)
        entries.append((
            template_id,
            entry,
            category_order,
            entry.get("sort_order", 999),
        ))
    entries.sort(key=lambda item: (item[2], item[3], item[0]))
    return [(template_id, entry) for template_id, entry, _, _ in entries]


def list_template_categories() -> list[dict]:
    """Categorías públicas para que clientes futuros no tengan que duplicar el catálogo."""
    categories = _load_catalog().get("categories", {})
    return [
        {"id": category_id, **entry}
        for category_id, entry in sorted(
            categories.items(),
            key=lambda item: (item[1].get("order", 999), item[0]),
        )
    ]


def get_template_entry(template_id: str) -> dict:
    return _load_manifest().get(template_id, {})


def get_template_category_id(template_id: str, fallback: str = "uncategorized") -> str:
    return get_template_entry(template_id).get("category_id", fallback)


def get_template_category_name(template_id: str, fallback: str = "Sin categoría") -> str:
    category_id = get_template_category_id(template_id)
    category = _load_catalog().get("categories", {}).get(category_id, {})
    return category.get("display_name", fallback)


def get_template_category_order(template_id: str, fallback: int = 999) -> int:
    category_id = get_template_category_id(template_id)
    return _load_catalog().get("categories", {}).get(category_id, {}).get("order", fallback)


def get_template_sort_order(template_id: str, fallback: int = 999) -> int:
    return get_template_entry(template_id).get("sort_order", fallback)


def get_template_tags(template_id: str) -> list[str]:
    return list(get_template_entry(template_id).get("tags", []))


def get_template_status(template_id: str, fallback: str = "ready") -> str:
    return get_template_entry(template_id).get("status", fallback)


def get_template_runtime_assets(template_id: str) -> list[Path]:
    """Devuelve rutas de carpetas/archivos estáticos que necesita un render.

    Se copian al output de cada job porque el HTML de algunas plantillas usa
    media curado local (por ejemplo `assets/media` en las promos).
    """
    entry = get_template_entry(template_id)
    template_root = get_template_root(template_id)
    if template_root is None:
        return []
    paths: list[Path] = []
    for relative in entry.get("runtime_assets", []):
        source = (template_root / relative).resolve()
        if source.is_relative_to(template_root.resolve()) and source.exists():
            paths.append(source)
    return paths


def copy_template_runtime_assets(template_id: str, output_dir: Path) -> list[Path]:
    """Copia los assets runtime declarados y devuelve los destinos copiados."""
    template_root = get_template_root(template_id)
    if template_root is None:
        return []
    copied: list[Path] = []
    for source in get_template_runtime_assets(template_id):
        relative = source.relative_to(template_root)
        destination = output_dir / relative
        if source.is_dir():
            shutil.copytree(source, destination, dirs_exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        copied.append(destination)
    return copied


def get_template_display_name(template_id: str, fallback: str) -> str:
    entry = get_template_entry(template_id)
    return entry["display_name"] if entry and "display_name" in entry else fallback


def get_template_description(template_id: str, fallback: str) -> str:
    entry = get_template_entry(template_id)
    return entry["description"] if entry and "description" in entry else fallback


def get_template_native_orientation(template_id: str, fallback: str = "any") -> str:
    entry = get_template_entry(template_id)
    return entry["native_orientation"] if entry and "native_orientation" in entry else fallback


def get_template_paths(template_id: str) -> dict[str, Path | None]:
    """Rutas absolutas resueltas para un template_id. Cualquier campo ausente
    en el manifest (ej. vision_prompt=null en los templates de letras, que no
    hacen extracción de visión) devuelve None."""
    entry = get_template_entry(template_id)
    return {
        key: (settings.templates_dir / entry[key]) if entry.get(key) else None
        for key in ("index_html", "config_json", "vision_prompt", "config_prompt")
    }


def get_template_asset_dir(template_id: str) -> Path | None:
    """Devuelve el directorio de assets de una plantilla registrada."""
    config_path = get_template_paths(template_id)["config_json"]
    if config_path is None:
        return None
    return config_path.parent


def get_template_root(template_id: str) -> Path | None:
    """Devuelve la carpeta física de una plantilla registrada."""
    entry = get_template_entry(template_id)
    folder = entry.get("folder")
    if not folder:
        return None
    root = (settings.templates_dir / folder).resolve()
    templates_root = settings.templates_dir.resolve()
    if not root.is_relative_to(templates_root):
        return None
    return root


def get_template_preview_assets(template_id: str) -> dict[str, Path | None]:
    """Selecciona los recursos locales que puede reproducir una tarjeta.

    Se prioriza el fondo declarado por la plantilla y se dejan fallbacks para
    plantillas generativas que no tienen un fondo fijo en su configuración.
    """
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None or not asset_dir.exists():
        return {"image": None, "video": None, "audio": None}

    files = {
        path.relative_to(asset_dir).as_posix(): path
        for path in asset_dir.rglob("*")
        if path.is_file()
    }

    def first_existing(names: tuple[str, ...], suffixes: set[str]) -> Path | None:
        for name in names:
            candidate = files.get(name)
            if candidate is not None and candidate.suffix.lower() in suffixes:
                return candidate
        return next(
            (path for path in files.values() if path.suffix.lower() in suffixes),
            None,
        )

    return {
        "image": first_existing(
            ("card-poster.webp", "bg.png", "bg.jpg", "cover.jpg", "angel.jpg"),
            _IMAGE_SUFFIXES,
        ),
        "video": first_existing(("bg.mp4", "path.mp4", "humo.mp4", "niebla.mp4"), _VIDEO_SUFFIXES),
        "audio": files.get("song.mp3"),
    }


# ── Requisitos por plantilla (`inputs`) ──────────────────────────────────────
# Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.1. La UI
# arma el formulario a partir de esto, así que agregar una plantilla no exige
# tocar el frontend; el director de medios y template_inputs_applier leen lo
# mismo para saber qué slots buscar y dónde volcarlos.

_MEDIA_KINDS = {"image", "video", "image|video"}
_LYRICS_MODES = {"auto", "optional", "none"}


def _normalize_media_slot(raw: dict) -> dict | None:
    slot = str(raw.get("slot") or "").strip()
    kind = raw.get("kind")
    if not slot or kind not in _MEDIA_KINDS:
        return None
    count = raw.get("count")
    # count = exacto; min/max = rango. Se normaliza a min/max para que los
    # consumidores no tengan que contemplar las dos formas.
    min_count = int(count if count is not None else raw.get("min", 1))
    max_count = int(count if count is not None else raw.get("max", min_count))
    return {
        "slot": slot,
        "kind": kind,
        "count": int(count) if count is not None else None,
        "min": max(0, min_count),
        "max": max(min_count, max_count, 1),
        "orientation": raw.get("orientation"),
        # "source" = entra por la imagen/video de fondo del job (MusicSource/
        # ImageSource/VideoSource); "media" = reemplaza config.media en orden;
        # "config" = el archivo va a la ruta `path` del config (ej. "bg.src": un fondo
        # opcional que, si no se sube, deja el que trae la plantilla).
        "target": raw.get("target") or "source",
        "path": raw.get("path") if raw.get("target") == "config" else None,
        "label": raw.get("label") or slot,
        "hint": raw.get("hint") or "",
    }


def _derived_template_inputs(entry: dict) -> dict:
    """Defaults para plantillas sin `inputs` explícito, a partir de requires_*."""
    requires_lyrics = bool(entry.get("requires_lyrics"))
    media: list[dict] = []
    if entry.get("requires_video"):
        media.append({"slot": "background", "kind": "video", "count": 1, "label": "Fondo"})
    elif entry.get("requires_image"):
        media.append({"slot": "background", "kind": "image", "count": 1, "label": "Fondo"})
    return {
        "audio": {"required": requires_lyrics, "lyrics": "auto" if requires_lyrics else "none"},
        "media": media,
        "texts": [],
        "brief": bool(media),
    }


def get_template_inputs(template_id: str) -> dict | None:
    """Requisitos normalizados de una plantilla, o None si no está registrada.

    Siempre devuelve las cuatro claves (audio, media, texts, brief) con formas
    estables: los slots traen min/max/target/label/hint aunque el JSON los omita.
    """
    entry = get_template_entry(template_id)
    if not entry:
        return None
    raw = entry.get("inputs") or _derived_template_inputs(entry)
    audio = dict(raw.get("audio") or {})
    lyrics_mode = audio.get("lyrics")
    texts = []
    for text in raw.get("texts") or []:
        key = str(text.get("key") or "").strip()
        if not key:
            continue
        texts.append({
            "key": key,
            "label": text.get("label") or key,
            "max": int(text["max"]) if text.get("max") else None,
            "default": text.get("default"),
        })
    return {
        "audio": {
            "required": bool(audio.get("required", False)),
            "lyrics": lyrics_mode if lyrics_mode in _LYRICS_MODES else "none",
        },
        "media": [slot for slot in map(_normalize_media_slot, raw.get("media") or []) if slot],
        "texts": texts,
        "brief": bool(raw.get("brief", False)),
    }
