"""Orquestador: reutiliza, cura cada recurso externo nuevo y conserva la voz completa."""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

from src.core.ports.sound_effects_port import (
    ResolvedSoundCue,
    SoundDesignError,
    SoundLibraryPort,
    SoundMetadataPort,
    SoundMixerPort,
    SoundProviderPort,
)
from src.core.sound_design.models import SoundMixPlan


class SoundDesignService:
    def __init__(
        self, library: SoundLibraryPort, provider: SoundProviderPort, curator: SoundMetadataPort, mixer: SoundMixerPort
    ):
        self.library, self.provider, self.curator, self.mixer = library, provider, curator, mixer
        self._imports = asyncio.Lock()
        self._mixes = asyncio.Lock()

    async def search(self, query: str, *, max_duration: float | None = None, limit: int = 10) -> dict:
        query = query.strip()
        if not query:
            raise SoundDesignError("Escribí qué sonido necesitás.")
        local = self.library.search(query)
        if max_duration is not None:
            local = [entry for entry in local if entry.duration_seconds <= max_duration]
        if local:
            return {"source": "library", "local": local[:limit], "external": []}
        return {
            "source": "provider",
            "local": [],
            "external": await self.provider.search(query, max_duration=max_duration, limit=limit),
        }

    async def import_sound(self, provider_sound_id: str):
        # Una segunda petición al mismo recurso reutiliza su ficha, incluso si sigue pendiente.
        async with self._imports:
            existing = self.library.find_by_provider(self.provider.name, provider_sound_id)
            if existing is not None:
                return existing, True
            candidate = await self.provider.get(provider_sound_id)
            with tempfile.TemporaryDirectory(prefix="nexa-sound-") as tmp:
                source = Path(tmp) / "effect.wav"
                await self.provider.download(candidate, source)
                facts = await self.mixer.inspect(source)
                if candidate.expected_sha256 and facts.content_hash != candidate.expected_sha256:
                    raise SoundDesignError("El archivo no coincide con la huella publicada por el proveedor.")
                metadata = await self.curator.curate(
                    candidate, duration_seconds=facts.duration_seconds, content_hash=facts.content_hash
                )
                # El adaptador conserva mediciones y procedencia; el agente solo redacta la ficha.
                entry = await self.library.register(source, candidate, metadata)
            return entry, False

    async def mix(self, narration: Path, plan: SoundMixPlan, destination: Path) -> dict:
        async with self._mixes:
            outputs = {destination.resolve(), destination.with_name(destination.stem + "-effects.wav").resolve()}
            if narration.resolve() in outputs:
                raise SoundDesignError("La mezcla no puede sobrescribir la narración original.")
            facts = await self.mixer.inspect(narration)
            resolved = []
            for cue in plan.cues:
                entry = self.library.get(cue.asset_id)
                if entry.approval_status != "approved":
                    raise SoundDesignError(f"El sonido {cue.asset_id} necesita aprobación antes de usarse.")
                path = self.library.path(cue.asset_id)
                if path.resolve() in outputs:
                    raise SoundDesignError("La mezcla no puede sobrescribir un efecto de la biblioteca.")
                effect = await self.mixer.inspect(path)
                if cue.start + cue.duration > facts.duration_seconds + 0.001:
                    raise SoundDesignError("Un efecto sale de la duración original de la narración.")
                if cue.source_in + cue.duration > effect.duration_seconds + 0.001:
                    raise SoundDesignError("El fragmento solicitado supera la duración del sonido.")
                resolved.append(ResolvedSoundCue(path=path, **cue.model_dump()))
            await self.mixer.mix(narration, resolved, destination, ducking=plan.ducking)
            after = await self.mixer.inspect(narration)
            result = await self.mixer.inspect(destination)
            if after.content_hash != facts.content_hash:
                raise SoundDesignError("La narración original cambió durante la mezcla.")
            # MP3 agrega un frame de encabezado; el master WAV debe coincidir muestra por muestra.
            tolerance = 0.06 if destination.suffix.lower() == ".mp3" else 0.001
            if abs(result.duration_seconds - facts.duration_seconds) > tolerance:
                raise SoundDesignError("La mezcla no conserva la duración original de la voz.")
            for asset_id in {cue.asset_id for cue in plan.cues}:
                await self.library.mark_used(asset_id)
            return {
                "duration_seconds": result.duration_seconds,
                "narration_duration_seconds": facts.duration_seconds,
                "narration_hash": facts.content_hash,
                "narration_unchanged": True,
                "cues": [cue.model_dump() for cue in plan.cues],
                "ducking": plan.ducking,
                "effects_path": str(destination.with_name(destination.stem + "-effects.wav")),
            }
