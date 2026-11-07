"""Puertos de lectura para material, estilos, cuentas y medios de publicaciones."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol


@dataclass(frozen=True)
class VerifiedImageMaterial:
    source_video_id: str
    category_id: str
    source_revision: str
    plan_text: str
    publish: Mapping[str, Any]
    video_title: str
    topic: str


@dataclass(frozen=True)
class CachedImage:
    content: bytes
    metadata: Mapping[str, Any]


class VerifiedImageMaterialSource(Protocol):
    def category_exists(self, category_id: str) -> bool: ...
    def load_verified_material(
        self, source_video_id: str, category_id: str
    ) -> VerifiedImageMaterial | None: ...


class ImageAccountMapping(Protocol):
    def resolve_account(self, category_id: str, platform: str, account_alias: str) -> Mapping[str, Any]: ...
    def accounts_for_category(self, category_id: str) -> list[dict[str, Any]]: ...
    def categories_for_account(self, platform: str, account_alias: str) -> list[str]: ...


class ImageStyleCatalog(Protocol):
    def get_style(self, category_id: str, style_id: str | None = None) -> Any: ...
    def list_styles(self, category_id: str) -> list[dict[str, Any]]: ...


class ImageMediaCache(Protocol):
    def get_by_url(self, url: str) -> CachedImage | None: ...
    def put_by_url(self, url: str, content: bytes, metadata: Mapping[str, Any]) -> CachedImage: ...
    def get_by_sha256(self, sha256: str) -> bytes | None: ...
