"""Contrato para crear y transformar imágenes sin acoplar el dominio a Codex."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, Sequence


@dataclass(frozen=True)
class ImageGenerationResult:
    path: Path
    model: str
    tokens: dict[str, int] = field(default_factory=dict)
    seconds: float = 0.0
    notes: tuple[str, ...] = ()


class ImageGenerationPort(Protocol):
    def generate(self, task: str, prompt: str, size: str, refs: Sequence[Path] = ()) -> ImageGenerationResult: ...

    def edit(self, image: Path, instructions: str) -> ImageGenerationResult: ...

    def remove_background(self, image: Path) -> ImageGenerationResult: ...

    def variations(self, image: Path, n: int) -> list[ImageGenerationResult]: ...
