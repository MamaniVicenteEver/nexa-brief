"""Reglas de dominio sobre el puerto de almacenamiento de publicaciones."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from src.core.image_posts.models import Delivery, PublicationRecord, migrate_publication_record
from src.core.image_posts.security import redact_persisted_value
from src.core.ports.publication_repository import PublicationRepository, PublicationPage


class ImagePostRepository:
    def __init__(self, port: PublicationRepository) -> None:
        self._port = port

    @staticmethod
    def _record(value: Mapping[str, Any] | None) -> PublicationRecord | None:
        return PublicationRecord.model_validate(migrate_publication_record(dict(value))) if value else None

    async def create(
        self, record: PublicationRecord | Mapping[str, Any], idempotency_key: str | None = None,
        *, idempotency_request_hash: str | None = None,
    ) -> PublicationRecord:
        raw = record.model_dump(mode="json") if isinstance(record, PublicationRecord) else dict(record)
        raw = redact_persisted_value(raw)
        saved = await self._port.create(raw, idempotency_key, idempotency_request_hash=idempotency_request_hash)
        return self._record(saved)

    def get_idempotent(self, key: str, request_hash: str) -> PublicationRecord | None:
        raw = self._port.get_idempotent(key, request_hash)
        return self._record(raw)

    def get_request(self, key: str, request_hash: str) -> dict[str, Any] | None:
        return self._port.get_request(key, request_hash)

    def store_request(self, key: str, request_hash: str, result: Mapping[str, Any]) -> None:
        self._port.store_request(key, request_hash, redact_persisted_value(dict(result)))

    def store_request_once(
        self, key: str, request_hash: str, result: Mapping[str, Any]
    ) -> tuple[bool, dict[str, Any]]:
        return self._port.store_request_once(
            key, request_hash, redact_persisted_value(dict(result))
        )

    async def claim_deliveries(
        self,
        publication_id: str,
        request_key: str,
        request_hash: str,
        expected_revision: int,
        deliveries: list[Delivery],
        status: str,
    ) -> tuple[list[Delivery], bool]:
        raw = await self._port.claim_deliveries(
            publication_id,
            request_key,
            request_hash,
            expected_revision,
            [redact_persisted_value(item.model_dump(mode="json")) for item in deliveries],
            status,
        )
        record = self._record(raw["record"])
        if record is None:
            raise KeyError(publication_id)
        by_id = {item.delivery_id: item for item in record.deliveries}
        result = [by_id[delivery_id] for delivery_id in raw["delivery_ids"] if delivery_id in by_id]
        return result, bool(raw.get("replayed"))

    def get(self, publication_id: str) -> PublicationRecord | None:
        raw = self._port.get(publication_id)
        return self._record(raw)

    async def update(
        self, publication_id: str, patch: Mapping[str, Any], expected_record_version: int
    ) -> PublicationRecord:
        raw = await self._port.update(
            publication_id, redact_persisted_value(dict(patch)), expected_record_version
        )
        return self._record(raw)

    def list(
        self, filters: Mapping[str, Any] | None = None, *, sort: str = "desc",
        limit: int = 24, cursor: str | None = None,
    ) -> PublicationPage:
        return self._port.list(filters, sort=sort, limit=limit, cursor=cursor)

    async def append_delivery_event(
        self, publication_id: str, delivery_id: str, event: Mapping[str, Any],
        expected_record_version: int | None = None,
    ) -> PublicationRecord:
        raw = await self._port.append_delivery_event(
            publication_id, delivery_id, redact_persisted_value(dict(event)), expected_record_version
        )
        return self._record(raw)

    async def append_metrics_snapshot(
        self, publication_id: str, snapshot: Mapping[str, Any]
    ) -> PublicationRecord:
        raw = await self._port.append_metrics_snapshot(
            publication_id, redact_persisted_value(dict(snapshot))
        )
        return self._record(raw)

    async def delete(self, publication_id: str, policy: str) -> bool:
        return await self._port.delete(publication_id, policy)
