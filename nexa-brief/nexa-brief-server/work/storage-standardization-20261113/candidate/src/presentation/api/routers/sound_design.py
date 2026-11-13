"""Puerta HTTP del diseño sonoro; proveedores/FFmpeg quedan detrás del servicio."""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from src.adapters.sound_effects.factory import build_service
from src.config.exceptions import AssetNotFoundError
from src.config.settings import BASE_DIR
from src.core.ports.sound_effects_port import SoundDesignError
from src.core.sound_design.models import SoundMixPlan
from src.presentation.api.security import require_internal

router = APIRouter(prefix="/sound-design", tags=["sound-design"], dependencies=[Depends(require_internal)])
_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SoundImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider_sound_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=200)


@router.get("/search")
async def search(
    q: str = Query(min_length=1, max_length=200),
    max_duration: float | None = Query(default=None, gt=0, le=600),
    limit: int = Query(default=10, ge=1, le=30),
):
    try:
        result = await build_service().search(q, max_duration=max_duration, limit=limit)
        return {
            "source": result["source"],
            "local": [entry.model_dump() for entry in result["local"]],
            "external": [asdict(item) for item in result["external"]],
        }
    except httpx.HTTPError as exc:
        raise HTTPException(502, "El proveedor de sonidos no está disponible.") from exc
    except SoundDesignError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/import")
async def import_sound(body: SoundImportRequest):
    try:
        entry, reused = await build_service().import_sound(body.provider_sound_id)
        return {
            "entry": entry.model_dump(),
            "already_imported": reused,
            "requires_approval": entry.approval_status != "approved",
        }
    except httpx.HTTPError as exc:
        raise HTTPException(502, "No se pudo descargar el sonido; no se registró como aprobado.") from exc
    except (SoundDesignError, ValueError) as exc:
        raise HTTPException(422, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, "La curación de la ficha no está disponible; no se importó el sonido.") from exc


def _narration_from_config(video, config):
    """La reproducción puede usar una mezcla; las nuevas mezclas parten de la voz limpia."""
    cases = config.get("configs") or []
    if not cases:
        raise SoundDesignError("La plantilla no tiene una configuración de audio.")
    case = next((item for item in cases if item.get("id") == config.get("activeId")), cases[0])
    audio = case.get("audio") or {}
    narration = (video / (audio.get("narrationSrc") or audio.get("src") or "assets/song.mp3")).resolve()
    if not narration.is_relative_to(video.resolve()):
        raise SoundDesignError("La voz debe estar dentro de la carpeta del proyecto.")
    if not narration.is_file():
        raise SoundDesignError("No se encontró la narración original de la plantilla.")
    return narration


@router.post("/sandbox/{category}/{video_id}/mix")
async def mix_sandbox(category: str, video_id: str, plan: SoundMixPlan):
    root = (BASE_DIR / "src/templates/sandbox").resolve()
    if not _SLUG.fullmatch(category) or not _SLUG.fullmatch(video_id):
        raise HTTPException(422, "Ruta de proyecto inválida.")
    video = (root / category / video_id).resolve()
    if not video.is_relative_to(root) or not (video / "assets/config.json").is_file():
        raise HTTPException(404, "Proyecto de Sandbox no encontrado.")
    try:
        config = json.loads((video / "assets/config.json").read_text())
        narration = _narration_from_config(video, config)
        plan_id = uuid.uuid4().hex
        folder = (video / "assets/sound-design" / plan_id).resolve()
        if not folder.is_relative_to(video):
            raise SoundDesignError("El destino debe estar dentro del proyecto.")
        folder.mkdir(parents=True, exist_ok=True)
        # Master sin pérdida; el navegador puede reproducirlo sin otra recodificación.
        result = await build_service().mix(narration, plan, folder / "mix.wav")
        (folder / "plan.json").write_text(json.dumps({**plan.model_dump(), **result}, ensure_ascii=False, indent=2))
        result["file_url"] = (
            f"/api/v1/explainer/files/sandbox/{category}/{video_id}/assets/sound-design/{plan_id}/mix.wav"
        )
        result.pop("effects_path", None)
        result["effects_url"] = (
            f"/api/v1/explainer/files/sandbox/{category}/{video_id}/assets/sound-design/{plan_id}/mix-effects.wav"
        )
        return result
    except AssetNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except (SoundDesignError, ValueError, KeyError, IndexError) as exc:
        raise HTTPException(422, str(exc)) from exc
