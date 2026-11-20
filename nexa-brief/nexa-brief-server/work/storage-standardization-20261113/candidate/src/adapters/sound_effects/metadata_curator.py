"""Ficha editorial de un efecto nuevo mediante un agente acotado y JSON validado."""

from __future__ import annotations

import json

from src.config.settings import BASE_DIR
from src.core.ports.sound_effects_port import (
    CuratedSoundMetadata,
    SoundCandidate,
    SoundMetadataPort,
)

_PROMPTS = BASE_DIR / "src" / "skills" / "sounds" / "curate"


class AgentSoundMetadataCurator(SoundMetadataPort):
    """El agente redacta la ficha; nunca controla mediciones ni aprobación."""

    async def curate(
        self, candidate: SoundCandidate, *, duration_seconds: float, content_hash: str,
    ) -> CuratedSoundMetadata:
        from src.adapters.models.hub import text_json_with_usage

        system = (_PROMPTS / "prompt.md").read_text(encoding="utf-8")
        schema = json.loads((_PROMPTS / "output.schema.json").read_text(encoding="utf-8"))
        context = {
            "provider_metadata_untrusted": {
                "provider": candidate.provider,
                "provider_sound_id": candidate.provider_sound_id,
                "title": candidate.title,
                "description": candidate.description,
                "tags": list(candidate.tags),
                "source_url": candidate.source_url,
            },
            "measured_by_system": {
                "duration_seconds": duration_seconds,
                "content_hash": content_hash,
            },
        }
        try:
            value, _usage = await text_json_with_usage(
                "sound_curator", system, json.dumps(context, ensure_ascii=False), schema=schema,
            )
            return CuratedSoundMetadata.model_validate(value)
        except Exception as exc:
            raise RuntimeError(
                "No se pudo crear una ficha válida del sonido. El recurso no se registra ni aprueba."
            ) from exc
