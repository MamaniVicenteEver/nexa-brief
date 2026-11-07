"""Publication repository backed by one transactional v3 JSON section."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping

from src.adapters.data.json_publication_repository import (
    IdempotencyConflict, JsonPublicationRepository, RepositoryConflict, _SAFE_ID,
)
from src.adapters.data.section_store import Section
from src.core.image_posts.models import PublicationRecord
from src.core.image_posts.security import redact_persisted_value


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def image_post_index(records: Mapping[str, Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Build a disposable post-to-publication projection from source records."""
    groups: dict[str, list[Mapping[str, Any]]] = {}
    for record in records.values():
        groups.setdefault(str(record['post_id']), []).append(record)
    result = []
    for post_id, rows in sorted(groups.items()):
        rows.sort(key=lambda row: (int(row['revision']), str(row['created_at']), str(row['publication_id'])))
        latest = rows[-1]
        result.append({'post_id': post_id, 'publication_ids': [row['publication_id'] for row in rows],
                       'latest_revision': latest['revision'], 'status': latest['status']})
    return result


class SectionPublicationRepository(JsonPublicationRepository):
    """All source records and request receipts commit in one section revision."""

    @property
    def _section(self) -> Section:
        return Section('publicaciones', self._data_dir)

    @staticmethod
    def _records(section: dict[str, Any]) -> dict[str, Any]:
        records = section['documents'].setdefault('publications', {})
        if not isinstance(records, dict):
            raise RuntimeError('Invalid publications section')
        return records

    @staticmethod
    def _ledger(section: dict[str, Any]) -> dict[str, Any]:
        ledger = section['documents'].setdefault('publication_idempotency', {})
        if not isinstance(ledger, dict):
            raise RuntimeError('Invalid publication idempotency section')
        return ledger

    def get(self, publication_id: str) -> dict[str, Any] | None:
        if not _SAFE_ID.fullmatch(publication_id):
            return None
        record = self._records(self._section.read()).get(publication_id)
        return self._dump(record) if record is not None else None

    def _read_index(self) -> list[dict[str, Any]]:
        # The path is a virtual identifier consumed only by the existing summary.
        records = self._records(self._section.read())
        return [self._summary(self._dump(record), self.root / key / 'record.json')
                for key, record in records.items()]

    async def create(self, record: Mapping[str, Any] | PublicationRecord, idempotency_key: str | None = None,
                     *, idempotency_request_hash: str | None = None) -> dict[str, Any]:
        data = self._dump(record)
        self._record_path(data)  # Retain ID, category and timestamp validation.
        digest = hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        def tx(section):
            records, ledger = self._records(section), self._ledger(section)
            if idempotency_key and idempotency_key in ledger:
                previous = ledger[idempotency_key]
                if previous['body_hash'] != (idempotency_request_hash or digest):
                    raise IdempotencyConflict('Idempotency-Key reutilizada con otro cuerpo')
                found = records.get(previous['publication_id'])
                if found is not None:
                    return self._dump(found)
            old = records.get(data['publication_id'])
            if old is not None and old != data:
                raise RepositoryConflict('La publicación ya existe con otro contenido')
            records[data['publication_id']] = data
            if idempotency_key:
                ledger[idempotency_key] = {'publication_id': data['publication_id'], 'body_hash': idempotency_request_hash or digest}
            return data
        return await self._section.mutate_async(tx)

    def get_idempotent(self, key: str, request_hash: str) -> dict[str, Any] | None:
        section = self._section.read()
        previous = self._ledger(section).get(key)
        if not previous:
            return None
        if previous.get('body_hash') != request_hash:
            raise IdempotencyConflict('Idempotency-Key reutilizada con otro cuerpo')
        found = self._records(section).get(previous['publication_id'])
        return self._dump(found) if found is not None else None

    def get_request(self, key: str, request_hash: str) -> dict[str, Any] | None:
        previous = self._ledger(self._section.read()).get(f'request:{key}')
        if not previous:
            return None
        if previous.get('body_hash') != request_hash:
            raise IdempotencyConflict('Idempotency-Key reutilizada con otro cuerpo')
        return previous.get('result')

    def store_request(self, key: str, request_hash: str, result: Mapping[str, Any]) -> None:
        def tx(section):
            ledger = self._ledger(section)
            scoped = f'request:{key}'
            previous = ledger.get(scoped)
            if previous and previous.get('body_hash') != request_hash:
                raise IdempotencyConflict('Idempotency-Key reutilizada con otro cuerpo')
            ledger[scoped] = {'body_hash': request_hash, 'result': redact_persisted_value(dict(result))}
        self._section.mutate(tx)

    def store_request_once(self, key: str, request_hash: str, result: Mapping[str, Any]) -> tuple[bool, dict[str, Any]]:
        def tx(section):
            ledger = self._ledger(section)
            scoped = f'request:{key}'
            previous = ledger.get(scoped)
            if previous:
                if previous.get('body_hash') != request_hash:
                    raise IdempotencyConflict('Idempotency-Key reutilizada con otro cuerpo')
                return False, dict(previous.get('result') or {})
            saved = redact_persisted_value(dict(result))
            ledger[scoped] = {'body_hash': request_hash, 'result': saved}
            return True, saved
        return self._section.mutate(tx)

    async def claim_deliveries(self, publication_id, request_key, request_hash, expected_revision, deliveries, status):
        def tx(section):
            records, ledger = self._records(section), self._ledger(section)
            previous = ledger.get(f'request:{request_key}')
            if previous and previous.get('body_hash') != request_hash:
                raise IdempotencyConflict('Idempotency-Key reutilizada con otro cuerpo')
            current = records.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            if previous:
                return {'record': self._dump(current), 'delivery_ids': list((previous.get('result') or {}).get('delivery_ids', [])), 'replayed': True}
            if current['revision'] != expected_revision:
                raise RepositoryConflict('REVISION_CONFLICT')
            stored = list(current['deliveries'])
            by_key = {item['idempotency_key']: item for item in stored}
            ids = []
            changed = False
            for candidate in deliveries:
                item = self._dump_delivery(redact_persisted_value(dict(candidate)))
                key = item['idempotency_key']
                if key not in by_key:
                    by_key[key] = item
                    stored.append(item)
                    changed = True
                delivery_id = str(by_key[key]['delivery_id'])
                if delivery_id not in ids:
                    ids.append(delivery_id)
            if changed:
                current = self._dump({**current, 'deliveries': stored, 'status': status,
                                      'record_version': current['record_version'] + 1, 'updated_at': _now()})
                records[publication_id] = current
            ledger[f'request:{request_key}'] = {'body_hash': request_hash, 'result': {'delivery_ids': ids}}
            return {'record': self._dump(current), 'delivery_ids': ids, 'replayed': False}
        return await self._section.mutate_async(tx)

    async def update(self, publication_id, patch, expected_record_version):
        def tx(section):
            records = self._records(section)
            current = records.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            if current['record_version'] != expected_record_version:
                raise RepositoryConflict('REVISION_CONFLICT')
            if {'schema_version', 'publication_id', 'post_id', 'created_at', 'supersedes_publication_id'}.intersection(patch):
                raise ValueError('No se pueden cambiar los identificadores ni created_at')
            merged = {**current, **dict(patch), 'record_version': expected_record_version + 1}
            merged.setdefault('updated_at', _now())
            records[publication_id] = self._dump(merged)
            return records[publication_id]
        return await self._section.mutate_async(tx)

    async def append_delivery_event(self, publication_id, delivery_id, event, expected_record_version=None):
        def tx(section):
            records = self._records(section)
            current = records.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            if expected_record_version is not None and current['record_version'] != expected_record_version:
                raise RepositoryConflict('REVISION_CONFLICT')
            deliveries = list(current['deliveries'])
            index = next((i for i, row in enumerate(deliveries) if row['delivery_id'] == delivery_id), None)
            if index is None:
                raise KeyError(delivery_id)
            deliveries[index] = {**deliveries[index], **dict(event), 'updated_at': _now()}
            records[publication_id] = self._dump({**current, 'deliveries': deliveries,
                                                   'record_version': current['record_version'] + 1, 'updated_at': _now()})
            return records[publication_id]
        return await self._section.mutate_async(tx)

    async def append_metrics_snapshot(self, publication_id, snapshot):
        def tx(section):
            records = self._records(section)
            current = records.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            snapshots = list(current['metrics_snapshots'])
            unique = (snapshot.get('delivery_id'), snapshot.get('window'), snapshot.get('observed_at'))
            if any(item.get('snapshot_id') == str(snapshot.get('snapshot_id')) or
                   (item.get('delivery_id'), item.get('window'), item.get('observed_at')) == unique for item in snapshots):
                return self._dump(current)
            snapshots.append(dict(snapshot))
            records[publication_id] = self._dump({**current, 'metrics_snapshots': snapshots,
                                                   'record_version': current['record_version'] + 1, 'updated_at': _now()})
            return records[publication_id]
        return await self._section.mutate_async(tx)

    async def delete(self, publication_id: str, policy: str) -> bool:
        if policy != 'authorized_legal_purge':
            raise PermissionError('Purgar publicaciones requiere política explícita')
        def tx(section):
            records = self._records(section)
            if publication_id not in records:
                return False
            del records[publication_id]
            return True
        return await self._section.mutate_async(tx)

    def repair_index(self) -> int:
        return len(self._records(self._section.read()))

    def rebuild_image_post_index(self) -> int:
        """Reconcile the disposable index; source revision exposes stale snapshots."""
        source = self._section.read()
        rows = image_post_index(self._records(source))
        def tx(section):
            section['collections']['image_posts_index'] = rows
            section['documents']['index_metadata'] = {'source_revision': source['revision']}
        Section('image-posts', self._data_dir).mutate(tx)
        return len(rows)
