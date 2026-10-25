"""Repositorio JSON del archivo de publicaciones, con CAS y locks entre procesos."""

from __future__ import annotations

import base64
import fcntl
import hashlib
import json
import os
import re
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Mapping

from src.adapters.data.layout import PUBLICATIONS_ROOT
from src.config.settings import settings
from src.core.image_posts.models import PublicationRecord, migrate_publication_record
from src.core.image_posts.security import redact_persisted_value
from src.core.ports.publication_repository import PublicationPage

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


class RepositoryConflict(ValueError):
    """La revisión esperada ya no es la última."""


class IdempotencyConflict(ValueError):
    """Una clave de idempotencia se reutilizó con otro contenido."""


class JsonPublicationRepository:
    """Guarda cada registro y deriva `index.json` desde los registros fuente."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir

    @property
    def root(self) -> Path:
        return (self._data_dir or settings.data_dir) / PUBLICATIONS_ROOT

    @property
    def index_path(self) -> Path:
        return self.root / "index.json"

    @contextmanager
    def _locked(self, path: Path) -> Iterator[None]:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a+b") as lock_file:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

    @staticmethod
    def _write_atomic(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True).encode()
        fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp_name, path)
            dir_fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)

    @staticmethod
    def _read_json(path: Path, default: Any) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return default
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"No se pudo leer el archivo de publicaciones: {path.name}") from exc

    @staticmethod
    def _dump(record: Mapping[str, Any] | PublicationRecord) -> dict[str, Any]:
        if isinstance(record, PublicationRecord):
            raw = record.model_dump(mode="json")
        else:
            raw = migrate_publication_record(dict(record))
        return PublicationRecord.model_validate(redact_persisted_value(raw)).model_dump(mode="json")

    def _record_path(self, record: Mapping[str, Any]) -> Path:
        category = str(record["editorial"]["category_id"])
        publication_id = str(record["publication_id"])
        if not _SAFE_ID.fullmatch(category) or not _SAFE_ID.fullmatch(publication_id):
            raise ValueError("ID de publicación o categoría inválido")
        niches_path = Path(__file__).resolve().parents[3] / "niches.json"
        categories = json.loads(niches_path.read_text(encoding="utf-8")).get("categories", {})
        if category not in categories:
            raise ValueError(f"Categoría inexistente: {category}")
        created = datetime.fromisoformat(str(record["created_at"]).replace("Z", "+00:00"))
        if created.tzinfo is None:
            raise ValueError("created_at debe incluir zona horaria")
        return self.root / category / created.astimezone(timezone.utc).strftime("%Y/%m") / publication_id / "record.json"

    def _read_index(self) -> list[dict[str, Any]]:
        data = self._read_json(self.index_path, [])
        if not isinstance(data, list):
            raise RuntimeError("El índice de publicaciones debe ser una lista")
        return data

    def _summary(self, record: Mapping[str, Any], record_path: Path) -> dict[str, Any]:
        deliveries = record.get("deliveries", [])
        summaries = []
        published_dates = []
        snapshots = record.get("metrics_snapshots", [])
        for delivery in deliveries:
            if delivery.get("published_at"):
                published_dates.append(delivery["published_at"])
            summary: dict[str, Any] = {
                "delivery_id": delivery["delivery_id"],
                "platform": delivery["platform"],
                "account_alias": delivery["account_alias"],
                "placement": delivery["placement"],
                "status": delivery["status"],
                "published_at": delivery.get("published_at"),
                "permalink": (delivery.get("remote") or {}).get("permalink"),
                "metrics_48h": None,
                "metrics_7d": None,
            }
            for window in ("48h", "7d"):
                matches = [
                    snap for snap in snapshots
                    if snap.get("delivery_id") == delivery["delivery_id"]
                    and snap.get("window") == window and snap.get("status") == "ok"
                ]
                if matches:
                    latest = max(matches, key=lambda snap: snap.get("observed_at", ""))
                    summary[f"metrics_{window}"] = latest.get("metrics")
            summaries.append(summary)
        technical = record["technical"]
        slides = technical.get("slides", [])
        return {
            "publication_id": record["publication_id"],
            "record_key": record_path.relative_to(self.root).as_posix(),
            "record_version": record["record_version"],
            "category_id": record["editorial"]["category_id"],
            "kind": technical["kind"],
            "template_id": technical["template_id"],
            "strategy_id": record.get("editorial", {}).get("strategy_id"),
            "status": record["status"],
            "created_at": record["created_at"],
            "latest_published_at": max(published_dates) if published_dates else None,
            "title": record["editorial"].get("title", ""),
            "cover_key": slides[0].get("storage_key") if slides else None,
            "delivery_summaries": summaries,
            "updated_at": record["updated_at"],
        }

    def _write_index_entry(self, record: Mapping[str, Any], path: Path) -> None:
        entries = self._read_index()
        summary = self._summary(record, path)
        for index, item in enumerate(entries):
            if item.get("publication_id") == record["publication_id"]:
                entries[index] = summary
                break
        else:
            entries.append(summary)
        self._write_atomic(self.index_path, entries)

    def _write_record(self, record: Mapping[str, Any], path: Path) -> None:
        self._write_atomic(path, record)
        self._write_atomic(path.parent / "plan.json", record["technical"]["composition_plan"])

    def get(self, publication_id: str) -> dict[str, Any] | None:
        if not _SAFE_ID.fullmatch(publication_id):
            return None
        # El índice es una referencia; el detalle siempre se lee de record.json.
        item = next((row for row in self._read_index() if row.get("publication_id") == publication_id), None)
        if item is None:
            return None
        path = (self.root / item["record_key"]).resolve()
        if not path.is_relative_to(self.root.resolve()) or path.name != "record.json":
            raise RuntimeError("record_key fuera del archivo de publicaciones")
        raw = self._read_json(path, None)
        return self._dump(raw) if raw is not None else None

    async def create(
        self, record: Mapping[str, Any] | PublicationRecord, idempotency_key: str | None = None,
        *, idempotency_request_hash: str | None = None,
    ) -> dict[str, Any]:
        data = self._dump(record)
        record_path = self._record_path(data)
        body_hash = hashlib.sha256(
            json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        ).hexdigest()
        with self._locked(self.root / ".index.lock"):
            with self._locked(record_path.with_suffix(".lock")):
                if idempotency_key:
                    idem_path = self.root / "idempotency.json"
                    idem = self._read_json(idem_path, {})
                    previous = idem.get(idempotency_key)
                    if previous:
                        expected_hash = idempotency_request_hash or body_hash
                        if previous["body_hash"] != expected_hash:
                            raise IdempotencyConflict("Idempotency-Key reutilizada con otro cuerpo")
                        found = self.get(previous["publication_id"])
                        if found:
                            return found
                existing = self._read_json(record_path, None)
                if existing is not None:
                    if existing.get("publication_id") != data["publication_id"]:
                        raise RepositoryConflict("La ruta de publicación ya está ocupada")
                    existing_hash = hashlib.sha256(
                        json.dumps(existing, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
                    ).hexdigest()
                    if existing_hash != body_hash:
                        raise RepositoryConflict("La publicación ya existe con otro contenido")
                    data = self._dump(existing)
                else:
                    self._write_record(data, record_path)
                if idempotency_key:
                    idem = self._read_json(self.root / "idempotency.json", {})
                    idem[idempotency_key] = {
                        "publication_id": data["publication_id"],
                        "body_hash": idempotency_request_hash or body_hash,
                    }
                    self._write_atomic(self.root / "idempotency.json", idem)
                self._write_index_entry(data, record_path)
        return data

    def get_idempotent(self, key: str, request_hash: str) -> dict[str, Any] | None:
        previous = self._read_json(self.root / "idempotency.json", {}).get(key)
        if not previous:
            return None
        if previous.get("body_hash") != request_hash:
            raise IdempotencyConflict("Idempotency-Key reutilizada con otro cuerpo")
        return self.get(previous["publication_id"])

    def get_request(self, key: str, request_hash: str) -> dict[str, Any] | None:
        scoped = f"request:{key}"
        previous = self._read_json(self.root / "idempotency.json", {}).get(scoped)
        if not previous:
            return None
        if previous.get("body_hash") != request_hash:
            raise IdempotencyConflict("Idempotency-Key reutilizada con otro cuerpo")
        return previous.get("result")

    def store_request(self, key: str, request_hash: str, result: Mapping[str, Any]) -> None:
        with self._locked(self.root / ".index.lock"):
            path = self.root / "idempotency.json"
            ledger = self._read_json(path, {})
            scoped = f"request:{key}"
            previous = ledger.get(scoped)
            if previous and previous.get("body_hash") != request_hash:
                raise IdempotencyConflict("Idempotency-Key reutilizada con otro cuerpo")
            ledger[scoped] = {"body_hash": request_hash, "result": redact_persisted_value(dict(result))}
            self._write_atomic(path, ledger)

    def store_request_once(
        self, key: str, request_hash: str, result: Mapping[str, Any]
    ) -> tuple[bool, dict[str, Any]]:
        """Guarda el recibo una sola vez y devuelve el resultado ganador."""
        with self._locked(self.root / ".index.lock"):
            path = self.root / "idempotency.json"
            ledger = self._read_json(path, {})
            scoped = f"request:{key}"
            previous = ledger.get(scoped)
            if previous:
                if previous.get("body_hash") != request_hash:
                    raise IdempotencyConflict("Idempotency-Key reutilizada con otro cuerpo")
                return False, dict(previous.get("result") or {})
            saved = redact_persisted_value(dict(result))
            ledger[scoped] = {"body_hash": request_hash, "result": saved}
            self._write_atomic(path, ledger)
            return True, saved

    async def claim_deliveries(
        self,
        publication_id: str,
        request_key: str,
        request_hash: str,
        expected_revision: int,
        deliveries: list[Mapping[str, Any]],
        status: str,
    ) -> dict[str, Any]:
        """Reclama y archiva una solicitud de entregas bajo el mismo lock."""
        with self._locked(self.root / ".index.lock"):
            ledger_path = self.root / "idempotency.json"
            ledger = self._read_json(ledger_path, {})
            scoped = f"request:{request_key}"
            previous = ledger.get(scoped)
            if previous:
                if previous.get("body_hash") != request_hash:
                    raise IdempotencyConflict("Idempotency-Key reutilizada con otro cuerpo")
                record = self.get(publication_id)
                if record is None:
                    raise KeyError(publication_id)
                receipt = previous.get("result") or {}
                return {
                    "record": record,
                    "delivery_ids": list(receipt.get("delivery_ids", [])),
                    "replayed": True,
                }

            indexed = self.get(publication_id)
            if indexed is None:
                raise KeyError(publication_id)
            path = self._record_path(indexed)
            with self._locked(path.with_suffix(".lock")):
                current = self._read_json(path, None)
                if current is None:
                    raise KeyError(publication_id)
                if current["revision"] != expected_revision:
                    raise RepositoryConflict("REVISION_CONFLICT")

                stored = list(current["deliveries"])
                by_key = {item["idempotency_key"]: item for item in stored}
                delivery_ids: list[str] = []
                changed = False
                for candidate in deliveries:
                    item = self._dump_delivery(redact_persisted_value(dict(candidate)))
                    key = item["idempotency_key"]
                    existing = by_key.get(key)
                    if existing is None:
                        stored.append(item)
                        by_key[key] = item
                        existing = item
                        changed = True
                    delivery_id = str(existing["delivery_id"])
                    if delivery_id not in delivery_ids:
                        delivery_ids.append(delivery_id)

                if changed:
                    merged = {
                        **current,
                        "deliveries": stored,
                        "status": status,
                        "record_version": current["record_version"] + 1,
                        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    }
                    saved_record = self._dump(merged)
                    self._write_record(saved_record, path)
                    self._write_index_entry(saved_record, path)
                else:
                    saved_record = self._dump(current)

                ledger[scoped] = {
                    "body_hash": request_hash,
                    "result": {"delivery_ids": delivery_ids},
                }
                self._write_atomic(ledger_path, ledger)
                return {"record": saved_record, "delivery_ids": delivery_ids, "replayed": False}

    @staticmethod
    def _dump_delivery(value: Mapping[str, Any]) -> dict[str, Any]:
        from src.core.image_posts.models import Delivery

        return Delivery.model_validate(dict(value)).model_dump(mode="json")

    async def update(
        self, publication_id: str, patch: Mapping[str, Any], expected_record_version: int
    ) -> dict[str, Any]:
        with self._locked(self.root / ".index.lock"):
            current = self.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            path = self._record_path(current)
            with self._locked(path.with_suffix(".lock")):
                current = self._read_json(path, None)
                if current is None:
                    raise KeyError(publication_id)
                if current["record_version"] != expected_record_version:
                    raise RepositoryConflict("REVISION_CONFLICT")
                immutable = {"schema_version", "publication_id", "post_id", "created_at", "supersedes_publication_id"}
                if immutable.intersection(patch):
                    raise ValueError("No se pueden cambiar los identificadores ni created_at")
                merged = {**current, **dict(patch), "record_version": expected_record_version + 1}
                merged.setdefault("updated_at", datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
                data = self._dump(merged)
                self._write_record(data, path)
                self._write_index_entry(data, path)
                return data

    async def append_delivery_event(
        self, publication_id: str, delivery_id: str, event: Mapping[str, Any],
        expected_record_version: int | None = None,
    ) -> dict[str, Any]:
        with self._locked(self.root / ".index.lock"):
            current = self.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            path = self._record_path(current)
            with self._locked(path.with_suffix(".lock")):
                current = self._read_json(path, None)
                if current is None:
                    raise KeyError(publication_id)
                if expected_record_version is not None and current["record_version"] != expected_record_version:
                    raise RepositoryConflict("REVISION_CONFLICT")
                deliveries = list(current["deliveries"])
                index = next((i for i, row in enumerate(deliveries) if row["delivery_id"] == delivery_id), None)
                if index is None:
                    raise KeyError(delivery_id)
                deliveries[index] = {**deliveries[index], **dict(event), "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
                merged = {**current, "deliveries": deliveries, "record_version": current["record_version"] + 1,
                          "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
                data = self._dump(merged)
                self._write_record(data, path)
                self._write_index_entry(data, path)
                return data

    async def append_metrics_snapshot(
        self, publication_id: str, snapshot: Mapping[str, Any]
    ) -> dict[str, Any]:
        with self._locked(self.root / ".index.lock"):
            current = self.get(publication_id)
            if current is None:
                raise KeyError(publication_id)
            path = self._record_path(current)
            with self._locked(path.with_suffix(".lock")):
                current = self._read_json(path, None)
                if current is None:
                    raise KeyError(publication_id)
                snapshots = list(current["metrics_snapshots"])
                key = str(snapshot.get("snapshot_id"))
                unique_key = (snapshot.get("delivery_id"), snapshot.get("window"), snapshot.get("observed_at"))
                if any(
                    item.get("snapshot_id") == key or
                    (item.get("delivery_id"), item.get("window"), item.get("observed_at")) == unique_key
                    for item in snapshots
                ):
                    return self._dump(current)
                snapshots.append(dict(snapshot))
                merged = {**current, "metrics_snapshots": snapshots,
                          "record_version": current["record_version"] + 1,
                          "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
                data = self._dump(merged)
                self._write_record(data, path)
                self._write_index_entry(data, path)
                return data

    def list(
        self, filters: Mapping[str, Any] | None = None, *, sort: str = "desc",
        limit: int = 24, cursor: str | None = None,
    ) -> PublicationPage:
        filters = dict(filters or {})
        limit = min(max(int(limit), 1), 100)
        if sort not in {"asc", "desc"}:
            raise ValueError("sort debe ser asc o desc")
        filter_hash = hashlib.sha256(json.dumps(filters, sort_keys=True, default=str).encode()).hexdigest()[:12]
        after: tuple[str, str] | None = None
        as_of = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        if cursor:
            try:
                decoded = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
                if decoded["filter_hash"] != filter_hash or decoded["sort"] != sort:
                    raise ValueError("Cursor incompatible con los filtros")
                as_of = decoded["as_of"]
                after_value = decoded["sort_value"]
                after = (after_value if after_value is not None else float("-inf"), decoded["publication_id"])
            except (ValueError, KeyError, json.JSONDecodeError) as exc:
                raise ValueError("Cursor inválido") from exc
        items = self._read_index()
        metric = filters.get("metric")
        window = filters.get("window", "48h")
        delivery_filters = ("platform", "account_alias", "placement", "delivery_status")

        def matching_deliveries(item: Mapping[str, Any]) -> list[dict[str, Any]]:
            def matches_delivery_filter(delivery: Mapping[str, Any], field: str) -> bool:
                expected = filters.get(field)
                if not expected:
                    return True
                actual = delivery.get("status" if field == "delivery_status" else field)
                return actual in expected if isinstance(expected, (list, tuple, set)) else actual == expected

            return [
                delivery for delivery in item.get("delivery_summaries", [])
                if all(matches_delivery_filter(delivery, field) for field in delivery_filters)
            ]

        def metric_for(item: Mapping[str, Any]) -> float | None:
            values = []
            for delivery in matching_deliveries(item):
                metrics = delivery.get(f"metrics_{window}") or {}
                value = metrics.get(metric) if metric else None
                if isinstance(value, (int, float)):
                    values.append(float(value))
            return max(values) if values else None
        def matches(item: Mapping[str, Any]) -> bool:
            if filters.get("category_id") and item.get("category_id") != filters["category_id"]:
                return False
            if filters.get("kind") and item.get("kind") != filters["kind"]:
                return False
            if filters.get("strategy_id") and item.get("strategy_id") != filters["strategy_id"]:
                return False
            if filters.get("status") and item.get("status") != filters["status"]:
                return False
            if any(filters.get(field) for field in delivery_filters) and not matching_deliveries(item):
                return False
            latest = item.get("latest_published_at")
            if filters.get("date_from") and (not latest or latest < filters["date_from"]):
                return False
            if filters.get("date_to") and (not latest or latest > filters["date_to"]):
                return False
            return True
        items = [item for item in items if matches(item)]
        if metric:
            valued = [item for item in items if metric_for(item) is not None]
            missing = [item for item in items if metric_for(item) is None]
            valued.sort(key=lambda item: (metric_for(item), item.get("latest_published_at") or "",
                                          item["publication_id"]), reverse=sort == "desc")
            missing.sort(key=lambda item: (item.get("latest_published_at") or "", item["publication_id"]),
                         reverse=sort == "desc")
            items = valued + missing
        else:
            items.sort(key=lambda item: (item.get("latest_published_at") or item["created_at"], item["publication_id"]),
                       reverse=sort == "desc")
        if after is not None:
            after_id = after[1]
            last_index = next((index for index, item in enumerate(items) if item["publication_id"] == after_id), None)
            if last_index is None:
                raise ValueError("Cursor ya no corresponde a esta página")
            items = items[last_index + 1:]
        page = items[:limit]
        next_cursor = None
        if len(items) > limit and page:
            last = page[-1]
            value = metric_for(last) if metric else (last.get("latest_published_at") or last["created_at"])
            token = {"filter_hash": filter_hash, "sort": sort, "as_of": as_of,
                     "sort_value": value if value is not None else None, "publication_id": last["publication_id"]}
            next_cursor = base64.urlsafe_b64encode(json.dumps(token, separators=(",", ":")).encode()).decode().rstrip("=")
        return PublicationPage(items=page, next_cursor=next_cursor, as_of=as_of)

    async def delete(self, publication_id: str, policy: str) -> bool:
        if policy != "authorized_legal_purge":
            raise PermissionError("Purgar publicaciones requiere política explícita")
        with self._locked(self.root / ".index.lock"):
            record = self.get(publication_id)
            if record is None:
                return False
            path = self._record_path(record)
            with self._locked(path.with_suffix(".lock")):
                path.unlink(missing_ok=True)
                (path.parent / "plan.json").unlink(missing_ok=True)
                entries = [item for item in self._read_index() if item["publication_id"] != publication_id]
                self._write_atomic(self.index_path, entries)
            path.with_suffix(".lock").unlink(missing_ok=True)
            return True

    def repair_index(self) -> int:
        """Reconstruye la proyección; se puede llamar al arranque o por scheduler."""
        with self._locked(self.root / ".index.lock"):
            entries = []
            for path in self.root.glob("*/*/*/*/record.json"):
                raw = self._read_json(path, None)
                if raw is None:
                    continue
                record = self._dump(raw)
                self._write_atomic(path.parent / "plan.json", record["technical"]["composition_plan"])
                entries.append(self._summary(record, path))
            entries.sort(key=lambda item: item["created_at"], reverse=True)
            self._write_atomic(self.index_path, entries)
            return len(entries)


