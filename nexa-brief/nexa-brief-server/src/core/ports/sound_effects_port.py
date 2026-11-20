"""Contratos de sonido: el dominio decide qué necesita, no cómo se obtiene o mezcla."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field


class SoundDesignError(ValueError):
    pass


@dataclass(frozen=True)
class SoundCandidate:
    provider: str
    provider_sound_id: str
    title: str
    description: str
    duration_seconds: float
    tags: tuple[str, ...]
    source_url: str
    download_url: str
    license_note: str
    license_url: str
    expected_sha256: str = ""


class CuratedSoundMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=3000)
    recommended_uses: list[str] = Field(min_length=1, max_length=20)
    tags: list[str] = Field(default_factory=list, max_length=50)


@dataclass(frozen=True)
class AudioFacts:
    duration_seconds: float
    content_hash: str
    sample_rate: int
    channels: int
    peak_dbfs: float = -120.0


@dataclass(frozen=True)
class ResolvedSoundCue:
    asset_id: str
    path: Path
    start: float
    source_in: float
    duration: float
    gain_db: float
    fade_in: float
    fade_out: float


class SoundProviderPort(Protocol):
    name: str

    async def search(
        self, query: str, *, max_duration: float | None = None, limit: int = 10
    ) -> list[SoundCandidate]: ...
    async def get(self, provider_sound_id: str) -> SoundCandidate: ...
    async def download(self, candidate: SoundCandidate, destination: Path) -> None: ...


class SoundMetadataPort(Protocol):
    async def curate(
        self, candidate: SoundCandidate, *, duration_seconds: float, content_hash: str
    ) -> CuratedSoundMetadata: ...


class SoundLibraryPort(Protocol):
    def search(self, query: str) -> list[Any]: ...
    def get(self, asset_id: str) -> Any: ...
    def find_by_provider(self, provider: str, sound_id: str) -> Any | None: ...
    def path(self, asset_id: str) -> Path: ...
    async def register(self, source: Path, candidate: SoundCandidate, metadata: CuratedSoundMetadata) -> Any: ...
    async def mark_used(self, asset_id: str) -> None: ...


class SoundMixerPort(Protocol):
    async def inspect(self, path: Path) -> AudioFacts: ...
    async def mix(self, narration: Path, cues: list[ResolvedSoundCue], destination: Path, *, ducking: bool) -> None: ...
