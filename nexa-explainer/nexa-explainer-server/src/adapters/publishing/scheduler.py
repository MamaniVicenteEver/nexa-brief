"""Publishing Scheduler — runs both background maintenance jobs on one shared
APScheduler.BackgroundScheduler (a single daemon thread):

  1. Token refresh   — proactively refreshes near-expiry tokens, every 15 min.
  2. Schedule tick    — drives `src.core.schedule.engine.process_tick()`, every
                         `settings.schedule_tick_interval_seconds` (default 60s):
                         recovers stale 'publishing' entries, auto-fills gaps
                         in recurring schedule slots, and publishes anything
                         whose `scheduled_at` is due.

Why not asyncio-based APScheduler?
  The FastAPI event loop is not accessible from background threads without
  a reference.  We pass the loop explicitly at startup via lifespan.

Structured log events:
  scheduler_started            — APScheduler started (both jobs registered)
  scheduler_refresh_tick       — scheduled token-refresh cycle begun
  scheduler_refresh_done       — token-refresh cycle completed
  scheduler_refresh_error      — exception during a refresh cycle (non-fatal)
  scheduler_schedule_tick      — scheduled process_tick cycle begun
  scheduler_schedule_tick_done — process_tick cycle completed
  scheduler_schedule_tick_error— exception during a process_tick cycle (non-fatal)
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import structlog
from apscheduler.schedulers.background import BackgroundScheduler

from src.config.settings import settings
from src.core.schedule import engine

if TYPE_CHECKING:
    from src.adapters.publishing.publisher_facade import PublisherFacade

logger = structlog.get_logger(__name__)

_REFRESH_INTERVAL_MINUTES = 15


async def _refresh_and_notify(facade: "PublisherFacade") -> dict:
    """Corre `facade.refresh_all_tokens()` y, para cualquier cuenta que haya
    quedado en `requires_reauth`, crea una notificación de "token vencido" —
    solo si no hay ya una sin leer para esa cuenta (evita re-notificar en
    cada tick de 15 min mientras el token siga sin renovarse)."""
    from src.core import notification_tracker
    from src.core.notification import Notification

    results = await facade.refresh_all_tokens()

    for account in facade.list_accounts():
        if account["status"] != "requires_reauth":
            continue
        selector = f"{account['platform']}:{account['alias']}"
        if notification_tracker.exists_unresolved("token_expired", selector):
            continue
        await notification_tracker.create(Notification(
            type="token_expired",
            severity="warning",
            title="Token vencido",
            message=f"La cuenta '{selector}' ({account.get('name', selector)}) necesita reautenticarse.",
            account_alias=selector,
        ))

    return results


def _register_token_refresh(
    scheduler: BackgroundScheduler,
    facade: "PublisherFacade",
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Register the proactive token-refresh job — logic unchanged from before
    the schedule-engine integration."""

    def _refresh_tick() -> None:
        """Run one refresh cycle: check all tokens and refresh expiring ones."""
        logger.info("scheduler_refresh_tick")
        try:
            future = asyncio.run_coroutine_threadsafe(
                _refresh_and_notify(facade), loop
            )
            results = future.result(timeout=120)  # Wait up to 2 min for all refreshes
            logger.info(
                "scheduler_refresh_done",
                results=results,
                accounts_checked=len(results),
                errors=sum(1 for v in results.values() if v.startswith("error:")),
            )
        except Exception as exc:
            logger.error(
                "scheduler_refresh_error",
                error=str(exc),
                error_type=type(exc).__name__,
            )

    scheduler.add_job(
        _refresh_tick,
        trigger="interval",
        minutes=_REFRESH_INTERVAL_MINUTES,
        id="token_refresh",
        replace_existing=True,
    )


def _register_schedule_tick(
    scheduler: BackgroundScheduler,
    facade: "PublisherFacade",
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Register the schedule-engine tick: recovers stale entries, auto-fills
    recurring slots, and publishes anything due — see
    `src.core.schedule.engine.process_tick`."""

    def _schedule_tick() -> None:
        logger.info("scheduler_schedule_tick")
        try:
            future = asyncio.run_coroutine_threadsafe(
                engine.process_tick(facade), loop
            )
            result = future.result(timeout=180)
            logger.info("scheduler_schedule_tick_done", **result)
        except Exception as exc:
            logger.error(
                "scheduler_schedule_tick_error",
                error=str(exc),
                error_type=type(exc).__name__,
            )

    scheduler.add_job(
        _schedule_tick,
        trigger="interval",
        seconds=settings.schedule_tick_interval_seconds,
        id="schedule_tick",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=55,
    )


def start_publishing_scheduler(
    facade: "PublisherFacade",
    loop: asyncio.AbstractEventLoop,
) -> BackgroundScheduler:
    """Start a background scheduler running both the token-refresh job and the
    schedule-engine tick.

    Args:
        facade: The singleton PublisherFacade (must already be initialised).
        loop:   The asyncio event loop from FastAPI's lifespan context.
                Pass `asyncio.get_event_loop()` from within the lifespan.

    Returns:
        The started BackgroundScheduler instance (call .shutdown() on app exit).
    """
    scheduler = BackgroundScheduler(daemon=True)
    _register_token_refresh(scheduler, facade, loop)   # lógica existente, sin cambios
    _register_schedule_tick(scheduler, facade, loop)
    scheduler.start()

    logger.info(
        "scheduler_started",
        token_refresh_interval_minutes=_REFRESH_INTERVAL_MINUTES,
        token_refresh_next_run=str(scheduler.get_job("token_refresh").next_run_time),
        schedule_tick_interval_seconds=settings.schedule_tick_interval_seconds,
        schedule_tick_next_run=str(scheduler.get_job("schedule_tick").next_run_time),
    )

    return scheduler
