"""StatsContext — la foto de datos sobre la que trabajan todas las secciones.

Cada fuente se lee UNA vez por request (perezosamente, solo si alguna sección
la pide) y se comparte entre secciones. Las secciones nunca leen el DataStore
por su cuenta: reciben este contexto, lo que las vuelve funciones puras y
fáciles de testear con datos falsos (ver tests/unit/test_stats.py).

Las cuentas conectadas viven en un adapter (tokens cifrados), así que no se
importan desde acá: quien arma el contexto (el router) inyecta
`accounts_loader`. Así `core` sigue sin depender de `adapters`.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from functools import cached_property
from typing import Any

from src.config.niche_config import NicheConfig, list_all_niches
from src.core import job_tracker, publish_log
from src.core.data import collection
from src.core.history import HistoryEvent
from src.core.schedule.models import QueueEntry

Record = dict[str, Any]
AccountsLoader = Callable[[], list[Record]]


class StatsContext:
    def __init__(
        self,
        *,
        accounts_loader: AccountsLoader | None = None,
        now: datetime | None = None,
    ) -> None:
        self._accounts_loader = accounts_loader
        self.now = now or datetime.now(timezone.utc)

    # ── Fuentes (cada una se carga una sola vez) ─────────────────────────────

    @cached_property
    def jobs(self) -> list[Record]:
        records, _ = job_tracker.list_jobs(limit=100_000)
        return records

    @cached_property
    def queue_entries(self) -> list[QueueEntry]:
        return [QueueEntry(**r) for r in collection("queue_entries").list()]

    @cached_property
    def publications(self) -> list[Record]:
        """Log de publicaciones exitosas (única fuente de "qué salió dónde")."""
        return publish_log.list_published_videos()

    @cached_property
    def history_events(self) -> list[HistoryEvent]:
        return [HistoryEvent(**r) for r in collection("history_events").list()]

    @cached_property
    def accounts(self) -> list[Record]:
        if self._accounts_loader is None:
            return []
        try:
            return self._accounts_loader()
        except Exception:  # noqa: BLE001 — sin publisher configurado, las stats siguen
            return []

    @cached_property
    def templates(self) -> list[NicheConfig]:
        """Plantillas publicables: mismos criterios que GET /templates."""
        return [n for n in list_all_niches() if n.active and n.pipeline_type == "config_driven_template"]

    @cached_property
    def active_niches(self) -> list[NicheConfig]:
        return [n for n in list_all_niches() if n.active]

    # ── Derivados compartidos ────────────────────────────────────────────────

    @cached_property
    def published_job_ids(self) -> set[str]:
        ids = {p["job_id"] for p in self.publications if p.get("job_id")}
        ids |= {e.job_id for e in self.queue_entries if e.status.value == "published"}
        ids |= {j["job_id"] for j in self.jobs if j.get("stage") == "published"}
        return ids

    @cached_property
    def jobs_by_id(self) -> dict[str, Record]:
        return {j["job_id"]: j for j in self.jobs}

    def seconds_ago(self, when: str | float | None) -> float | None:
        """Antigüedad en segundos de un ISO string o timestamp unix."""
        if when is None:
            return None
        try:
            moment = (
                datetime.fromtimestamp(when, timezone.utc)
                if isinstance(when, (int, float))
                else datetime.fromisoformat(when)
            )
        except (TypeError, ValueError, OSError):
            return None
        return (self.now - moment).total_seconds()
