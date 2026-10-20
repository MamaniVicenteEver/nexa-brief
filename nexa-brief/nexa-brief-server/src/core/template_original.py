"""«Video original» de una plantilla de NodeMotion: grabarla tal cual, con SU canción, letra y fondo.

Las plantillas guardan sus medios en su carpeta (assets/song.mp3, assets/lyrics.json, el fondo que
nombra config.json). El pipeline solo toma medios de la librería, así que la primera vez se importan
(canción con su letra ya transcrita, y el fondo si la plantilla lo usa) y se recuerdan por plantilla en
el documento `template_originals`. Con eso, el original es un prototipo más (draft con `original=True`).

Sus textos de publicación quedan además en `<carpeta de la plantilla>/publish.json` (canción, artista y
título/descripción/etiquetas/comentario fijado por red): es el registro por plantilla, versionable, y un
original nuevo arranca desde ahí en vez de volver a pedirlos a la IA.
Ver docs/investigaciones/nodemotion-sandbox-grabar-2026-10.md.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import structlog
from pydantic import BaseModel

from src.config.niche_config import NicheConfig
from src.config.template_manifest import get_template_asset_dir, get_template_root
from src.core.data import documents
from src.core.draft_details import DraftDetails
from src.core.library import asset_library

logger = structlog.get_logger(__name__)

CATEGORY = "template_originals"
PUBLISH_FILE = "publish.json"
PUBLISH_SCHEMA = "nodemotion-publish/1"
# Nombres de archivo que no dicen nada de la canción («song.mp3», «audio.mp3»).
_GENERIC_SONG_NAMES = {"song", "audio", "music", "track", "cancion", "musica"}
_IMAGE = (".jpg", ".jpeg", ".png", ".webp")
_VIDEO = (".mp4", ".webm", ".mov")
_SKIP = ("card-poster",)


class OriginalAssets(BaseModel):
    music_asset_id: str
    image_asset_id: str | None = None
    video_asset_id: str | None = None


class OriginalUnavailable(ValueError):
    """La plantilla no tiene en su carpeta lo necesario para grabar el original."""


def _store():
    return documents("template_originals")


def _config(asset_dir: Path) -> dict[str, Any]:
    raw = json.loads((asset_dir / "config.json").read_text(encoding="utf-8"))
    return raw["configs"][0] if "configs" in raw else raw


def _referenced(config: Any, suffixes: tuple[str, ...]) -> list[str]:
    """Rutas de archivos con esas extensiones que nombra el config (bg.src, video.src…)."""
    found: list[str] = []
    if isinstance(config, dict):
        for value in config.values():
            found += _referenced(value, suffixes)
    elif isinstance(config, list):
        for value in config:
            found += _referenced(value, suffixes)
    elif isinstance(config, str) and config.lower().endswith(suffixes):
        found.append(config)
    return found


def _local(asset_dir: Path, ref: str) -> Path | None:
    path = (asset_dir.parent / ref).resolve() if ref.startswith("assets/") else (asset_dir / ref).resolve()
    return path if path.is_file() and path.is_relative_to(asset_dir.parent.resolve()) else None


def _candidates(asset_dir: Path, suffixes: tuple[str, ...]) -> list[Path]:
    return sorted(
        p for p in asset_dir.iterdir()
        if p.is_file() and p.suffix.lower() in suffixes and not p.stem.startswith(_SKIP)
    )


def background_file(asset_dir: Path, config: dict[str, Any], kind: str) -> Path | None:
    """El fondo de la plantilla: el que nombra el config; si nombra un video y hace falta imagen, la
    imagen con el mismo nombre (remix.mp4 → remix.jpg); si no, la primera del tipo pedido."""
    suffixes = _IMAGE if kind == "image" else _VIDEO
    for ref in _referenced(config, _IMAGE + _VIDEO):
        path = _local(asset_dir, ref)
        if path is None:
            continue
        if path.suffix.lower() in suffixes:
            return path
        twin = next((path.with_suffix(s) for s in suffixes if path.with_suffix(s).is_file()), None)
        if twin is not None:
            return twin
    found = _candidates(asset_dir, suffixes)
    return found[0] if found else None


def _first_existing(asset_dir: Path, refs: list[str], default: str) -> Path | None:
    for ref in [*refs, default]:
        path = _local(asset_dir, ref)
        if path is not None:
            return path
    return None


def song_and_lyrics(asset_dir: Path, config: dict[str, Any]) -> tuple[Path | None, Path | None]:
    """La canción y la letra que usa la plantilla: las que nombra el config (audio.src, lyricsUrl);
    si no, assets/song.mp3 y assets/lyrics.json."""
    audio = config.get("audio") if isinstance(config.get("audio"), dict) else {}
    song = _first_existing(asset_dir, [audio.get("src", "")] if audio.get("src") else [], "song.mp3")
    lyrics_ref = config.get("lyricsUrl") or config.get("lyrics_url") or ""
    lyrics = _first_existing(asset_dir, [lyrics_ref] if lyrics_ref else [], "lyrics.json")
    return song, lyrics


def track_name_of(song: Path) -> str:
    """El nombre del archivo si dice algo de la canción («Bruses Dueles Tan Bien Audio»); si es
    genérico («song.mp3») va vacío: la IA no debe tomar el nombre de la plantilla como canción."""
    stem = song.stem.replace("_", " ").replace("-", " ").strip()
    return "" if stem.lower() in _GENERIC_SONG_NAMES else stem


def _still_there(saved: dict[str, Any]) -> bool:
    try:
        asset_library.get_music_entry(saved["music_asset_id"])
        if saved.get("image_asset_id"):
            asset_library.get_image_entry(saved["image_asset_id"])
        if saved.get("video_asset_id"):
            asset_library.get_video_entry(saved["video_asset_id"])
        return True
    except Exception:
        return False


async def ensure_assets(template_id: str, niche_cfg: NicheConfig) -> OriginalAssets:
    """Los medios del original en la librería (los importa la primera vez)."""
    saved = _store().get(template_id)
    if saved and _still_there(saved):
        return OriginalAssets.model_validate(saved)

    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None or not (asset_dir / "config.json").is_file():
        raise OriginalUnavailable(f"La plantilla '{template_id}' no tiene assets/config.json")
    config = _config(asset_dir)
    song, lyrics = song_and_lyrics(asset_dir, config)
    if song is None:
        raise OriginalUnavailable(f"La plantilla '{template_id}' no tiene su canción en assets/")
    name = template_id

    music = await asset_library.register_music(
        song, category=CATEGORY, source="template", provider="template",
        filename=f"{template_id}{song.suffix}", track_name=track_name_of(song),
    )
    if lyrics is not None:
        # la letra de la plantilla ya está sincronizada: no se vuelve a transcribir
        await asset_library.save_lyrics_cache(music.asset_id, json.loads(lyrics.read_text(encoding="utf-8")))
        await asset_library.set_transcription_status(music.asset_id, "done")
    assets = OriginalAssets(music_asset_id=music.asset_id)

    template = niche_cfg.template
    if template.requires_video:
        path = background_file(asset_dir, config, "video")
        if path is None:
            raise OriginalUnavailable(f"La plantilla '{template_id}' no tiene un video de fondo propio")
        video = await asset_library.register_video(path, category=CATEGORY, source="template", provider="template",
                                                   filename=f"{template_id}{path.suffix}", label=f"{name} (fondo)")
        assets.video_asset_id = video.asset_id
    elif template.requires_image:
        path = background_file(asset_dir, config, "image")
        if path is None:
            raise OriginalUnavailable(f"La plantilla '{template_id}' no tiene una imagen de fondo propia")
        image = await asset_library.register_image(path, category=CATEGORY, source="template", provider="template",
                                                   filename=f"{template_id}{path.suffix}", label=f"{name} (fondo)")
        assets.image_asset_id = image.asset_id

    _store().put(template_id, assets.model_dump())
    logger.info("template_original_assets", template_id=template_id, **assets.model_dump())
    return assets


# ── publish.json de la plantilla ────────────────────────────────────────────

def publish_path(template_id: str) -> Path | None:
    root = get_template_root(template_id)
    return root / PUBLISH_FILE if root else None


def read_publish(template_id: str) -> DraftDetails | None:
    """Los textos guardados de la plantilla, o None si todavía no tiene (o el archivo no es válido)."""
    path = publish_path(template_id)
    if path is None or not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return DraftDetails.model_validate({k: v for k, v in raw.items() if k not in ("schema", "template_id", "profile")})
    except Exception:
        logger.warning("template_publish_invalid", template_id=template_id)
        return None


def write_publish(template_id: str, details: DraftDetails, profile: str | None) -> Path | None:
    path = publish_path(template_id)
    if path is None:
        return None
    body = {"schema": PUBLISH_SCHEMA, "template_id": template_id, "profile": profile or "lyrics",
            **details.model_dump(mode="json")}
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def intro_identity(template_id: str) -> tuple[str, str]:
    """Título y artista que muestra la tarjeta de intro de la plantilla (config.intro), limpios."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None or not (asset_dir / "config.json").is_file():
        return "", ""
    intro = _config(asset_dir).get("intro") or {}
    clean = lambda v: " ".join(str(v or "").replace("\n", " ").split())  # noqa: E731
    artist = clean(intro.get("artist")).split(" · ")[0]
    return clean(intro.get("title") or intro.get("song")), artist
