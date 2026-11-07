"""Puertos de persistencia para el archivo de publicaciones."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class PublicationPage:
    items: list[dict[str, Any]]
    next_cursor: str | None
    as_of: str


class PublicationRepository(Protocol):
    async def create(
        self, record: Mapping[str, Any], idempotency_key: str | None = None,
        *, idempotency_request_hash: str | None = None,
    ) -> dict[str, Any]: ...
    def get_idempotent(self, key: str, request_hash: str) -> dict[str, Any] | None: ...
    def get_request(self, key: str, request_hash: str) -> dict[str, Any] | None: ...
    def store_request(self, key: str, request_hash: str, result: Mapping[str, Any]) -> None: ...
    def store_request_once(
        self, key: str, request_hash: str, result: Mapping[str, Any]
    ) -> tuple[bool, dict[str, Any]]: ...
    async def claim_deliveries(
        self,
        publication_id: str,
        request_key: str,
        request_hash: str,
        expected_revision: int,
        deliveries: list[Mapping[str, Any]],
        status: str,
    ) -> dict[str, Any]: ...
    def get(self, publication_id: str) -> dict[str, Any] | None: ...
    async def update(
        self, publication_id: str, patch: Mapping[str, Any], expected_record_version: int
    ) -> dict[str, Any]: ...
    def list(
        self, filters: Mapping[str, Any] | None = None, *, sort: str = "desc",
        limit: int = 24, cursor: str | None = None,
    ) -> PublicationPage: ...
    async def append_delivery_event(
        self, publication_id: str, delivery_id: str, event: Mapping[str, Any],
        expected_record_version: int | None = None,
    ) -> dict[str, Any]: ...
    async def append_metrics_snapshot(
        self, publication_id: str, snapshot: Mapping[str, Any]
    ) -> dict[str, Any]: ...
    async def delete(self, publication_id: str, policy: str) -> bool: ...


