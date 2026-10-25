"""Puerto para almacenar y servir medios de publicaciones."""

from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO, Protocol


@dataclass(frozen=True)
class MediaObject:
    key: str
    bytes: int
    sha256: str
    mime: str


class MediaStoragePort(Protocol):
    def put(
        self, key: str, stream: BinaryIO | bytes, mime: str, expected_sha256: str,
        if_absent: bool = True,
    ) -> MediaObject: ...
    def get(self, key: str, byte_range: tuple[int, int] | None = None) -> BinaryIO: ...
    def signed_url(
        self, key: str, audience: str, ttl: int, expected_sha256: str | None = None
    ) -> str: ...
    def delete(self, key: str, expected_sha256: str | None = None) -> bool: ...
