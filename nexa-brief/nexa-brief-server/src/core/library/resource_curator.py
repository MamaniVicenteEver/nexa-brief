"""Completa la ficha de los recursos de biblioteca que llegan sin descripción o sin etiquetas.

Se lanza al preparar un borrador: recoge la canción, el video y las imágenes que usa, pide a un
agente acotado (rol `resource_curator`: gpt-6-luna en alto; respaldo claude-haiku-5-5 en medio)
una ficha validada y guarda SOLO los campos que estén vacíos. Nunca cambia título, categoría,
licencia ni lo que escribió una persona, y nunca detiene la preparación: los errores se registran.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import structlog
from pydantic import BaseModel, Field

from src.config.settings import BASE_DIR
from src.core.library import asset_library as lib

logger = structlog.get_logger(__name__)

ROLE = "resource_curator"
_PROMPTS = BASE_DIR / "src" / "skills" / "library" / "curate"
_KINDS = ("music", "video", "image")
_LYRICS_HEAD_SEGMENTS = 12
_TASKS: set[asyncio.Task] = set()


class CuratedMetadata(BaseModel):
    """Ficha que devuelve el agente. Cualquier campo fuera de forma invalida la ficha entera."""

    description: str = Field(default="", max_length=600)
    tags: list[str] = Field(default_factory=list, max_length=8)
    genre: str = Field(default="", max_length=60)
    language: str = Field(default="", max_length=8)


def _filled(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    return bool(value)


def draft_asset_ids(draft: Any) -> list[str]:
    """Ids de la biblioteca que usa un borrador: canción, fondo y medios por lugar."""
    inputs = draft.inputs
    ids = [value for value in (inputs.music_asset_id, inputs.image_asset_id, inputs.video_asset_id) if value]
    template = inputs.template_inputs
    if template is not None:
        for refs in template.media.values():
            ids.extend(refs)
    return list(dict.fromkeys(ids))


def _find(asset_id: str) -> tuple[str, Any] | None:
    for kind in _KINDS:
        try:
            return kind, lib.get_entry(kind, asset_id)
        except lib.AssetNotFoundError:
            continue
    return None


def _lyrics_head(asset_id: str) -> str:
    lyrics = lib.get_lyrics_cache(asset_id) or {}
    segments = (lyrics.get("segments") or [])[:_LYRICS_HEAD_SEGMENTS]
    return " ".join(str(segment.get("text", "")).strip() for segment in segments).strip()


def _context(kind: str, entry: Any, lyrics_head: str) -> dict[str, Any]:
    """Datos del recurso que recibe el agente. Son datos del proveedor: no se confía en ellos."""
    context: dict[str, Any] = {
        "tipo": kind,
        "archivo": entry.original_filename,
        "categoria": entry.category,
        "origen": entry.source,
        "proveedor": entry.provider,
        "licencia": entry.license_note,
        "duracion_segundos": getattr(entry, "duration_seconds", None),
        "descripcion_actual": entry.description,
        "etiquetas_actuales": entry.tags,
    }
    if kind == "music":
        context |= {
            "titulo": entry.track_name,
            "artista": entry.artist,
            "genero_actual": entry.genre,
            "idioma_actual": entry.language,
            "inicio_transcripcion": lyrics_head,
        }
    else:
        context |= {"titulo": getattr(entry, "label", ""), "nombre_mostrado": getattr(entry, "display_name", "")}
    return context


async def _ask(kind: str, entry: Any, asset_id: str) -> CuratedMetadata:
    from src.adapters.models.hub import text_json_with_usage

    system = (_PROMPTS / "prompt.md").read_text(encoding="utf-8")
    schema = json.loads((_PROMPTS / "output.schema.json").read_text(encoding="utf-8"))
    lyrics_head = _lyrics_head(asset_id) if kind == "music" else ""
    value, _usage = await text_json_with_usage(
        ROLE, system, json.dumps(_context(kind, entry, lyrics_head), ensure_ascii=False),
        structured=True, schema=schema,
    )
    return CuratedMetadata.model_validate(value)


def changes_for(kind: str, entry: Any, curated: CuratedMetadata) -> dict[str, Any]:
    """Solo los campos vacíos del recurso. Lo que ya tiene valor no se toca."""
    changes: dict[str, Any] = {}
    if not _filled(entry.description) and curated.description.strip():
        changes["description"] = curated.description.strip()
    if not _filled(entry.tags) and curated.tags:
        changes["tags"] = ", ".join(tag.strip() for tag in curated.tags if tag.strip())
    if kind == "music":
        if not _filled(entry.genre) and curated.genre.strip():
            changes["genre"] = curated.genre.strip()
        if not _filled(entry.language) and curated.language.strip():
            changes["language"] = curated.language.strip().lower()
    return changes


async def curate_assets(asset_ids: list[str]) -> dict[str, str]:
    """Completa los recursos que lo necesitan. Devuelve el estado de cada uno; nunca lanza."""
    report: dict[str, str] = {}
    for asset_id in asset_ids:
        try:
            found = _find(asset_id)
            if found is None:
                report[asset_id] = "no_encontrado"
                continue
            kind, entry = found
            if _filled(entry.description) and _filled(entry.tags):
                report[asset_id] = "completo"
                continue
            curated = await _ask(kind, entry, asset_id)
            changes = changes_for(kind, entry, curated)
            if changes:
                await lib.update_asset_metadata(kind, asset_id, changes)
                logger.info("resource_curator_updated", asset_id=asset_id, kind=kind, fields=sorted(changes))
            report[asset_id] = "actualizado" if changes else "sin_cambios"
        except Exception as exc:  # noqa: BLE001 — la preparación no depende de la ficha
            logger.warning("resource_curator_failed", asset_id=asset_id, error=str(exc)[:300])
            report[asset_id] = "error"
    return report


def pending_resources(draft: Any) -> list[str]:
    """Recursos del borrador con datos que faltan para publicar (vacío = todo listo)."""
    pending: list[str] = []
    for asset_id in draft_asset_ids(draft):
        found = _find(asset_id)
        if found is None:
            continue
        kind, entry = found
        # La licencia es un dato de derechos que no se genera; no se avisa como pendiente.
        gaps = [gap for gap in lib.metadata_gaps(kind, entry) if gap != "licencia"]
        if gaps:
            name = getattr(entry, "track_name", "") or getattr(entry, "label", "") or asset_id
            pending.append(f"{name}: falta {', '.join(gaps)}")
    return pending


def schedule_for_draft(draft: Any) -> None:
    """Lanza la curación en segundo plano para un borrador que entra a preparación."""
    ids = draft_asset_ids(draft)
    if not ids:
        return
    task = asyncio.get_running_loop().create_task(curate_assets(ids))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
